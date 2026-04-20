import type { Timestamp } from 'firebase-admin/firestore';
import type { Role } from './role';

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  role: Role;
  zoneId: string | null;
  addressId: string | null;
  pointsBalance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AddressDoc {
  id: string;
  residentId: string;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  postalCode: string;
  geo: { lat: number; lng: number } | null;
  zoneId: string | null;
  createdAt: Timestamp;
}
