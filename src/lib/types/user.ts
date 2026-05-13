import type { Timestamp } from 'firebase-admin/firestore';
import type { Role } from './role';

/**
 * Resident accounts are humans who self-signed up; commercial_site accounts are
 * businesses (e.g. a restaurant on Tia's compost route). Commercial sites can
 * exist as commercialAccount docs without a UserDoc — `accountType` here only
 * matters when the site has been granted portal access.
 */
export const ACCOUNT_TYPES = ['resident', 'commercial_site'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function isAccountType(v: unknown): v is AccountType {
  return typeof v === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(v);
}

export function resolveAccountType(user: { accountType?: unknown }): AccountType {
  return isAccountType(user.accountType) ? user.accountType : 'resident';
}

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  zoneId: string | null;
  addressId: string | null;
  depotId: string | null;
  pointsBalance: number;
  /**
   * Whether this resident has already redeemed their free welcome sheet of
   * 10 bags. Flipped true inside the bag-orders transaction the first time
   * a credit is applied. Absent on legacy docs — treat as false.
   */
  freeSheetClaimed?: boolean;
  /** Defaults to 'resident' for legacy docs — see resolveAccountType. */
  accountType?: AccountType;
  /** When set, this user is the portal contact for a commercialAccount. */
  commercialAccountId?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Lenient pilot-era phone validator — trim, cap length, require 7–15 digits.
// Twilio will canonicalize to E.164 when real SMS is wired post-pilot.
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 20) return null;
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount < 7 || digitCount > 15) return null;
  return trimmed;
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
