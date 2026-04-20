import type { Timestamp } from 'firebase-admin/firestore';
import type { MaterialId } from './material';

export const MILL_SHIPMENT_STATUSES = ['scheduled', 'picked_up', 'cancelled'] as const;
export type MillShipmentStatus = (typeof MILL_SHIPMENT_STATUSES)[number];

export interface MillShipmentDoc {
  id: string;
  depotId: string;
  mill: string;
  scheduledFor: Timestamp;
  weights: Record<MaterialId, number>;
  status: MillShipmentStatus;
  createdBy: string;
  createdAt: Timestamp;
  pickedUpAt: Timestamp | null;
}
