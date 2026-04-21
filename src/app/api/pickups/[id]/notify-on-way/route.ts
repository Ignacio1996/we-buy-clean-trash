import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import { sendSMS } from '@/lib/sms/send';
import type { PickupDoc } from '@/lib/types/pickup';
import type { UserDoc } from '@/lib/types/user';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const pickupSnap = await adminDb.collection('pickups').doc(id).get();
  if (!pickupSnap.exists) return NextResponse.json({ error: 'pickup_not_found' }, { status: 404 });
  const pickup = pickupSnap.data() as PickupDoc;
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

  const residentSnap = await adminDb.collection('users').doc(pickup.residentId).get();
  const resident = residentSnap.data() as UserDoc | undefined;
  const firstName = typeof resident?.name === 'string' ? resident.name.split(' ')[0] : 'there';

  // toPhone may be '' until phone backfill lands — the stub still writes to smsLog
  // so we capture the intent. Twilio call is wired post-pilot.
  await sendSMS({
    toPhone: resident?.phone ?? '',
    body: `Hi ${firstName}! Your We Buy Clean Trash driver is on the way — please make sure your bag is at the curb.`,
    purpose: 'driver_on_the_way',
    relatedDocId: pickup.id,
  });

  return NextResponse.json({ ok: true, phoneKnown: Boolean(resident?.phone) });
}
