import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { uploadPhoto } from '@/lib/storage/uploadPhoto';
import {
  isContaminationSeverity,
  isMaterialId,
  type ContaminationSeverity,
  type MaterialId,
} from '@/lib/types/material';
import type { BagDoc } from '@/lib/types/bag';
import { isCompostSkipReason, type CompostSkipReason } from '@/lib/types/binPickup';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';

const MAX_PHOTO_BASE64 = 6 * 1024 * 1024;
// A loaded recycling tote tops out well under this; guards fat-finger entries.
const MAX_WEIGHT_LBS = 5000;

interface WeighedPickupPayload {
  commercialAccountId: string;
  materialId: MaterialId;
  // 'collected' writes weight; 'skipped' records nothing collected with a reason.
  collected: boolean;
  skipReason: CompostSkipReason | null;
  grossWeightLbs: number;
  tareWeightLbs: number;
  binBagId: string | null;
  contaminationSeverity: ContaminationSeverity;
  needsCleaning: boolean;
  damaged: boolean;
  driverNotes: string | null;
  photoBase64: string | null;
  photoMime: string;
}

function parseWeight(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_LBS) return null;
  // Round to one decimal — scales report tenths of a pound.
  return Math.round(n * 10) / 10;
}

function parsePayload(raw: unknown): WeighedPickupPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;

  const commercialAccountId =
    typeof r.commercialAccountId === 'string' ? r.commercialAccountId.trim() : '';
  if (!commercialAccountId) return { error: 'invalid_account_id' };

  if (!isMaterialId(r.materialId)) return { error: 'invalid_material_id' };

  const collected = r.collected !== false; // default to a collection

  let skipReason: CompostSkipReason | null = null;
  let grossWeightLbs = 0;
  let tareWeightLbs = 0;
  if (collected) {
    const gross = parseWeight(r.grossWeightLbs);
    const tare = parseWeight(r.tareWeightLbs);
    if (gross === null) return { error: 'invalid_gross_weight' };
    if (tare === null) return { error: 'invalid_tare_weight' };
    if (tare > gross) return { error: 'tare_exceeds_gross' };
    if (gross - tare <= 0) return { error: 'zero_net_weight' };
    grossWeightLbs = gross;
    tareWeightLbs = tare;
  } else {
    if (!isCompostSkipReason(r.skipReason)) return { error: 'invalid_skip_reason' };
    skipReason = r.skipReason;
  }

  if (!isContaminationSeverity(r.contaminationSeverity)) {
    return { error: 'invalid_contamination' };
  }

  const binBagId = typeof r.binBagId === 'string' && r.binBagId.trim() ? r.binBagId.trim() : null;

  const photoBase64 =
    typeof r.photoBase64 === 'string' && r.photoBase64.trim() ? r.photoBase64 : null;
  if (photoBase64 && photoBase64.length > MAX_PHOTO_BASE64) {
    return { error: 'photo_too_large' };
  }

  return {
    commercialAccountId,
    materialId: r.materialId,
    collected,
    skipReason,
    grossWeightLbs,
    tareWeightLbs,
    binBagId,
    contaminationSeverity: r.contaminationSeverity,
    needsCleaning: r.needsCleaning === true,
    damaged: r.damaged === true,
    driverNotes:
      typeof r.driverNotes === 'string' && r.driverNotes.trim() ? r.driverNotes.trim() : null,
    photoBase64,
    photoMime: typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg',
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parsePayload(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const accountSnap = await adminDb
    .collection('commercialAccounts')
    .doc(parsed.commercialAccountId)
    .get();
  if (!accountSnap.exists) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  }
  const account = accountSnap.data() as CommercialAccountDoc;
  if (account.active === false) {
    return NextResponse.json({ error: 'account_inactive' }, { status: 409 });
  }
  if (account.siteType !== 'recycling_weighed') {
    return NextResponse.json({ error: 'wrong_site_type' }, { status: 400 });
  }
  if (!account.materialIds.includes(parsed.materialId)) {
    return NextResponse.json({ error: 'material_not_accepted' }, { status: 400 });
  }

  // Validate the scanned tote belongs to this account and is a reusable bin.
  if (parsed.binBagId) {
    const bagSnap = await adminDb.collection('bags').doc(parsed.binBagId).get();
    if (!bagSnap.exists) {
      return NextResponse.json({ error: 'bin_not_found' }, { status: 404 });
    }
    const bag = bagSnap.data() as BagDoc;
    if (bag.commercialAccountId !== parsed.commercialAccountId) {
      return NextResponse.json({ error: 'bin_not_in_account' }, { status: 400 });
    }
    if (!bag.reusable) {
      return NextResponse.json({ error: 'bin_not_reusable' }, { status: 400 });
    }
  }

  const totalWeightLbs = parsed.collected
    ? Math.round((parsed.grossWeightLbs - parsed.tareWeightLbs) * 10) / 10
    : 0;

  let photoUrl: string | null = null;
  if (parsed.photoBase64) {
    const tempId = adminDb.collection('binPickups').doc().id;
    const upload = await uploadPhoto({
      path: `binPickups/${parsed.commercialAccountId}/${tempId}.jpg`,
      base64: parsed.photoBase64,
      contentType: parsed.photoMime,
    });
    photoUrl = upload.url;
  }

  // Attach to the operator's open run, if any (same as the bin-pickup flow).
  let routeId: string | null = null;
  const openRouteSnap = await adminDb
    .collection('compostRoutes')
    .where('operatorId', '==', session.uid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (!openRouteSnap.empty) routeId = openRouteSnap.docs[0].id;

  const pickupRef = adminDb.collection('binPickups').doc();
  const inventoryRef = adminDb
    .collection('inventory')
    .doc(`commercial_${account.zoneId}_${parsed.materialId}`);
  const cleaningTicketRef = adminDb.collection('cleaningTickets').doc(pickupRef.id);

  await adminDb.runTransaction(async (tx) => {
    // Written into binPickups (captureMode 'weighed') so route runs, the operator
    // done-state, and the dashboard pick it up like any other stop. bins[] is
    // empty — weight is the measured net, not a fullness lookup.
    tx.set(pickupRef, {
      id: pickupRef.id,
      commercialAccountId: parsed.commercialAccountId,
      zoneId: account.zoneId,
      operatorId: session.uid,
      routeId,
      materialId: parsed.materialId,
      // 'loaded' = tote emptied into the truck and returned; 'skipped' = nothing.
      action: parsed.collected ? 'loaded' : 'skipped',
      skipReason: parsed.skipReason,
      bins: [],
      totalWeightLbs,
      captureMode: 'weighed',
      grossWeightLbs: parsed.collected ? parsed.grossWeightLbs : null,
      tareWeightLbs: parsed.collected ? parsed.tareWeightLbs : null,
      binBagId: parsed.binBagId,
      contaminationSeverity: parsed.contaminationSeverity,
      needsCleaning: parsed.needsCleaning,
      damaged: parsed.damaged,
      driverNotes: parsed.driverNotes,
      photoUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Commercial inventory rolls up by zone + material — recycling stays separate
    // from food-scrap because the materialId differs. Skipped stops add nothing.
    if (totalWeightLbs > 0) {
      tx.set(
        inventoryRef,
        {
          id: inventoryRef.id,
          depotId: null,
          zoneId: account.zoneId,
          materialId: parsed.materialId,
          weight: FieldValue.increment(totalWeightLbs),
          scope: 'commercial',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (parsed.needsCleaning) {
      tx.set(cleaningTicketRef, {
        id: cleaningTicketRef.id,
        commercialAccountId: parsed.commercialAccountId,
        zoneId: account.zoneId,
        flaggedByRunId: routeId,
        flaggedByPickupId: pickupRef.id,
        flaggedAt: FieldValue.serverTimestamp(),
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
      });
    }
  });

  return NextResponse.json({ ok: true, binPickupId: pickupRef.id, totalWeightLbs });
}
