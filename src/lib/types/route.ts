import type { Timestamp } from 'firebase-admin/firestore';

export const ROUTE_STATUSES = ['draft', 'assigned', 'in_progress', 'completed'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export interface RouteStop {
  // Null when the stop is a bag-order-only delivery (no pending pickup to scan).
  pickupId: string | null;
  addressId: string;
  residentId: string;
  order: number;
}

export interface RouteDoc {
  id: string;
  date: Timestamp;
  zoneId: string;
  operatorId: string | null;
  orderedStops: RouteStop[];
  bagOrdersToDeliver: string[];
  status: RouteStatus;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  returnedToDepotAt: Timestamp | null;
}
