import type { Timestamp } from 'firebase-admin/firestore';
import type { MaterialId } from './material';

export interface InventoryDoc {
  id: string;
  depotId: string;
  materialId: MaterialId;
  weight: number;
  updatedAt: Timestamp;
}
