import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { calculatePoints } from '@/lib/logic/calculatePoints';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { ADMIN_KPIS_CACHE_TAG } from '@/lib/admin/dashboard';
import { buildMaterialMultipliers } from '@/lib/types/pricingCampaign';
import { sendSMS } from '@/lib/sms/send';
import {
  isContaminationSeverity,
  isMaterialId,
  isPayoutMode,
  type ContaminationSeverity,
  type MaterialDoc,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';

const MAX_WEIGHT_PER_MATERIAL_LBS = 200;

interface ProcessPayload {
  bagId: string;
  weights: Partial<Record<MaterialId, number>>;
  contaminationSeverity: ContaminationSeverity;
  commingled: boolean;
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
  const commingled = r.commingled === true;
  return { bagId, weights, contaminationSeverity: r.contaminationSeverity, commingled };
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

  // Resolve allowed material ids from the live, active materials list intersected
  // with this depot's accepted-materials set. Load active campaigns at the same
  // time so the multipliers can be snapshotted onto the bagProcessing doc.
  const [allMaterialsSnap, activeCampaigns] = await Promise.all([
    adminDb.collection('materials').get(),
    loadActiveCampaigns(),
  ]);
  const activeMaterialIds = allMaterialsSnap.docs
    .filter((d) => {
      const a = d.get('active');
      return a === undefined || a === true;
    })
    .map((d) => d.id);
  const accepted = new Set(
    resolveAcceptedMaterials(depotRes.context.depot, activeMaterialIds),
  );
  for (const id of Object.keys(parsed.weights)) {
    if (!accepted.has(id)) {
      return NextResponse.json({ error: `material_not_accepted_${id}` }, { status: 400 });
    }
  }
  const materialMultipliers = buildMaterialMultipliers(activeCampaigns);
  const appliedCampaigns = activeCampaigns
    .filter((c) => c.materialIds.some((id) => parsed.weights[id] !== undefined))
    .map((c) => ({
      id: c.id,
      name: c.name,
      multiplier: c.multiplier,
      materialIds: c.materialIds,
    }));

  const bagProcessingRef = adminDb.collection('bagProcessing').doc();
  const transactionRef = adminDb.collection('transactions').doc();
  const bagRef = adminDb.collection('bags').doc(parsed.bagId);
  // Only fetch pricing for the materials that were actually submitted.
  const submittedMaterialIds = Object.keys(parsed.weights);
  const materialRefs = submittedMaterialIds.map((id) =>
    adminDb.collection('materials').doc(id),
  );

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

      const priceSnapshot: Record<MaterialId, MaterialPricing> = {};
      materialSnaps.forEach((snap, i) => {
        if (!snap.exists) throw new Error('material_missing');
        const doc = snap.data() as MaterialDoc;
        priceSnapshot[submittedMaterialIds[i]] = {
          marketPrice: doc.marketPrice,
          customerPct: doc.customerPct,
          payoutMode: isPayoutMode(doc.payoutMode) ? doc.payoutMode : 'cash',
        };
      });

      const residentRef = adminDb.collection('users').doc(bag.residentId);
      const residentSnap = await tx.get(residentRef);
      if (!residentSnap.exists) throw new Error('resident_not_found');
      const resident = residentSnap.data() as UserDoc;

      const fullWeights: Record<MaterialId, number> = {};
      for (const id of submittedMaterialIds) fullWeights[id] = 0;
      for (const [k, v] of Object.entries(parsed.weights)) {
        fullWeights[k] = v ?? 0;
      }

      // Commingled bags can't be sorted, so the resident gets credit for the
      // diversion (weight + inventory) but no points — overrides the math.
      const separated = !parsed.commingled && bag.declaredType === 'separated';
      const breakdown = calculatePoints({
        weights: fullWeights,
        materials: priceSnapshot,
        separated,
        contaminationSeverity: parsed.contaminationSeverity,
        materialMultipliers,
      });
      const awarded = parsed.commingled ? 0 : breakdown.pointsAwarded;
      const balanceAfter = (resident.pointsBalance ?? 0) + awarded;

      tx.create(bagProcessingRef, {
        id: bagProcessingRef.id,
        bagId: bag.id,
        residentId: bag.residentId,
        depotId,
        depotWorkerId: session.uid,
        weights: fullWeights,
        separated,
        commingled: parsed.commingled,
        contaminationSeverity: parsed.contaminationSeverity,
        pointsAwarded: awarded,
        priceSnapshot,
        appliedCampaigns,
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

    revalidateTag(ADMIN_KPIS_CACHE_TAG, 'default');
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
