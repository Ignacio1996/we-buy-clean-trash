import type { Timestamp } from 'firebase-admin/firestore';
import type { ContaminationSeverity } from './material';

/**
 * A recycling/trash cart check recorded by the driver at a `recycling_check`
 * site (e.g. Dora Lofts). The analogue of a bin pickup for non-compost stops —
 * it attaches to the open compost run, but records cart condition + a photo
 * instead of weight/fullness. Never touches inventory or the diversion ledger.
 */
export const CART_STATUSES = ['collected', 'not_needed', 'skipped'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export function isCartStatus(value: unknown): value is CartStatus {
  return typeof value === 'string' && (CART_STATUSES as readonly string[]).includes(value);
}

export const CART_STATUS_LABELS: Record<CartStatus, string> = {
  collected: 'Collected',
  not_needed: 'Not needed',
  skipped: 'Skipped',
};

export interface SiteCheckDoc {
  id: string;
  commercialAccountId: string;
  zoneId: string;
  operatorId: string;
  /** The open compost run this check was recorded under; null if ad-hoc. */
  routeId: string | null;
  cartStatus: CartStatus;
  /** Driver assessment of recycling cart contamination. */
  contaminationSeverity: ContaminationSeverity;
  /** Cart(s) overflowing / lid won't close. */
  overflow: boolean;
  driverNotes: string | null;
  photoUrl: string | null;
  createdAt: Timestamp;
}
