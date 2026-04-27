import type { Timestamp } from 'firebase-admin/firestore';
import type { BinSize } from '@/lib/logic/binWeightTable';

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

/**
 * Physical container behind the QR sticker. Existing residential flow uses 'bag'
 * (single-use, retires when processed). Compost commercial flow uses 'bin_*'
 * (reusable — QR stays on the bin, pickups empty it but don't retire it).
 */
export const CONTAINER_TYPES = ['bag', 'bin_32', 'bin_48', 'bin_64'] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export function isContainerType(v: unknown): v is ContainerType {
  return typeof v === 'string' && (CONTAINER_TYPES as readonly string[]).includes(v);
}

export function isBinContainer(c: ContainerType): boolean {
  return c !== 'bag';
}

/** Map a bin container to its bin-weight-table size. Returns null for non-bin. */
export function containerBinSize(c: ContainerType): BinSize | null {
  if (c === 'bin_32') return '32';
  if (c === 'bin_48') return '48';
  if (c === 'bin_64') return '64';
  return null;
}

/** Resolve container type for a bag doc. Legacy docs without the field are 'bag'. */
export function resolveContainerType(bag: { containerType?: unknown }): ContainerType {
  return isContainerType(bag.containerType) ? bag.containerType : 'bag';
}

export interface BagDoc {
  id: string;
  qrCode: string;
  printedNumber: string;
  stickerSheetId: string;
  residentId: string | null;
  /**
   * Set when this container belongs to a commercial site (compost flow).
   * Mutually exclusive with residentId — a container has one owner.
   */
  commercialAccountId?: string | null;
  declaredType: DeclaredBagType | null;
  status: BagStatus;
  /** Defaults to 'bag' for legacy docs — see resolveContainerType. */
  containerType?: ContainerType;
  /** Reusable containers (bins) stay active across pickups; bags retire on process. */
  reusable?: boolean;
  createdAt: Timestamp;
}

export interface StickerSheetDoc {
  id: string;
  sheetNumber: string;
  residentId: string | null;
  bagIds: string[];
  bagOrderId: string | null;
  printedAt: Timestamp | null;
  issuedAt: Timestamp | null;
  createdAt: Timestamp;
}
