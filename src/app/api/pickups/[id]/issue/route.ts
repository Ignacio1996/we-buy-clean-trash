import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc, PickupIssue } from '@/lib/types/pickup';

const VALID_ISSUES: PickupIssue[] = ['contaminated', 'other'];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const issue = VALID_ISSUES.includes(raw.issue as PickupIssue) ? (raw.issue as PickupIssue) : null;
  const note =
    typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 500) : null;
  if (!issue) return NextResponse.json({ error: 'invalid_issue' }, { status: 400 });

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
      status: 'issue',
      issue,
      issueNote: note,
      operatorId: session.uid,
      completedAt: FieldValue.serverTimestamp(),
    });
    tx.update(adminDb.collection('bags').doc(pickup.bagId), { status: 'missed' });
  });

  return NextResponse.json({ ok: true });
}
