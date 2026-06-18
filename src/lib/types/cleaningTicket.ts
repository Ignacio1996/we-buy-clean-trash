import type { Timestamp } from 'firebase-admin/firestore';

/**
 * A bin-cleaning ticket raised when a driver flags a stop as `needsCleaning` on
 * the compost run. Turns the on-route flag into something actionable — the admin
 * cleaning queue lists open tickets so the mobile cart-cleaning truck can be
 * scheduled proactively instead of waiting for a complaint.
 *
 * One ticket per flagged pickup (doc id == pickup id). Cleaning happens per
 * site ("we clean them all"), so the queue groups open tickets by site and
 * resolving a site closes every open ticket for it. This is the manual bridge
 * until the Jobber integration creates real cleaning jobs.
 */
export const CLEANING_TICKET_STATUSES = ['open', 'done'] as const;
export type CleaningTicketStatus = (typeof CLEANING_TICKET_STATUSES)[number];

export interface CleaningTicketDoc {
  id: string;
  commercialAccountId: string;
  zoneId: string;
  /** The run + pickup that raised the flag (for traceability + cascade delete). */
  flaggedByRunId: string | null;
  flaggedByPickupId: string;
  flaggedAt: Timestamp;
  status: CleaningTicketStatus;
  resolvedAt: Timestamp | null;
  /** Uid of the admin/manager who marked it cleaned. */
  resolvedBy: string | null;
}
