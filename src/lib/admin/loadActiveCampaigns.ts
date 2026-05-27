import { unstable_cache } from 'next/cache';
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

export const CAMPAIGNS_CACHE_TAG = 'campaigns';

interface CampaignSnapshot {
  id: string;
  name: string;
  materialIds: string[];
  multiplier: number;
  startsAtMs: number;
  endsAtMs: number;
}

/**
 * Cached read of every campaign doc whose `active === true`. The `at` filter
 * happens in memory below so the cache key stays constant — otherwise every
 * `loadActiveCampaigns()` call would have a unique `Date` argument and miss
 * the cache. Invalidated by `/api/admin/pricing-campaigns` on write.
 */
const loadAllActiveCampaignSnapshots = unstable_cache(
  async (): Promise<CampaignSnapshot[]> => {
    const snap = await adminDb.collection('pricingCampaigns').where('active', '==', true).get();
    const out: CampaignSnapshot[] = [];
    for (const doc of snap.docs) {
      const data = doc.data() as PricingCampaignDoc;
      const startsAtMs = data.startsAt?.toDate?.()?.getTime();
      const endsAtMs = data.endsAt?.toDate?.()?.getTime();
      if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) continue;
      if (!Array.isArray(data.materialIds) || data.materialIds.length === 0) continue;
      if (!Number.isFinite(data.multiplier) || data.multiplier <= 0) continue;
      out.push({
        id: data.id,
        name: data.name,
        materialIds: [...data.materialIds],
        multiplier: data.multiplier,
        startsAtMs: startsAtMs!,
        endsAtMs: endsAtMs!,
      });
    }
    return out;
  },
  ['active-campaign-snapshots'],
  { tags: [CAMPAIGNS_CACHE_TAG], revalidate: 3600 },
);

/**
 * Returns campaigns whose [startsAt, endsAt] window contains `at` (defaults to
 * now). Backed by an in-memory filter over the cached snapshot.
 */
export async function loadActiveCampaigns(at: Date = new Date()): Promise<ActiveCampaign[]> {
  const snapshots = await loadAllActiveCampaignSnapshots();
  const atMs = at.getTime();
  const out: ActiveCampaign[] = [];
  for (const s of snapshots) {
    if (s.startsAtMs > atMs) continue;
    if (s.endsAtMs < atMs) continue;
    out.push({
      id: s.id,
      name: s.name,
      materialIds: s.materialIds,
      multiplier: s.multiplier,
      startsAt: new Date(s.startsAtMs),
      endsAt: new Date(s.endsAtMs),
    });
  }
  return out;
}
