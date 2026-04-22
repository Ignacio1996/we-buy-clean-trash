import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { DepotDoc } from '@/lib/types/depot';
import type { UserDoc } from '@/lib/types/user';

export interface DepotAccessContext {
  user: UserDoc;
  depot: DepotDoc;
}

/**
 * Resolve the depot a depot_worker / depot_manager is scoped to.
 *
 * Pilot fallback: if the user has no depotId yet, we fall back to the first depot
 * doc in the collection so existing test fixtures keep working. Invites created
 * from now on persist depotId via /api/accept-invite, so this fallback should
 * shrink over time.
 */
export async function loadDepotContext(uid: string): Promise<
  | { ok: true; context: DepotAccessContext }
  | { ok: false; error: 'user_not_found' | 'depot_not_found' }
> {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return { ok: false, error: 'user_not_found' };
  const user = userSnap.data() as UserDoc;

  let depotId = user.depotId ?? null;
  if (!depotId) {
    const fallback = await adminDb.collection('depots').limit(1).get();
    if (fallback.empty) return { ok: false, error: 'depot_not_found' };
    depotId = fallback.docs[0].id;
    console.warn(
      `[depotAccess] user ${uid} has no depotId; falling back to first depot ${depotId}`,
    );
  }
  const depotSnap = await adminDb.collection('depots').doc(depotId).get();
  if (!depotSnap.exists) return { ok: false, error: 'depot_not_found' };
  const depot = depotSnap.data() as DepotDoc;
  return { ok: true, context: { user, depot } };
}
