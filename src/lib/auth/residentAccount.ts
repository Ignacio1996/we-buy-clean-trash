import 'server-only';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { resolveAccountType, type AccountType } from '@/lib/types/user';

export interface ResidentAccountContext {
  uid: string;
  accountType: AccountType;
  commercialAccountId: string | null;
}

/**
 * Loads accountType + commercialAccountId for the signed-in resident. Used by
 * resident layout/pages to decide whether to render the consumer flow or the
 * commercial-site flow.
 */
export async function loadResidentAccount(uid: string): Promise<ResidentAccountContext> {
  const snap = await adminDb.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() ?? {} : {};
  return {
    uid,
    accountType: resolveAccountType(data),
    commercialAccountId:
      typeof data.commercialAccountId === 'string' ? data.commercialAccountId : null,
  };
}

/**
 * Use on resident sub-routes that don't apply to commercial sites (calculator,
 * order-bags, scan-bag). Bounces commercial accounts back to /resident.
 */
export async function requireConsumerResident(uid: string): Promise<void> {
  const ctx = await loadResidentAccount(uid);
  if (ctx.accountType === 'commercial_site') {
    redirect('/resident');
  }
}
