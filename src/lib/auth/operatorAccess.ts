import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { SessionUser } from './session';

export interface OperatorRouteContext {
  route: RouteDoc;
  ref: FirebaseFirestore.DocumentReference;
}

// Loads the route, confirms the caller is an operator and is assigned to it.
// Callers check `route.status` themselves since the allowed set varies by action.
export async function loadOperatorRoute(
  session: SessionUser,
  routeId: string,
): Promise<
  | { ok: true; context: OperatorRouteContext }
  | { ok: false; status: number; error: string }
> {
  if (session.role !== 'operator') {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  const ref = adminDb.collection('routes').doc(routeId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, error: 'route_not_found' };
  const route = snap.data() as RouteDoc;
  if (route.operatorId !== session.uid) {
    return { ok: false, status: 403, error: 'not_your_route' };
  }
  return { ok: true, context: { route, ref } };
}
