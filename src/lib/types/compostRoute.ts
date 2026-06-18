import type { Timestamp } from 'firebase-admin/firestore';

/**
 * A compost route is "the driver's day" (Phase D, D1.3) — one record per run.
 * The operator taps *Start Route* at shift start, every `binPickup` recorded
 * while it is open carries its `routeId`, and *End Route* freezes a `summary`.
 *
 * Single-driver for the pilot: there is no dispatch/assignment — the run simply
 * belongs to whichever operator started it. (Multi-driver is out of scope until
 * Tia hires a second driver — see planning/Compost Integration - Phase D.md.)
 */
export const COMPOST_ROUTE_STATUSES = ['in_progress', 'completed'] as const;
export type CompostRouteStatus = (typeof COMPOST_ROUTE_STATUSES)[number];

/** End-of-run tallies computed from the route's bin pickups. */
export interface CompostRouteSummary {
  /** Stops recorded on the run (one per pickup doc). */
  stops: number;
  /** Stops where `action === 'skipped'`. */
  skipped: number;
  /** Bins given clean empties — sum of `bins[]` across `action === 'swapped'` stops. */
  cartsSwapped: number;
  /** Sum of `totalWeightLbs` across the run (lbs collected), rounded. */
  totalWeightLbs: number;
  /** Stops flagged `damaged`. */
  damaged: number;
  /** Stops flagged `needsCleaning`. */
  needsCleaning: number;
}

export interface CompostRouteDoc {
  id: string;
  /** Operator's zone at start; null if the operator has no zone. */
  zoneId: string | null;
  operatorId: string;
  /** Columbus-local calendar day the run belongs to, "YYYY-MM-DD". */
  date: string;
  status: CompostRouteStatus;
  startedAt: Timestamp;
  /** Set when the run is ended; null while in progress. */
  endedAt: Timestamp | null;
  /** Frozen at End Route; null while in progress. */
  summary: CompostRouteSummary | null;
}
