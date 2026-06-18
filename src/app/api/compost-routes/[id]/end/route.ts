import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { summarizeCompostRoute } from '@/lib/logic/compostRouteSummary';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { CompostRouteDoc } from '@/lib/types/compostRoute';

/**
 * End a compost run (Phase D, D1.3). Freezes the summary from every bin pickup
 * tied to the run and flips it to `completed`. Only the operator who owns the
 * open run may end it.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  const ref = adminDb.collection('compostRoutes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'route_not_found' }, { status: 404 });
  const route = snap.data() as CompostRouteDoc;
  if (route.operatorId !== session.uid) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (route.status !== 'in_progress') {
    return NextResponse.json({ error: 'route_not_endable', status: route.status }, { status: 409 });
  }

  const pickupsSnap = await adminDb.collection('binPickups').where('routeId', '==', id).get();
  const summary = summarizeCompostRoute(pickupsSnap.docs.map((d) => d.data() as BinPickupDoc));

  await ref.update({
    status: 'completed',
    endedAt: FieldValue.serverTimestamp(),
    summary,
  });

  return NextResponse.json({ ok: true, summary });
}
