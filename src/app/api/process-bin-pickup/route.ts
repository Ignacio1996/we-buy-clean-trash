import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { uploadPhoto } from '@/lib/storage/uploadPhoto';
import {
  isBinSize,
  isFullnessBucket,
  BIN_WEIGHT_TABLE,
  type BinSize,
  type FullnessBucket,
} from '@/lib/logic/binWeightTable';
import {
  isContaminationSeverity,
  isMaterialId,
  type ContaminationSeverity,
  type MaterialId,
} from '@/lib/types/material';
import type { BagDoc } from '@/lib/types/bag';
import { resolveContainerType, containerBinSize } from '@/lib/types/bag';
import type { BinPickupBinEntry } from '@/lib/types/binPickup';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';

const MAX_BINS_PER_PICKUP = 50;
const MAX_PHOTO_BASE64 = 6 * 1024 * 1024;

interface BinInput {
  bagId?: string | null;
  binSize: BinSize;
  fullness: FullnessBucket;
}

interface ProcessBinPickupPayload {
  commercialAccountId: string;
  materialId: MaterialId;
  bins: BinInput[];
  contaminationSeverity: ContaminationSeverity;
  driverNotes: string | null;
  photoBase64: string | null;
  photoMime: string;
}

function parsePayload(raw: unknown): ProcessBinPickupPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;

  const commercialAccountId =
    typeof r.commercialAccountId === 'string' ? r.commercialAccountId.trim() : '';
  if (!commercialAccountId) return { error: 'invalid_account_id' };

  if (!isMaterialId(r.materialId)) return { error: 'invalid_material_id' };

  if (!Array.isArray(r.bins) || r.bins.length === 0 || r.bins.length > MAX_BINS_PER_PICKUP) {
    return { error: 'invalid_bins' };
  }
  const bins: BinInput[] = [];
  for (const b of r.bins) {
    if (!b || typeof b !== 'object') return { error: 'invalid_bin_entry' };
    const e = b as Record<string, unknown>;
    if (!isBinSize(e.binSize)) return { error: 'invalid_bin_size' };
    if (!isFullnessBucket(e.fullness)) return { error: 'invalid_fullness' };
    const bagId = typeof e.bagId === 'string' && e.bagId.trim() ? e.bagId.trim() : null;
    bins.push({ bagId, binSize: e.binSize, fullness: e.fullness });
  }

  if (!isContaminationSeverity(r.contaminationSeverity)) {
    return { error: 'invalid_contamination' };
  }

  const driverNotes =
    typeof r.driverNotes === 'string' && r.driverNotes.trim() ? r.driverNotes.trim() : null;

  const photoBase64 =
    typeof r.photoBase64 === 'string' && r.photoBase64.trim() ? r.photoBase64 : null;
  if (photoBase64 && photoBase64.length > MAX_PHOTO_BASE64) {
    return { error: 'photo_too_large' };
  }
  const photoMime = typeof r.photoMime === 'string' ? r.photoMime : 'image/jpeg';

  return {
    commercialAccountId,
    materialId: r.materialId,
    bins,
    contaminationSeverity: r.contaminationSeverity,
    driverNotes,
    photoBase64,
    photoMime,
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
  if (!account.materialIds.includes(parsed.materialId)) {
    return NextResponse.json({ error: 'material_not_accepted' }, { status: 400 });
  }

  // If bagIds were supplied, validate they belong to this account and are reusable bins.
  // Skip the lookup when no bagIds were provided (operator entered counts manually).
  const bagIds = parsed.bins.map((b) => b.bagId).filter((id): id is string => !!id);
  const bagsById = new Map<string, BagDoc>();
  if (bagIds.length > 0) {
    const bagSnaps = await adminDb.getAll(
      ...bagIds.map((id) => adminDb.collection('bags').doc(id)),
    );
    for (let i = 0; i < bagSnaps.length; i += 1) {
      const snap = bagSnaps[i];
      if (!snap.exists) {
        return NextResponse.json({ error: `bin_not_found_${bagIds[i]}` }, { status: 404 });
      }
      const bag = snap.data() as BagDoc;
      if (bag.commercialAccountId !== parsed.commercialAccountId) {
        return NextResponse.json({ error: 'bin_not_in_account' }, { status: 400 });
      }
      if (!bag.reusable) {
        return NextResponse.json({ error: 'bin_not_reusable' }, { status: 400 });
      }
      bagsById.set(bagIds[i], bag);
    }
    // Cross-check the entered binSize matches what was provisioned for that bin.
    for (const entry of parsed.bins) {
      if (!entry.bagId) continue;
      const bag = bagsById.get(entry.bagId);
      if (!bag) continue;
      const expectedSize = containerBinSize(resolveContainerType(bag));
      if (expectedSize !== entry.binSize) {
        return NextResponse.json({ error: 'bin_size_mismatch' }, { status: 400 });
      }
    }
  }

  // Compute weights from the lookup table. Capture interpolated flags so reports
  // can footnote the estimate.
  const binEntries: BinPickupBinEntry[] = parsed.bins.map((b) => {
    const lookup = BIN_WEIGHT_TABLE[b.binSize][b.fullness];
    return {
      bagId: b.bagId ?? null,
      binSize: b.binSize,
      fullness: b.fullness,
      weightLbs: lookup.weightLbs,
      interpolated: lookup.interpolated === true,
    };
  });
  const totalWeightLbs = binEntries.reduce((sum, e) => sum + e.weightLbs, 0);

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

  const pickupRef = adminDb.collection('binPickups').doc();
  const inventoryRef = adminDb
    .collection('inventory')
    .doc(`commercial_${account.zoneId}_${parsed.materialId}`);

  await adminDb.runTransaction(async (tx) => {
    tx.set(pickupRef, {
      id: pickupRef.id,
      commercialAccountId: parsed.commercialAccountId,
      zoneId: account.zoneId,
      operatorId: session.uid,
      routeId: null,
      materialId: parsed.materialId,
      bins: binEntries,
      totalWeightLbs,
      contaminationSeverity: parsed.contaminationSeverity,
      driverNotes: parsed.driverNotes,
      photoUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Inventory rolls up by zone + material for compost (no depot — bins go
    // direct to the composting facility). Inventory id namespaces commercial
    // pickups so they don't collide with depot inventory.
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
  });

  return NextResponse.json({
    ok: true,
    binPickupId: pickupRef.id,
    totalWeightLbs,
    binCount: binEntries.length,
  });
}
