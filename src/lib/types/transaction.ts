import type { Timestamp } from 'firebase-admin/firestore';

export const TRANSACTION_TYPES = ['signup_bonus', 'pickup', 'redemption', 'adjustment'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionDoc {
  id: string;
  userId: string;
  type: TransactionType;
  pointsDelta: number;
  balanceAfter: number;
  relatedDocId: string | null;
  description: string;
  createdAt: Timestamp;
}
