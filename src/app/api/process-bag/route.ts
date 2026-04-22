import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { calculatePoints } from '@/lib/logic/calculatePoints';
import { sendSMS } from '@/lib/sms/send';
import {
  MATERIAL_IDS,
  isContaminationSeverity,
  isMaterialId,
  type ContaminationSeverity,
  type MaterialDoc,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';

export const runtime = 'nodejs';

const MAX_WEIGHT_PER_MATERIAL_LBS = 200;

interface ProcessPayload {
  bagId: string;
  weights: Partial<Record<MaterialId, number>>;
  contaminationSeverity: ContaminationSeverity;
}

function parsePayload(raw: unknown): ProcessPayload | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'invalid_payload' };
  const r = raw as Record<string, unknown>;
  const bagId = typeof r.bagId === 'string' ? r.bagId.trim() : '';
  if (!bagId) return { error: 'invalid_bag_id' };
  if (!isContaminationSeverity(r.contaminationSeverity)) {
    return { error: 'invalid_contamination' };
  }
  const weightsRaw = r.weights;
  if (!weightsRaw || typeof weightsRaw !== 'object') return { error: 'invalid_weights' };
  const weights: Partial<Record<MaterialId, number>> = {};
  for (const [k, v] of Object.entries(weightsRaw)) {
    if (!isMaterialId(k)) return { error: 'unknown_material' };
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_PER_MATERIAL_LBS) {
      return { error: 'invalid_weight' };
    }
    if (n > 0) weights[k] = n;
  }
  if (Object.keys(weights).length === 0) return { error: 'no_weights' };
  return { bagId, weights, contaminationSeverity: r.contaminationSeverity };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'depot_worker') {
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

  const depotRes = await loadDepotContext(session.uid);
  if (!depotRes.ok) {
    return NextResponse.json({ error: depotRes.error }, { status: 403 });
  }
  const depotId = depotRes.context.depot.id;

  const bagProcessingRef = adminDb.collection('bagProcessing').doc();
  const transactionRef = adminDb.collection('transactions').doc();
  const bagRef = adminDb.collection('bags').doc(parsed.bagId);
  const materialRefs = MATERIAL_IDS.map((id) => adminDb.collection('materials').doc(id));

  let pointsAwarded = 0;
  let residentPhone: string | null = null;
  let residentId = '';
  let printedNumber = '';

  try {
    const txResult = await adminDb.runTransaction(async (tx) => {
      const [bagSnap, ...materialSnaps] = await Promise.all([
        tx.get(bagRef),
        ...materialRefs.map((ref) => tx.get(ref)),
      ]);
      if (!bagSnap.exists) throw new Error('bag_not_found');
      const bag = bagSnap.data() as BagDoc;
      if (bag.status !== 'picked_up') throw new Error('bag_not_processable');
      if (!bag.residentId) throw new Error('bag_not_assigned');

      const priceSnapshot = {} as Record<MaterialId, MaterialPricing>;
      materialSnaps.forEach((snap, i) => {
        if (!snap.exists) throw new Error('material_missing');
        const doc = snap.data() as MaterialDoc;
        priceSnapshot[MATERIAL_IDS[i]] = {
          marketPrice: doc.marketPrice,
          customerPct: doc.customerPct,
        };
      });

      const residentRef = adminDb.collection('users').doc(bag.residentId);
      const residentSnap = await tx.get(residentRef);
      if (!residentSnap.exists) throw new Error('resident_not_found');
      const resident = residentSnap.data() as UserDoc;

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

      const separated = bag.declaredType === 'separated';
      const breakdown = calculatePoints({
        weights: fullWeights,
        materials: priceSnapshot,
        separated,
        contaminationSeverity: parsed.contaminationSeverity,
      });
      const awarded = breakdown.pointsAwarded;
      const balanceAfter = (resident.pointsBalance ?? 0) + awarded;

      tx.create(bagProcessingRef, {
        id: bagProcessingRef.id,
        bagId: bag.id,
        residentId: bag.residentId,
        depotId,
        depotWorkerId: session.uid,
        weights: fullWeights,
        separated,
        contaminationSeverity: parsed.contaminationSeverity,
        pointsAwarded: awarded,
        priceSnapshot,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(transactionRef, {
        id: transactionRef.id,
        userId: bag.residentId,
        type: 'pickup',
        pointsDelta: awarded,
        balanceAfter,
        relatedDocId: bagProcessingRef.id,
        description: `Bag ${bag.printedNumber} processed`,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(residentRef, {
        pointsBalance: FieldValue.increment(awarded),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(bagRef, { status: 'processed' });

      for (const [materialId, weight] of Object.entries(parsed.weights)) {
        if (!weight || weight <= 0) continue;
        const invRef = adminDb.collection('inventory').doc(`${depotId}_${materialId}`);
        tx.set(
          invRef,
          {
            id: `${depotId}_${materialId}`,
            depotId,
            materialId,
            weight: FieldValue.increment(weight),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return {
        awarded,
        phone: resident.phone,
        residentId: bag.residentId,
        printedNumber: bag.printedNumber,
        breakdown,
      };
    });

    pointsAwarded = txResult.awarded;
    residentPhone = txResult.phone;
    residentId = txResult.residentId;
    printedNumber = txResult.printedNumber;

    // Send SMS outside the transaction. Swallow errors so the points award
    // stays committed even if the stub write fails.
    if (residentPhone) {
      try {
        await sendSMS({
          toPhone: residentPhone,
          body: `Your bag #${printedNumber} was processed. +${pointsAwarded.toLocaleString()} points added to your balance.`,
          purpose: 'bag_processed',
          relatedDocId: bagProcessingRef.id,
        });
      } catch (err) {
        console.error('[process-bag] sendSMS stub failed', err);
      }
    }

    return NextResponse.json({
      ok: true,
      pointsAwarded,
      bagProcessingId: bagProcessingRef.id,
      residentId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'process_bag_failed';
    const status =
      msg === 'bag_not_found' || msg === 'resident_not_found'
        ? 404
        : msg === 'bag_not_processable'
          ? 409
          : msg === 'material_missing'
            ? 500
            : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
