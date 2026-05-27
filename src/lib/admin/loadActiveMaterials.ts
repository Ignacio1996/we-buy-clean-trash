import { unstable_cache } from 'next/cache';
import { adminDb } from '@/lib/firebase/admin';
import {
  SEED_MATERIAL_IDS,
  SEED_MATERIAL_DISPLAY_NAMES,
  isMeasurementMode,
  isPayoutMode,
  type MaterialId,
  type MeasurementMode,
  type PayoutMode,
} from '@/lib/types/material';

export const MATERIALS_CACHE_TAG = 'materials';

export interface ActiveMaterial {
  id: MaterialId;
  name: string;
  marketPrice: number;
  customerPct: number;
  displayOrder: number;
  payoutMode: PayoutMode;
  measurementMode: MeasurementMode;
}

/**
 * Loads all materials marked `active: true`, sorted by displayOrder. Falls back
 * to the seed set if the materials collection is empty (fresh DB before seed).
 * Legacy docs without `active` are treated as active.
 *
 * Cached across requests; invalidated immediately when admin writes to the
 * materials collection (see `/api/admin/materials` calling
 * `revalidateTag(MATERIALS_CACHE_TAG)`).
 */
export const loadActiveMaterials = unstable_cache(
  async (): Promise<ActiveMaterial[]> => {
    const snap = await adminDb.collection('materials').get();
    if (snap.empty) {
      return SEED_MATERIAL_IDS.map((id, i) => ({
        id,
        name: SEED_MATERIAL_DISPLAY_NAMES[id]!,
        marketPrice: 0,
        customerPct: 0.3,
        displayOrder: i,
        payoutMode: 'cash' as PayoutMode,
        measurementMode: 'bag_weight' as MeasurementMode,
      }));
    }
    const out: ActiveMaterial[] = [];
    snap.docs.forEach((d, i) => {
      const data = d.data();
      const active = data.active === undefined ? true : Boolean(data.active);
      if (!active) return;
      out.push({
        id: d.id as MaterialId,
        name:
          typeof data.name === 'string' && data.name.trim()
            ? data.name
            : (SEED_MATERIAL_DISPLAY_NAMES[d.id as MaterialId] ?? d.id),
        marketPrice: typeof data.marketPrice === 'number' ? data.marketPrice : 0,
        customerPct: typeof data.customerPct === 'number' ? data.customerPct : 0,
        displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : i,
        payoutMode: isPayoutMode(data.payoutMode) ? data.payoutMode : 'cash',
        measurementMode: isMeasurementMode(data.measurementMode)
          ? data.measurementMode
          : 'bag_weight',
      });
    });
    out.sort((a, b) => a.displayOrder - b.displayOrder);
    return out;
  },
  ['active-materials'],
  { tags: [MATERIALS_CACHE_TAG], revalidate: 3600 },
);
