import type { Timestamp } from 'firebase-admin/firestore';

/**
 * A composting facility the compost route delivers to (e.g. Alum Creek, London).
 * The operator picks one when marking "heading to drop-off"; if `smsEnabled` is
 * on and a `contactPhone` is set, that facility gets an automatic "on the way"
 * text. (London is a prison — keep SMS off there.)
 */
export interface CompostDestinationDoc {
  id: string;
  name: string;
  zoneId: string;
  contactName: string | null;
  contactPhone: string | null;
  /** When true (and contactPhone set), the facility contact gets the on-the-way SMS. */
  smsEnabled: boolean;
  /** Soft-delete flag — kept off the operator picker when false. */
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
