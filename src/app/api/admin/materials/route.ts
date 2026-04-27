import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import {
  SEED_MATERIAL_DISPLAY_NAMES,
  isMaterialId,
  isMeasurementMode,
  isPayoutMode,
  type MaterialId,
  type MaterialPricing,
  type MeasurementMode,
  type PayoutMode,
} from '@/lib/types/material';

export const runtime = 'nodejs';

function parsePrice(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
function parsePct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

interface IncomingMaterial {
  marketPrice: number;
  customerPct: number;
  active: boolean;
  /** Optional display name; only honored for newly-created docs. */
  name?: string;
  /** Optional mode overrides. Only applied when present; otherwise existing values are preserved (or defaults applied for new docs). */
  payoutMode?: PayoutMode;
  measurementMode?: MeasurementMode;
}

/**
 * Bulk-update all materials' pricing + active flag. Body shape:
 *   { materials: { [id]: { marketPrice, customerPct, active, name? } } }
 * Snapshots into priceHistory in the same transaction so audit stays clean.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const entries = (raw.materials ?? {}) as Record<string, unknown>;

  const incoming = new Map<MaterialId, IncomingMaterial>();
  for (const [id, value] of Object.entries(entries)) {
    if (!isMaterialId(id)) {
      return NextResponse.json({ error: `invalid_material_id_${id}` }, { status: 400 });
    }
    const entry = value as Record<string, unknown> | undefined;
    if (!entry) {
      return NextResponse.json({ error: `missing_${id}` }, { status: 400 });
    }
    const marketPrice = parsePrice(entry.marketPrice);
    const customerPct = parsePct(entry.customerPct);
    if (marketPrice === null || customerPct === null) {
      return NextResponse.json({ error: `invalid_${id}` }, { status: 400 });
    }
    const active = entry.active === undefined ? true : Boolean(entry.active);
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 60) : undefined;
    let payoutMode: PayoutMode | undefined;
    if (entry.payoutMode !== undefined) {
      if (!isPayoutMode(entry.payoutMode)) {
        return NextResponse.json({ error: `invalid_payout_mode_${id}` }, { status: 400 });
      }
      payoutMode = entry.payoutMode;
    }
    let measurementMode: MeasurementMode | undefined;
    if (entry.measurementMode !== undefined) {
      if (!isMeasurementMode(entry.measurementMode)) {
        return NextResponse.json({ error: `invalid_measurement_mode_${id}` }, { status: 400 });
      }
      measurementMode = entry.measurementMode;
    }
    incoming.set(id, { marketPrice, customerPct, active, name, payoutMode, measurementMode });
  }

  if (incoming.size === 0) {
    return NextResponse.json({ error: 'no_materials' }, { status: 400 });
  }

  const priceHistoryRef = adminDb.collection('priceHistory').doc();
  const snapshot: Record<string, MaterialPricing> = {};
  await adminDb.runTransaction(async (tx) => {
    // Read existing docs first to preserve fields like displayOrder.
    const ids = Array.from(incoming.keys());
    const existingSnaps = await Promise.all(
      ids.map((id) => tx.get(adminDb.collection('materials').doc(id))),
    );

    let nextOrder = existingSnaps.reduce((max, snap) => {
      const v = snap.exists ? snap.get('displayOrder') : null;
      return typeof v === 'number' && v > max ? v : max;
    }, -1);

    ids.forEach((id, i) => {
      const entry = incoming.get(id)!;
      const existing = existingSnaps[i];
      const ref = adminDb.collection('materials').doc(id);
      const isNew = !existing.exists;
      const existingOrder = existing.exists ? existing.get('displayOrder') : null;
      const displayOrder =
        typeof existingOrder === 'number'
          ? existingOrder
          : (nextOrder = nextOrder + 1);
      const name =
        entry.name ??
        (existing.exists ? existing.get('name') : null) ??
        SEED_MATERIAL_DISPLAY_NAMES[id] ??
        id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      // Preserve existing modes if not in the payload; default new docs to cash/bag_weight.
      const existingPayoutMode = existing.exists ? existing.get('payoutMode') : null;
      const payoutMode: PayoutMode =
        entry.payoutMode ?? (isPayoutMode(existingPayoutMode) ? existingPayoutMode : 'cash');
      const existingMeasurementMode = existing.exists ? existing.get('measurementMode') : null;
      const measurementMode: MeasurementMode =
        entry.measurementMode ??
        (isMeasurementMode(existingMeasurementMode) ? existingMeasurementMode : 'bag_weight');

      tx.set(
        ref,
        {
          id,
          name,
          marketPrice: entry.marketPrice,
          customerPct: entry.customerPct,
          payoutMode,
          measurementMode,
          active: entry.active,
          displayOrder,
          ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.uid,
        },
        { merge: true },
      );

      snapshot[id] = {
        marketPrice: entry.marketPrice,
        customerPct: entry.customerPct,
      };
    });

    tx.set(priceHistoryRef, {
      id: priceHistoryRef.id,
      snapshot,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: session.uid,
    });
  });

  return NextResponse.json({ ok: true });
}

/**
 * Soft-delete a material — sets `active: false`. We don't hard-delete because
 * historical bagProcessing / inventory / millShipment docs reference the id.
 */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id || !isMaterialId(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const ref = adminDb.collection('materials').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await ref.update({
    active: false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  });
  return NextResponse.json({ ok: true });
}
