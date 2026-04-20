import type { Timestamp } from 'firebase-admin/firestore';

export const REDEMPTION_BRANDS = ['amazon', 'walmart', 'pay_trash_bill', 'donate'] as const;
export type RedemptionBrand = (typeof REDEMPTION_BRANDS)[number];

export const REDEMPTION_STATUSES = ['pending', 'fulfilled', 'rejected'] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

export interface RedemptionDoc {
  id: string;
  userId: string;
  brand: RedemptionBrand;
  pointsSpent: number;
  dollarValue: number;
  status: RedemptionStatus;
  fulfillmentCode: string | null;
  fulfilledBy: string | null;
  fulfilledAt: Timestamp | null;
  createdAt: Timestamp;
}
