import type { Timestamp } from 'firebase-admin/firestore';
import type { Role } from './role';

export type InviteStatus = 'pending' | 'consumed' | 'revoked' | 'expired';

export interface InviteDoc {
  token: string;
  email: string | null;
  phone: string | null;
  role: Exclude<Role, 'resident'>;
  zoneId: string | null;
  depotId: string | null;
  status: InviteStatus;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  consumedAt: Timestamp | null;
  consumedBy: string | null;
}
