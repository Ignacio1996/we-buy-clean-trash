import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Material IDs are now dynamic strings keyed by Firestore doc id. The list
 * below is the canonical *seed* set the app ships with — admins can add more
 * via the pricing UI (e.g. compost, textile, electronics) and toggle existing
 * ones inactive when a commodity market crashes.
 *
 * IDs must match /^[a-z0-9_]{2,40}$/ so they're URL/Firestore-safe.
 */
export const SEED_MATERIAL_IDS = [
  'aluminum',
  'tin_steel',
  'cardboard',
  'paper',
  'pet',
  'hdpe',
  'mixed_plastic',
] as const;

/** Back-compat alias — most consumers still use MATERIAL_IDS for the seed loop. */
export const MATERIAL_IDS: readonly string[] = SEED_MATERIAL_IDS;

export type MaterialId = string;

const MATERIAL_ID_PATTERN = /^[a-z0-9_]{2,40}$/;

export function isMaterialId(value: unknown): value is MaterialId {
  return typeof value === 'string' && MATERIAL_ID_PATTERN.test(value);
}

/** Human-readable names for the seed set. Custom materials store their own name on the doc. */
export const SEED_MATERIAL_DISPLAY_NAMES: Record<string, string> = {
  aluminum: 'Aluminum',
  tin_steel: 'Tin / Steel',
  cardboard: 'Cardboard',
  paper: 'Paper',
  pet: 'PET',
  hdpe: 'HDPE',
  mixed_plastic: 'Mixed Plastic',
};

/** @deprecated Use the `name` field on MaterialDoc; falls back to seed names for legacy lookups. */
export const MATERIAL_DISPLAY_NAMES = SEED_MATERIAL_DISPLAY_NAMES;

/**
 * `cash` — material pays points (existing recyclables flow).
 * `diversion_only` — weight is recorded for landfill-diversion reporting, no points.
 *   Used for compost (food scrap), textiles, electronics, clothing donations,
 *   commingled bags, etc. Pricing fields are ignored by `calculatePoints`.
 */
export const PAYOUT_MODES = ['cash', 'diversion_only'] as const;
export type PayoutMode = (typeof PAYOUT_MODES)[number];

export function isPayoutMode(value: unknown): value is PayoutMode {
  return typeof value === 'string' && (PAYOUT_MODES as readonly string[]).includes(value);
}

/**
 * `bag_weight` — depot worker enters lbs per material on the scale (existing flow).
 * `bin_fullness` — driver picks bin size + fullness bucket; weight is derived from
 *   the binWeightTable lookup. Used for the compost flow where pickups are by-the-bin.
 */
export const MEASUREMENT_MODES = ['bag_weight', 'bin_fullness'] as const;
export type MeasurementMode = (typeof MEASUREMENT_MODES)[number];

export function isMeasurementMode(value: unknown): value is MeasurementMode {
  return typeof value === 'string' && (MEASUREMENT_MODES as readonly string[]).includes(value);
}

export interface MaterialPricing {
  marketPrice: number;
  customerPct: number;
  /**
   * Optional on legacy snapshots; absent === 'cash' for back-compat. Snapshotted
   * onto bagProcessing so historical records reflect the mode at the time.
   */
  payoutMode?: PayoutMode;
}

export interface MaterialDoc extends MaterialPricing {
  id: MaterialId;
  name: string;
  /** Soft-delete flag — inactive materials don't appear on the yellow sheet, calculator, or processing form. */
  active: boolean;
  /** Display ordering on lists; lower = earlier. Defaults to insertion order for legacy docs. */
  displayOrder: number;
  payoutMode: PayoutMode;
  measurementMode: MeasurementMode;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface PriceHistoryDoc {
  id: string;
  snapshot: Record<MaterialId, MaterialPricing>;
  createdAt: Timestamp;
  createdBy: string;
}

export const CONTAMINATION_SEVERITIES = ['none', 'minor', 'major', 'severe'] as const;
export type ContaminationSeverity = (typeof CONTAMINATION_SEVERITIES)[number];

export function isContaminationSeverity(value: unknown): value is ContaminationSeverity {
  return (
    typeof value === 'string' && (CONTAMINATION_SEVERITIES as readonly string[]).includes(value)
  );
}

export const CONTAMINATION_PENALTY: Record<ContaminationSeverity, number> = {
  none: 0,
  minor: 0.3,
  major: 0.6,
  severe: 0.9,
};
