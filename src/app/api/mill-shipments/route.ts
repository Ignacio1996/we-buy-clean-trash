import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadManagedDepot } from '@/lib/auth/managerAccess';
import {
  MATERIAL_IDS,
  isMaterialId,
  type MaterialId,
} from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';

export const runtime = 'nodejs';

const MAX_SHIPMENT_WEIGHT_LBS = 50_000;

interface ParsedPayload {
  depotId: string;
  mill: string;
  scheduledFor: Date;
  weights: Partial<Record<MaterialId, number>>;
}

function parsePayload(raw: unknown): ParsedPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const depotId = typeof r.depotId === 'string' ? r.depotId.trim() : '';
  const mill = typeof r.mill === 'string' ? r.mill.trim() : '';
  const scheduledRaw = typeof r.scheduledFor === 'string' ? r.scheduledFor : '';
  if (!depotId || !mill || !scheduledRaw) return { error: 'invalid_payload' };
  const scheduledFor = new Date(scheduledRaw);
  if (Number.isNaN(scheduledFor.getTime())) return { error: 'invalid_scheduled_for' };

  const weightsRaw = r.weights;
  if (!weightsRaw || typeof weightsRaw !== 'object') return { error: 'invalid_weights' };
  const weights: Partial<Record<MaterialId, number>> = {};
  for (const [k, v] of Object.entries(weightsRaw)) {
    if (!isMaterialId(k)) return { error: 'unknown_material' };
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SHIPMENT_WEIGHT_LBS) {
      return { error: 'invalid_weight' };
    }
    if (n > 0) weights[k] = n;
  }
  if (Object.keys(weights).length === 0) return { error: 'no_weights' };
  return { depotId, mill, scheduledFor, weights };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'depot_manager') {
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

  const depot = await loadManagedDepot(session.uid, parsed.depotId);
  if (!depot) return NextResponse.json({ error: 'depot_not_found' }, { status: 404 });

  const shipmentRef = adminDb.collection('millShipments').doc();
  const inventoryRefs = Object.keys(parsed.weights).map((materialId) =>
    adminDb.collection('inventory').doc(`${parsed.depotId}_${materialId}`),
  );

  try {
    await adminDb.runTransaction(async (tx) => {
      const invSnaps = await Promise.all(inventoryRefs.map((ref) => tx.get(ref)));
      invSnaps.forEach((snap, i) => {
        const ref = inventoryRefs[i];
        const materialId = ref.id.slice(parsed.depotId.length + 1) as MaterialId;
        const requested = parsed.weights[materialId] ?? 0;
        const current = snap.exists ? ((snap.data() as InventoryDoc).weight ?? 0) : 0;
        if (current < requested) {
          throw new Error(`insufficient_inventory:${materialId}`);
        }
      });

      const fullWeights: Record<MaterialId, number> = {
        aluminum: 0,
        tin_steel: 0,
        cardboard: 0,
        paper: 0,
        pet: 0,
        hdpe: 0,
        mixed_plastic: 0,
      };
      for (const [k, v] of Object.entries(parsed.weights)) {
        fullWeights[k as MaterialId] = v ?? 0;
      }

      tx.create(shipmentRef, {
        id: shipmentRef.id,
        depotId: parsed.depotId,
        mill: parsed.mill,
        scheduledFor: Timestamp.fromDate(parsed.scheduledFor),
        weights: fullWeights,
        status: 'scheduled',
        createdBy: session.uid,
        createdAt: FieldValue.serverTimestamp(),
        pickedUpAt: null,
      });

      for (const [materialId, weight] of Object.entries(parsed.weights)) {
        if (!weight || weight <= 0) continue;
        const invRef = adminDb.collection('inventory').doc(`${parsed.depotId}_${materialId}`);
        tx.set(
          invRef,
          {
            id: `${parsed.depotId}_${materialId}`,
            depotId: parsed.depotId,
            materialId,
            weight: FieldValue.increment(-weight),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });

    return NextResponse.json({ ok: true, id: shipmentRef.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'mill_shipment_failed';
    if (msg.startsWith('insufficient_inventory:')) {
      return NextResponse.json(
        { error: 'insufficient_inventory', materialId: msg.split(':')[1] },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface PatchPayload {
  shipmentId: string;
  action: 'mark_picked_up' | 'cancel';
}

function parsePatch(raw: unknown): PatchPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const shipmentId = typeof r.shipmentId === 'string' ? r.shipmentId.trim() : '';
  if (!shipmentId) return { error: 'invalid_payload' };
  if (r.action !== 'mark_picked_up' && r.action !== 'cancel') {
    return { error: 'invalid_action' };
  }
  return { shipmentId, action: r.action };
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'depot_manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parsePatch(json);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const shipmentRef = adminDb.collection('millShipments').doc(parsed.shipmentId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(shipmentRef);
      if (!snap.exists) throw new Error('shipment_not_found');
      const shipment = snap.data() as {
        depotId: string;
        status: string;
        weights: Record<MaterialId, number>;
      };

      const depot = await loadManagedDepot(session.uid, shipment.depotId);
      if (!depot) throw new Error('depot_not_found');
      if (shipment.status !== 'scheduled') throw new Error('shipment_not_updatable');

      if (parsed.action === 'mark_picked_up') {
        tx.update(shipmentRef, {
          status: 'picked_up',
          pickedUpAt: FieldValue.serverTimestamp(),
        });
      } else {
        // cancel: restore inventory that was decremented at schedule time
        tx.update(shipmentRef, { status: 'cancelled' });
        for (const materialId of MATERIAL_IDS) {
          const weight = shipment.weights?.[materialId] ?? 0;
          if (weight <= 0) continue;
          const invRef = adminDb
            .collection('inventory')
            .doc(`${shipment.depotId}_${materialId}`);
          tx.set(
            invRef,
            {
              id: `${shipment.depotId}_${materialId}`,
              depotId: shipment.depotId,
              materialId,
              weight: FieldValue.increment(weight),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'mill_shipment_update_failed';
    const status =
      msg === 'shipment_not_found' || msg === 'depot_not_found'
        ? 404
        : msg === 'shipment_not_updatable'
          ? 409
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
