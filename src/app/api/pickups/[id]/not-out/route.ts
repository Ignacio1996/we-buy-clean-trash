import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc } from '@/lib/types/pickup';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const pickupRef = adminDb.collection('pickups').doc(id);
  const pickupSnap = await pickupRef.get();
  if (!pickupSnap.exists) return NextResponse.json({ error: 'pickup_not_found' }, { status: 404 });
  const pickup = pickupSnap.data() as PickupDoc;
  if (pickup.status !== 'pending') {
    return NextResponse.json({ error: 'pickup_not_pending', status: pickup.status }, { status: 409 });
  }
  if (!pickup.routeId) {
    return NextResponse.json({ error: 'pickup_not_on_route' }, { status: 409 });
  }

  const routeResult = await loadOperatorRoute(session, pickup.routeId);
  if (!routeResult.ok) {
    return NextResponse.json({ error: routeResult.error }, { status: routeResult.status });
  }
  if (routeResult.context.route.status !== 'in_progress') {
    return NextResponse.json({ error: 'route_not_started' }, { status: 409 });
  }

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(pickupRef);
    if (!fresh.exists || fresh.get('status') !== 'pending') {
      throw new Error('pickup_state_changed');
    }
    tx.update(pickupRef, {
      status: 'missed',
      issue: 'not_out',
      operatorId: session.uid,
      completedAt: FieldValue.serverTimestamp(),
    });
    tx.update(adminDb.collection('bags').doc(pickup.bagId), { status: 'missed' });
  });

  return NextResponse.json({ ok: true });
}
