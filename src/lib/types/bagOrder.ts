import type { Timestamp } from 'firebase-admin/firestore';

export const BAG_ORDER_STATUSES = [
  'pending',
  'queued',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type BagOrderStatus = (typeof BAG_ORDER_STATUSES)[number];

export interface BagOrderDoc {
  id: string;
  residentId: string;
  zoneId: string | null;
  addressId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shipping: number;
  total: number;
  stripeSessionId: string | null;
  stripeStubSuccess: boolean;
  status: BagOrderStatus;
  deliveryRouteId: string | null;
  createdAt: Timestamp;
  deliveredAt: Timestamp | null;
}
