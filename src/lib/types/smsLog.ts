import type { Timestamp } from 'firebase-admin/firestore';

export const SMS_PURPOSES = [
  'driver_on_the_way',
  'bag_processed',
  'contamination_warning',
  'other',
] as const;
export type SmsPurpose = (typeof SMS_PURPOSES)[number];

export interface SmsLogDoc {
  id: string;
  toPhone: string;
  body: string;
  purpose: SmsPurpose;
  relatedDocId: string | null;
  createdAt: Timestamp;
}
