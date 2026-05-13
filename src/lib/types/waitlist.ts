import type { Timestamp } from 'firebase-admin/firestore';

export interface WaitlistEntryDoc {
  id: string;
  name: string;
  email: string;
  postalCode: string;
  source: 'landing_pilot';
  createdAt: Timestamp;
}
