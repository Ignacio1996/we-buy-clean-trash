import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { uploadPhoto } from '@/lib/storage/uploadPhoto';
import { getSession } from '@/lib/auth/session';
import { findBagByCode } from '@/lib/pickups/lookup';
import {
  resolveContainerType,
  type BagDoc,
  type DeclaredBagType,
} from '@/lib/types/bag';
import type { PickupDoc } from '@/lib/types/pickup';

const MAX_BASE64_CHARS = 6 * 1024 * 1024;

interface ScanCompletePayload {
  bagCode: string;
  declaredType: DeclaredBagType | null;
  sealed: boolean;
  contaminationObserved: boolean;
  photoBase64: string;
  photoMime: string;
}

function parsePayload(raw: unknown): ScanCompletePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bagCode = typeof r.bagCode === 'string' ? r.bagCode.trim() : '';
  const declaredType =
    r.declaredType === 'mixed' || r.declaredType === 'separated' ? r.declaredType : null;
  const sealed = typeof r.sealed === 'boolean' ? r.sealed : null;
  const contaminationObserved =
    typeof r.contaminationObserved === 'boolean' ? r.contaminationObserved : null;
  const photoBase64 = typeof r.photoBase64 === 'string' ? r.photoBase64 : '';
  const photoMime = typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg';
  if (!bagCode || sealed === null || contaminationObserved === null) return null;
  if (!photoBase64 || photoBase64.length > MAX_BASE64_CHARS) return null;
  return { bagCode, declaredType, sealed, contaminationObserved, photoBase64, photoMime };
}

/**
 * Fallback pickup completion for operators. Unlike /api/pickups/[id]/complete, this
 * path does NOT require the pickup to be attached to an in-progress route owned by
 * the operator — it exists so operators can always collect a bag by scanning its QR
 * even when routing failed to build/assign a route. It completes an existing pending
 * pickup, or creates an ad-hoc one when the resident never scheduled it. Idempotency
 * is guarded on the bag's status (a bag can only be picked up once).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const payload = parsePayload(json);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const bagSnap = await findBagByCode(payload.bagCode);
  if (!bagSnap) return NextResponse.json({ error: 'bag_not_found' }, { status: 404 });
  const bag = bagSnap.data() as BagDoc;

  if (resolveContainerType(bag) !== 'bag') {
    return NextResponse.json({ error: 'not_a_residential_bag' }, { status: 409 });
  }
  if (!bag.residentId) {
    return NextResponse.json({ error: 'bag_unassigned' }, { status: 409 });
  }
  if (bag.status === 'picked_up') {
    return NextResponse.json({ error: 'already_picked_up' }, { status: 409 });
  }
  if (bag.status === 'processed') {
    return NextResponse.json({ error: 'already_processed' }, { status: 409 });
  }

  // Existing pending pickup for this bag, if any (route attachment is irrelevant here).
  const pickupQuery = await adminDb
    .collection('pickups')
    .where('bagId', '==', bagSnap.id)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  const existingPickupRef = pickupQuery.empty ? null : pickupQuery.docs[0].ref;

  // Resolve address for an ad-hoc pickup (existing pickups already carry one).
  let addressId: string | null =
    pickupQuery.empty ? null : (pickupQuery.docs[0].get('addressId') as string);
  if (!addressId) {
    const userSnap = await adminDb.collection('users').doc(bag.residentId).get();
    addressId =
      typeof userSnap.get('addressId') === 'string' ? (userSnap.get('addressId') as string) : null;
  }
  if (!addressId) {
    return NextResponse.json({ error: 'user_missing_address' }, { status: 409 });
  }

  const pickupRef = existingPickupRef ?? adminDb.collection('pickups').doc();
  const storagePath = `pickups/${bag.residentId}/${pickupRef.id}-op.jpg`;
  const upload = await uploadPhoto({
    path: storagePath,
    base64: payload.photoBase64,
    contentType: payload.photoMime,
  });
  const operatorPhotoUrl = upload.url;

  const declaredType = bag.declaredType ?? payload.declaredType ?? null;

  await adminDb.runTransaction(async (tx) => {
    const freshBag = await tx.get(bagSnap.ref);
    if (!freshBag.exists) throw new Error('bag_not_found');
    const status = freshBag.get('status') as BagDoc['status'];
    if (status === 'picked_up' || status === 'processed') {
      throw new Error('already_picked_up');
    }

    if (existingPickupRef) {
      const freshPickup = await tx.get(existingPickupRef);
      if (!freshPickup.exists || freshPickup.get('status') !== 'pending') {
        throw new Error('pickup_state_changed');
      }
      tx.update(existingPickupRef, {
        status: 'completed',
        sealed: payload.sealed,
        operatorPhotoUrl,
        operatorId: session.uid,
        completedAt: FieldValue.serverTimestamp(),
        issue: payload.contaminationObserved ? 'contaminated' : null,
      });
    } else {
      // Ad-hoc: resident never scheduled this bag. Create a completed pickup so the
      // depot still weighs it and credits the resident. No doorstep photo exists.
      const pickup: PickupDoc = {
        id: pickupRef.id,
        bagId: bagSnap.id,
        residentId: bag.residentId as string,
        addressId: addressId as string,
        routeId: null,
        operatorId: session.uid,
        doorstepPhotoUrl: null,
        operatorPhotoUrl,
        sealed: payload.sealed,
        status: 'completed',
        issue: payload.contaminationObserved ? 'contaminated' : null,
        issueNote: null,
        createdAt: FieldValue.serverTimestamp() as unknown as PickupDoc['createdAt'],
        completedAt: FieldValue.serverTimestamp() as unknown as PickupDoc['completedAt'],
      };
      tx.set(pickupRef, pickup);
    }

    tx.update(bagSnap.ref, {
      status: 'picked_up',
      ...(declaredType ? { declaredType } : {}),
    });
  });

  return NextResponse.json({ ok: true, pickupId: pickupRef.id });
}
