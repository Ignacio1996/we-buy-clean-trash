import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { sendSMS } from '@/lib/sms/send';
import type { CompostDestinationDoc } from '@/lib/types/compostDestination';
import type { UserDoc } from '@/lib/types/user';

/**
 * Operator taps "heading to drop-off" after the last pickup. We notify the
 * program manager(s) and — if the facility opted in — the destination contact.
 * This is the tap-triggered driver-on-the-way flow (no GPS), matching how Tia
 * does it manually today. Truck-weight routing was dropped (the whole route runs
 * Sunday and every container is swapped).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const destinationId =
    typeof (json as Record<string, unknown>)?.destinationId === 'string'
      ? ((json as Record<string, unknown>).destinationId as string).trim()
      : '';
  if (!destinationId) return NextResponse.json({ error: 'invalid_destination' }, { status: 400 });

  const destSnap = await adminDb.collection('compostDestinations').doc(destinationId).get();
  if (!destSnap.exists) {
    return NextResponse.json({ error: 'destination_not_found' }, { status: 404 });
  }
  const dest = destSnap.data() as CompostDestinationDoc;
  if (dest.active === false) {
    return NextResponse.json({ error: 'destination_inactive' }, { status: 409 });
  }

  // Operator profile → name for the message + zone to scope manager lookup.
  const operatorSnap = await adminDb.collection('users').doc(session.uid).get();
  const operator = operatorSnap.exists ? (operatorSnap.data() as UserDoc) : null;
  const operatorName = operator?.name?.trim() || session.email || 'The driver';
  const operatorZoneId = operator?.zoneId ?? null;

  // 1) Notify the program manager(s) — Tia's appointee. Scope to the operator's
  //    zone when known, but include zone-less managers too.
  const managersSnap = await adminDb
    .collection('users')
    .where('role', '==', 'program_manager')
    .get();
  const managers = managersSnap.docs
    .map((d) => d.data() as UserDoc)
    .filter((m) => !operatorZoneId || !m.zoneId || m.zoneId === operatorZoneId)
    .filter((m) => !!m.phone);

  let notifiedManagers = 0;
  for (const m of managers) {
    if (!m.phone) continue;
    await sendSMS({
      toPhone: m.phone,
      body: `Compost route: ${operatorName} finished the last pickup and is heading to ${dest.name}. Notify them if needed.`,
      purpose: 'driver_on_the_way',
      relatedDocId: dest.id,
    });
    notifiedManagers += 1;
  }

  // 2) Notify the destination contact directly, only if they opted in.
  let notifiedDestination = false;
  if (dest.smsEnabled && dest.contactPhone) {
    await sendSMS({
      toPhone: dest.contactPhone,
      body: `Compost Clubhouse: ${operatorName} is on the way to ${dest.name} with today's drop-off.`,
      purpose: 'driver_on_the_way',
      relatedDocId: dest.id,
    });
    notifiedDestination = true;
  }

  return NextResponse.json({
    ok: true,
    destinationName: dest.name,
    notifiedManagers,
    notifiedDestination,
  });
}
