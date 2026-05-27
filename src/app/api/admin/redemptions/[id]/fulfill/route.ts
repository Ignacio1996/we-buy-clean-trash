import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const fulfillmentCode =
    typeof raw.fulfillmentCode === 'string' && raw.fulfillmentCode.trim()
      ? raw.fulfillmentCode.trim()
      : null;

  const { id } = await context.params;
  const ref = adminDb.collection('redemptions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (snap.get('status') !== 'pending') {
    return NextResponse.json({ error: 'not_pending' }, { status: 409 });
  }

  await ref.update({
    status: 'fulfilled',
    fulfillmentCode,
    fulfilledBy: session.uid,
    fulfilledAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}
