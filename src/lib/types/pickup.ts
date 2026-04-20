import type { Timestamp } from 'firebase-admin/firestore';

export const PICKUP_STATUSES = ['pending', 'completed', 'missed', 'skipped', 'issue'] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const PICKUP_ISSUES = ['not_out', 'contaminated', 'other'] as const;
export type PickupIssue = (typeof PICKUP_ISSUES)[number];

export interface PickupDoc {
  id: string;
  bagId: string;
  residentId: string;
  addressId: string;
  routeId: string | null;
  operatorId: string | null;
  doorstepPhotoUrl: string | null;
  operatorPhotoUrl: string | null;
  sealed: boolean | null;
  status: PickupStatus;
  issue: PickupIssue | null;
  issueNote: string | null;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
}
