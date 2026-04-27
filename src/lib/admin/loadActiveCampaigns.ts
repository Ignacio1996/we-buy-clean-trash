import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { PricingCampaignDoc } from '@/lib/types/pricingCampaign';

export interface ActiveCampaign {
  id: string;
  name: string;
  materialIds: string[];
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Returns campaigns whose active flag is true and whose [startsAt, endsAt]
 * window contains `at` (defaults to now).
 */
export async function loadActiveCampaigns(at: Date = new Date()): Promise<ActiveCampaign[]> {
  const ts = Timestamp.fromDate(at);
  // Filter on `endsAt >= now` first (cheapest); apply `startsAt <= now` and
  // `active` in code so we don't need a composite index for the pilot.
  const snap = await adminDb
    .collection('pricingCampaigns')
    .where('endsAt', '>=', ts)
    .get();
  const out: ActiveCampaign[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as PricingCampaignDoc;
    if (!data.active) continue;
    const startsAt = data.startsAt?.toDate?.();
    const endsAt = data.endsAt?.toDate?.();
    if (!startsAt || !endsAt) continue;
    if (startsAt > at) continue;
    if (!Array.isArray(data.materialIds) || data.materialIds.length === 0) continue;
    if (!Number.isFinite(data.multiplier) || data.multiplier <= 0) continue;
    out.push({
      id: data.id,
      name: data.name,
      materialIds: [...data.materialIds],
      multiplier: data.multiplier,
      startsAt,
      endsAt,
    });
  }
  return out;
}
