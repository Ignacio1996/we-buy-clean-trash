import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import { resolveAccountType, type AccountType, type UserDoc } from '@/lib/types/user';

export interface ResidentAccountContext {
  uid: string;
  accountType: AccountType;
  commercialAccountId: string | null;
}

/**
 * Per-request memoized read of a resident's user doc. `React.cache()` dedupes
 * across the resident layout, role-guards, and individual pages so a single
 * page render hits Firestore once instead of 2–3 times for the same doc.
 */
export type ResidentUserData = Partial<UserDoc> & Record<string, unknown>;

export const loadResidentUserDoc = cache(async (uid: string): Promise<ResidentUserData> => {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists ? ((snap.data() ?? {}) as ResidentUserData) : {};
});

/**
 * Loads accountType + commercialAccountId for the signed-in resident. Used by
 * resident layout/pages to decide whether to render the consumer flow or the
 * commercial-site flow.
 */
export async function loadResidentAccount(uid: string): Promise<ResidentAccountContext> {
  const data = await loadResidentUserDoc(uid);
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
