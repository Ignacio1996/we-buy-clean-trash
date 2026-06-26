import type { Timestamp } from 'firebase-admin/firestore';
import type { BinSize, FullnessBucket } from '@/lib/logic/binWeightTable';
import type { ContaminationSeverity, MaterialId } from './material';

/**
 * What happened at the stop.
 * - `swapped`: gave clean empty bins, took the full ones (the normal Compost
 *   Clubhouse operation — records weight).
 * - `loaded`: dumped contents into the truck and set the same bins back
 *   (records weight). Kept distinct from swap because it tells the office the
 *   bins did NOT leave the site.
 * - `skipped`: nothing collected — requires a reason, records no weight, and is
 *   logged so the stop doesn't read as a missed pickup.
 */
export const BIN_PICKUP_ACTIONS = ['swapped', 'loaded', 'skipped'] as const;
export type BinPickupAction = (typeof BIN_PICKUP_ACTIONS)[number];

export function isBinPickupAction(value: unknown): value is BinPickupAction {
  return (
    typeof value === 'string' && (BIN_PICKUP_ACTIONS as readonly string[]).includes(value)
  );
}

/** Canonical reasons a stop gets skipped (Tia's top reasons). */
export const COMPOST_SKIP_REASONS = [
  'facility_closed',
  'no_access',
  'blocked',
  'weather',
  'other',
] as const;
export type CompostSkipReason = (typeof COMPOST_SKIP_REASONS)[number];

export const COMPOST_SKIP_REASON_LABELS: Record<CompostSkipReason, string> = {
  facility_closed: 'Facility closed',
  no_access: 'No access to bin',
  blocked: 'Bin blocked',
  weather: 'Weather',
  other: 'Other',
};

export function isCompostSkipReason(value: unknown): value is CompostSkipReason {
  return (
    typeof value === 'string' && (COMPOST_SKIP_REASONS as readonly string[]).includes(value)
  );
}

/**
 * How the pickup's weight was captured.
 * - `fullness` (default): bins[] × binWeightTable — the compost food-scrap flow.
 * - `weighed`: a measured net weight (gross tote − tare) entered directly by the
 *   driver — the reusable-tote recycling flow (`recycling_weighed` sites). No
 *   fullness buckets; `bins[]` is empty and `totalWeightLbs` is the net.
 * Legacy docs without this field are `fullness`.
 */
export const BIN_PICKUP_CAPTURE_MODES = ['fullness', 'weighed'] as const;
export type BinPickupCaptureMode = (typeof BIN_PICKUP_CAPTURE_MODES)[number];

export function isBinPickupCaptureMode(value: unknown): value is BinPickupCaptureMode {
  return (
    typeof value === 'string' && (BIN_PICKUP_CAPTURE_MODES as readonly string[]).includes(value)
  );
}

/**
 * Operator-recorded pickup at a commercial site. One doc per pickup event,
 * regardless of how many bins were emptied. The driver scans the bin QR (or
 * picks the site from the route), then enters fullness per bin.
 *
 * For multi-bin sites, `bins[]` holds one entry per bin. The server multiplies
 * each entry through binWeightTable to compute total weight.
 *
 * This is the bin-flow analogue of bagProcessing — both write into inventory
 * and the diversion ledger, but bin pickups never award points (food_scrap
 * is diversion_only). Kept as a separate doc type because the inputs differ
 * fundamentally from bag-weight processing.
 */
export interface BinPickupBinEntry {
  /** Bag doc id of the reusable bin container. Optional when the driver enters bins manually without scanning each one. */
  bagId: string | null;
  binSize: BinSize;
  fullness: FullnessBucket;
  /** Weight in lbs computed from binWeightTable[binSize][fullness] at write time. */
  weightLbs: number;
  /** True when the lookup value was interpolated rather than measured (48-gal intermediates). */
  interpolated: boolean;
}

export interface BinPickupDoc {
  id: string;
  commercialAccountId: string;
  zoneId: string;
  operatorId: string;
  /** When set, ties this pickup to a planned route stop. Null for ad-hoc pickups. */
  routeId: string | null;
  /** The material picked up — almost always 'food_scrap' but kept generic. */
  materialId: MaterialId;
  /**
   * What happened at the stop. Legacy pickups recorded before this field exists
   * are treated as 'swapped' (a normal collection) by readers.
   */
  action: BinPickupAction;
  /** Required when `action === 'skipped'`; null otherwise. */
  skipReason: CompostSkipReason | null;
  bins: BinPickupBinEntry[];
  /** Sum of bins[].weightLbs (fullness mode) or the measured net (weighed mode). 0 for skipped stops. */
  totalWeightLbs: number;
  /**
   * How weight was captured. Absent/`fullness` = the bin-fullness compost flow.
   * `weighed` = direct net weight from a reusable tote (recycling_weighed sites).
   */
  captureMode?: BinPickupCaptureMode;
  /** Weighed mode only: gross weight of the full tote in lbs. Null otherwise. */
  grossWeightLbs?: number | null;
  /** Weighed mode only: tare (empty tote) weight in lbs. Null otherwise. */
  tareWeightLbs?: number | null;
  /** Weighed mode only: bag/bin doc id of the reusable tote the driver scanned. Null otherwise. */
  binBagId?: string | null;
  /**
   * Driver flagged the bin(s) as needing the mobile cart-cleaning truck. Feeds
   * the admin cleaning queue. Defaults to false.
   */
  needsCleaning: boolean;
  /** Driver flagged a bin as damaged / needing replacement. Defaults to false. */
  damaged: boolean;
  /**
   * Contamination severity at the bin level (driver assessment). Most compost
   * pickups are 'none'; flagged when a bin has obvious non-organics.
   */
  contaminationSeverity: ContaminationSeverity;
  driverNotes: string | null;
  /** Optional photo of the bin(s) — same convention as residential pickups. */
  photoUrl: string | null;
  createdAt: Timestamp;
}
