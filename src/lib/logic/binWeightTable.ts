/**
 * Bin-fullness → weight lookup for compost (food scrap) pickups.
 *
 * Source: Compost Clubhouse Collection Data spreadsheet. We deliberately mirror
 * the column her monthly reports actually aggregate — "Alternative Weight" in
 * the Form Responses sheet — which is the LINEAR model:
 *
 *     weight = binCount × fullnessFraction × fullBinWeight
 *     fullBinWeight = { 32: 130, 48: 195, 64: 260 } lbs   ("Static Values" sheet)
 *
 * So each bucket below is simply `fullnessFraction × fullBinWeight`. This makes
 * the app reproduce Tia's three-year reporting history exactly. (Her sheet also
 * has a second "Weight" column built on a stepped 32-gal-only bucket table, but
 * the reports do NOT use it — see "Compost Integration - Phase C.md".)
 *
 * Used by the operator-scan flow: driver picks bin size + a fullness bucket,
 * server multiplies by bin count to get total weight for the pickup.
 *
 * The `interpolated` flag on each entry is retained for historical records and
 * for a future per-bucket measured override, but no entry sets it today — the
 * linear model is the intended source of truth, not a placeholder estimate.
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
/** 100%-full weight per bin size (lbs), from the "Static Values" sheet. */
export const FULL_BIN_WEIGHT_LBS: Record<BinSize, number> = {
  '32': 130,
  '48': 195,
  '64': 260,
};

/**
 * weight per bin (lbs) at each fullness bucket, by bin size.
 * Linear: each value is `fullnessFraction × FULL_BIN_WEIGHT_LBS[size]`,
 * matching the "Alternative Weight" column Tia's reports aggregate.
 */
export const BIN_WEIGHT_TABLE: Record<BinSize, Record<FullnessBucket, BinWeightEntry>> = {
  '32': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 32.5 },
    0.5: { weightLbs: 65 },
    0.75: { weightLbs: 97.5 },
    1: { weightLbs: 130 },
  },
  '48': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 48.75 },
    0.5: { weightLbs: 97.5 },
    0.75: { weightLbs: 146.25 },
    1: { weightLbs: 195 },
  },
  '64': {
    0: { weightLbs: 0 },
    0.25: { weightLbs: 65 },
    0.5: { weightLbs: 130 },
    0.75: { weightLbs: 195 },
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
