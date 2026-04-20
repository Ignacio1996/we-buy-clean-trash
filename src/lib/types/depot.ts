import type { Timestamp } from 'firebase-admin/firestore';

export interface DepotDoc {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  geo: { lat: number; lng: number } | null;
  managerId: string | null;
  zoneIds: string[];
  createdAt: Timestamp;
}
