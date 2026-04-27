import type { Timestamp } from 'firebase-admin/firestore';
import type { BinSize, FullnessBucket } from '@/lib/logic/binWeightTable';
import type { ContaminationSeverity, MaterialId } from './material';

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
  bins: BinPickupBinEntry[];
  /** Sum of bins[].weightLbs. Stored to avoid recomputation in reports. */
  totalWeightLbs: number;
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
