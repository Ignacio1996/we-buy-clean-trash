import type { Timestamp } from 'firebase-admin/firestore';

export const BAG_STATUSES = [
  'unused',
  'pending_pickup',
  'picked_up',
  'processed',
  'missed',
] as const;
export type BagStatus = (typeof BAG_STATUSES)[number];

export const DECLARED_BAG_TYPES = ['mixed', 'separated'] as const;
export type DeclaredBagType = (typeof DECLARED_BAG_TYPES)[number];

export interface BagDoc {
  id: string;
  qrCode: string;
  printedNumber: string;
  stickerSheetId: string;
  residentId: string;
  declaredType: DeclaredBagType | null;
  status: BagStatus;
  createdAt: Timestamp;
}

export interface StickerSheetDoc {
  id: string;
  residentId: string;
  bagIds: string[];
  bagOrderId: string | null;
  printedAt: Timestamp | null;
  createdAt: Timestamp;
}
