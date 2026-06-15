import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireRole } from '@/lib/auth/session';
import type { BagProcessingDoc } from '@/lib/types/bagProcessing';
import type { MaterialId } from '@/lib/types/material';
import { calculateImpact, type ImpactTotals } from '@/lib/logic/impactFactors';

export interface ResidentImpactPayload extends ImpactTotals {
  /** Number of processed bags counted into these totals. */
  bagsProcessed: number;
}

/**
 * Aggregate the resident's per-material recycled weights (from their processed
 * bags) into environmental-impact totals. Pilot-scale: reads all of the
 * resident's bagProcessing docs and sums in memory.
 */
export async function GET() {
  const session = await requireRole('resident');
  const uid = session.uid;

  const snap = await adminDb
    .collection('bagProcessing')
    .where('residentId', '==', uid)
    .get();

  const weights: Partial<Record<MaterialId, number>> = {};
  for (const d of snap.docs) {
    const bp = d.data() as BagProcessingDoc;
    for (const [id, w] of Object.entries(bp.weights ?? {})) {
      weights[id] = (weights[id] ?? 0) + (typeof w === 'number' ? w : 0);
    }
  }

  const totals = calculateImpact(weights);
  const payload: ResidentImpactPayload = { ...totals, bagsProcessed: snap.size };

  return NextResponse.json(payload, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
