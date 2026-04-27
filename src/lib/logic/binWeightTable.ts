/**
 * Bin-fullness → weight lookup for compost (food scrap) pickups.
 *
 * Source: Compost Clubhouse Collection Data spreadsheet, "Static Values" sheet,
 * with values verified by on-site weighing on 9/21/23 at City of Columbus sites.
 * The table is non-linear at the top — bins compact under their own weight
 * once past ~75%, so 100% weighs more than 4× the 25% value.
 *
 * Used by Phase B (operator-scan flow): driver picks bin size + a fullness bucket,
 * server multiplies by bin count to get total weight for the pickup.
 *
 * 48-gallon: only 100% is provided in the source (195 lbs). The intermediate
 * buckets are linearly interpolated until Tia's team measures them on-site.
 * Flagged with `interpolated: true` so reports can footnote the estimate.
 */

export const BIN_SIZES = ['32', '48', '64'] as const;
export type BinSize = (typeof BIN_SIZES)[number];

/** Fullness buckets the driver picks from. Stored as fraction 0..1 to match Dominique's sheet. */
export const FULLNESS_BUCKETS = [0, 0.25, 0.5, 0.75, 1] as const;
export type FullnessBucket = (typeof FULLNESS_BUCKETS)[number];

export function isBinSize(v: unknown): v is BinSize {
  return typeof v === 'string' && (BIN_SIZES as readonly string[]).includes(v);
}

export function isFullnessBucket(v: unknown): v is FullnessBucket {
  return typeof v === 'number' && (FULLNESS_BUCKETS as readonly number[]).includes(v);
}

interface BinWeightEntry {
  weightLbs: number;
  /** True when the value is interpolated rather than measured. */
  interpolated?: boolean;
}

/** weight per bin (lbs) at each fullness bucket, by bin size. */
export const BIN_WEIGHT_TABLE: Record<BinSize, Record<FullnessBucket, BinWeightEntry>> = {
  '32': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 30 },
    0.5: { weightLbs: 60 },
    0.75: { weightLbs: 90 },
    1: { weightLbs: 130 },
  },
  '48': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 48.75, interpolated: true },
    0.5: { weightLbs: 97.5, interpolated: true },
    0.75: { weightLbs: 146.25, interpolated: true },
    1: { weightLbs: 195 },
  },
  '64': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 60 },
    0.5: { weightLbs: 120 },
    0.75: { weightLbs: 180 },
    1: { weightLbs: 260 },
  },
};

export const BIN_DISPLAY_NAMES: Record<BinSize, string> = {
  '32': '32 Gallon',
  '48': '48 Gallon',
  '64': '64 Gallon',
};

/**
 * Total weight for a pickup, summed across one or more bins of the same size.
 * `fullnessPerBin` is an array of fullness buckets — one entry per bin. The
 * compost flow asks the driver to enter fullness per bin; this collapses to lbs.
 */
export function binFullnessToWeightLbs(
  binSize: BinSize,
  fullnessPerBin: readonly FullnessBucket[],
): number {
  const lookup = BIN_WEIGHT_TABLE[binSize];
  let total = 0;
  for (const f of fullnessPerBin) {
    total += lookup[f].weightLbs;
  }
  return total;
}

/**
 * 100%-full weight for a single bin. Used by the calculator + estimator views
 * that show "a full 32-gal bin = 130 lbs".
 */
export function fullBinWeightLbs(binSize: BinSize): number {
  return BIN_WEIGHT_TABLE[binSize][1].weightLbs;
}
