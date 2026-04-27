import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isMaterialId, type MaterialId } from '@/lib/types/material';
import { isBinSize, type BinSize } from '@/lib/logic/binWeightTable';
import { normalizeCollectionDays } from '@/lib/types/commercialAccount';

export const runtime = 'nodejs';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (raw.businessName !== undefined) {
    const v = str(raw.businessName);
    if (!v) return NextResponse.json({ error: 'invalid_business_name' }, { status: 400 });
    update.businessName = v;
  }
  if (raw.contactName !== undefined) {
    const v = str(raw.contactName);
    if (!v) return NextResponse.json({ error: 'invalid_contact_name' }, { status: 400 });
    update.contactName = v;
  }
  if (raw.contactPhone !== undefined) update.contactPhone = strOrNull(raw.contactPhone);
  if (raw.contactEmail !== undefined) update.contactEmail = strOrNull(raw.contactEmail);
  if (raw.affiliationId !== undefined) update.affiliationId = strOrNull(raw.affiliationId);
  if (raw.driverNotes !== undefined) update.driverNotes = strOrNull(raw.driverNotes);
  if (raw.active !== undefined) update.active = Boolean(raw.active);

  if (raw.defaultBinSize !== undefined) {
    if (!isBinSize(raw.defaultBinSize)) {
      return NextResponse.json({ error: 'invalid_bin_size' }, { status: 400 });
    }
    update.defaultBinSize = raw.defaultBinSize as BinSize;
  }

  if (raw.pickupsPerWeek !== undefined) {
    const n = typeof raw.pickupsPerWeek === 'number' ? raw.pickupsPerWeek : Number(raw.pickupsPerWeek);
    if (!Number.isFinite(n) || n < 1 || n > 7) {
      return NextResponse.json({ error: 'invalid_pickups_per_week' }, { status: 400 });
    }
    update.pickupsPerWeek = n;
  }

  if (raw.collectionDays !== undefined) {
    const days = normalizeCollectionDays(raw.collectionDays);
    if (!days) return NextResponse.json({ error: 'invalid_collection_days' }, { status: 400 });
    update.collectionDays = days;
  }

  if (raw.materialIds !== undefined) {
    if (!Array.isArray(raw.materialIds) || raw.materialIds.length === 0) {
      return NextResponse.json({ error: 'invalid_material_ids' }, { status: 400 });
    }
    const ids: MaterialId[] = [];
    for (const v of raw.materialIds) {
      if (!isMaterialId(v)) return NextResponse.json({ error: 'invalid_material_ids' }, { status: 400 });
      if (!ids.includes(v)) ids.push(v);
    }
    update.materialIds = ids;
  }

  if (raw.zoneId !== undefined) {
    const zoneId = str(raw.zoneId);
    if (!zoneId) return NextResponse.json({ error: 'invalid_zone_id' }, { status: 400 });
    const zoneSnap = await adminDb.collection('zones').doc(zoneId).get();
    if (!zoneSnap.exists) {
      return NextResponse.json({ error: 'zone_not_found' }, { status: 400 });
    }
    update.zoneId = zoneId;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const ref = adminDb.collection('commercialAccounts').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await ref.update(update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const ref = adminDb.collection('commercialAccounts').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Soft-delete — historical bins, pickups, and reports stay attached.
  await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true });
}
