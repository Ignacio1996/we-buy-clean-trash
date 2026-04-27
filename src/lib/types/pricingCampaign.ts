import type { Timestamp } from 'firebase-admin/firestore';
import type { MaterialId } from './material';

/**
 * Time-bounded global pricing campaign. Multiplies the dollar value of the
 * listed materials before the separated/contamination math is applied. Anyone
 * recycling those materials during the active window gets the bonus.
 *
 * Campaigns are not zone-scoped in the pilot — Kirk confirmed campaigns are
 * applied platform-wide.
 */
export interface PricingCampaignDoc {
  id: string;
  name: string;
  /** Which materials this multiplier targets. Empty array = all materials (rare; prefer explicit). */
  materialIds: MaterialId[];
  /** e.g. 2.0 doubles those materials' contribution. Must be > 0. */
  multiplier: number;
  startsAt: Timestamp;
  endsAt: Timestamp;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

/**
 * Reduce a list of campaigns into a per-material multiplier map. When multiple
 * active campaigns target the same material, multipliers compound.
 */
export function buildMaterialMultipliers(
  campaigns: { materialIds: string[]; multiplier: number }[],
): Record<MaterialId, number> {
  const out: Record<string, number> = {};
  for (const c of campaigns) {
    for (const id of c.materialIds) {
      out[id] = (out[id] ?? 1) * c.multiplier;
    }
  }
  return out;
}
