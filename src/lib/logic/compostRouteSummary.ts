import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { CompostRouteSummary } from '@/lib/types/compostRoute';

/** The fields of a bin pickup the run summary actually reads. */
type SummarizablePickup = Pick<
  BinPickupDoc,
  'action' | 'bins' | 'totalWeightLbs' | 'damaged' | 'needsCleaning'
>;

/**
 * Roll a run's bin pickups into the End-Route summary ("12 stops · 1 skipped ·
 * 18 carts swapped · 2,340 lbs · 1 damaged"). Pure so it powers both the live
 * tally on the operator screen and the frozen summary the End API stores.
 */
export function summarizeCompostRoute(pickups: SummarizablePickup[]): CompostRouteSummary {
  let stops = 0;
  let skipped = 0;
  let cartsSwapped = 0;
  let totalWeightLbs = 0;
  let damaged = 0;
  let needsCleaning = 0;

  for (const p of pickups) {
    stops += 1;
    // Legacy pickups without an action are treated as a normal collection ('swapped').
    const action = p.action ?? 'swapped';
    if (action === 'skipped') skipped += 1;
    // "Carts swapped" = bins given clean empties. Loaded stops dump-and-return
    // the same bins, so they aren't counted as swaps.
    if (action === 'swapped') cartsSwapped += Array.isArray(p.bins) ? p.bins.length : 0;
    totalWeightLbs += p.totalWeightLbs ?? 0;
    if (p.damaged) damaged += 1;
    if (p.needsCleaning) needsCleaning += 1;
  }

  return {
    stops,
    skipped,
    cartsSwapped,
    totalWeightLbs: Math.round(totalWeightLbs),
    damaged,
    needsCleaning,
  };
}
