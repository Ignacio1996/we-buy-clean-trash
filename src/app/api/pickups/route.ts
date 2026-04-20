import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import type { BagDoc, DeclaredBagType } from '@/lib/types/bag';
import type { PickupDoc } from '@/lib/types/pickup';

export const runtime = 'nodejs';

const MAX_BASE64_CHARS = 6 * 1024 * 1024;

interface PickupPayload {
  bagCode: string;
  declaredType: DeclaredBagType;
  photoBase64: string;
  photoMime: string;
}

function parsePayload(raw: unknown): PickupPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bagCode = typeof r.bagCode === 'string' ? r.bagCode.trim() : '';
  const declaredType =
    r.declaredType === 'mixed' || r.declaredType === 'separated' ? r.declaredType : null;
  const photoBase64 = typeof r.photoBase64 === 'string' ? r.photoBase64 : '';
  const photoMime = typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg';
  if (!bagCode || !declaredType || !photoBase64) return null;
  if (photoBase64.length > MAX_BASE64_CHARS) return null;
  return { bagCode, declaredType, photoBase64, photoMime };
}

async function findBagByCode(code: string) {
  const byQr = await adminDb.collection('bags').where('qrCode', '==', code).limit(1).get();
  if (!byQr.empty) return byQr.docs[0];
  const byPrinted = await adminDb
    .collection('bags')
    .where('printedNumber', '==', code)
    .limit(1)
    .get();
  if (!byPrinted.empty) return byPrinted.docs[0];
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'resident') {
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
  if (bag.residentId !== session.uid) {
    return NextResponse.json({ error: 'bag_not_yours' }, { status: 403 });
  }
  if (bag.status !== 'unused') {
    return NextResponse.json({ error: 'bag_already_in_use' }, { status: 409 });
  }

  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  const addressId =
    typeof userSnap.get('addressId') === 'string' ? (userSnap.get('addressId') as string) : null;
  if (!addressId) return NextResponse.json({ error: 'user_missing_address' }, { status: 409 });

  const pickupRef = adminDb.collection('pickups').doc();
  const storagePath = `pickups/${session.uid}/${pickupRef.id}.jpg`;
  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  const buffer = Buffer.from(payload.photoBase64, 'base64');
  await file.save(buffer, { contentType: payload.photoMime, resumable: false });

  const doorstepPhotoUrl = `gs://${bucket.name}/${storagePath}`;

  await adminDb.runTransaction(async (tx) => {
    const freshBag = await tx.get(bagSnap.ref);
    if (!freshBag.exists || freshBag.get('status') !== 'unused') {
      throw new Error('bag_state_changed');
    }
    const pickup: PickupDoc = {
      id: pickupRef.id,
      bagId: bagSnap.id,
      residentId: session.uid,
      addressId,
      routeId: null,
      operatorId: null,
      doorstepPhotoUrl,
      operatorPhotoUrl: null,
      sealed: null,
      status: 'pending',
      issue: null,
      issueNote: null,
      createdAt: FieldValue.serverTimestamp() as unknown as PickupDoc['createdAt'],
      completedAt: null,
    };
    tx.set(pickupRef, pickup);
    tx.update(bagSnap.ref, {
      status: 'pending_pickup',
      declaredType: payload.declaredType,
    });
  });

  return NextResponse.json({ ok: true, pickupId: pickupRef.id });
}
