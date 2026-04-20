import type { Timestamp } from 'firebase-admin/firestore';

export interface ZoneDoc {
  id: string;
  name: string;
  depotId: string;
  pickupDayOfWeek: number;
  createdAt: Timestamp;
}
