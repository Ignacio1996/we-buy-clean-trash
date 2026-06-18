import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { columbusDateKey } from '@/lib/logic/columbusDate';
import type { UserDoc } from '@/lib/types/user';

/**
 * Start a compost run (Phase D, D1.3). Creates an in-progress `compostRoutes`
 * doc the operator's subsequent bin pickups attach to. Single open run per
 * operator — if one already exists, returns it (idempotent), so a double-tap or
 * a reload mid-run never spawns a duplicate.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const openSnap = await adminDb
    .collection('compostRoutes')
    .where('operatorId', '==', session.uid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (!openSnap.empty) {
    return NextResponse.json({ ok: true, routeId: openSnap.docs[0].id, alreadyOpen: true });
  }

  const operatorSnap = await adminDb.collection('users').doc(session.uid).get();
  const zoneId = operatorSnap.exists ? ((operatorSnap.data() as UserDoc).zoneId ?? null) : null;

  const ref = adminDb.collection('compostRoutes').doc();
  await ref.set({
    id: ref.id,
    zoneId,
    operatorId: session.uid,
    date: columbusDateKey(new Date()),
    status: 'in_progress',
    startedAt: FieldValue.serverTimestamp(),
    endedAt: null,
    summary: null,
  });

  return NextResponse.json({ ok: true, routeId: ref.id });
}
