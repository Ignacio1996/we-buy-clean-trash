import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import type { RouteDoc } from '@/lib/types/route';

export const runtime = 'nodejs';

const PICKUP_TERMINAL = new Set(['completed', 'missed', 'issue']);
const BAG_ORDER_TERMINAL = new Set(['delivered']);

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const routeRef = adminDb.collection('routes').doc(id);

  const routeSnap = await routeRef.get();
  if (!routeSnap.exists) {
    return NextResponse.json({ error: 'route_not_found' }, { status: 404 });
  }
  const route = routeSnap.data() as RouteDoc;

  const pickupRefs = route.orderedStops.map((s) => adminDb.collection('pickups').doc(s.pickupId));
  const bagOrderRefs = route.bagOrdersToDeliver.map((bid) =>
    adminDb.collection('bagOrders').doc(bid),
  );

  try {
    await adminDb.runTransaction(async (tx) => {
      const freshRoute = await tx.get(routeRef);
      if (!freshRoute.exists) throw new Error('route_not_found');

      const pickupSnaps = pickupRefs.length ? await tx.getAll(...pickupRefs) : [];
      const bagOrderSnaps = bagOrderRefs.length ? await tx.getAll(...bagOrderRefs) : [];

      const finishedPickup = pickupSnaps.find(
        (s) => s.exists && PICKUP_TERMINAL.has(s.get('status')),
      );
      const finishedBagOrder = bagOrderSnaps.find(
        (s) => s.exists && BAG_ORDER_TERMINAL.has(s.get('status')),
      );
      if (finishedPickup || finishedBagOrder) {
        throw new Error('route_has_finished_work');
      }

      for (const snap of pickupSnaps) {
        if (!snap.exists) continue;
        if (snap.get('routeId') !== id) continue;
        tx.update(snap.ref, { routeId: null, operatorId: null });
      }
      for (const snap of bagOrderSnaps) {
        if (!snap.exists) continue;
        if (snap.get('deliveryRouteId') !== id) continue;
        tx.update(snap.ref, { deliveryRouteId: null });
      }
      tx.delete(routeRef);
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    const status =
      code === 'route_not_found'
        ? 404
        : code === 'route_has_finished_work'
          ? 409
          : 500;
    return NextResponse.json({ error: code }, { status });
  }

  return NextResponse.json({ ok: true });
}
