import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export async function DELETE(_request: Request, context: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { token } = await context.params;
  const ref = adminDb.collection('invites').doc(token);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (snap.get('status') !== 'pending') {
    return NextResponse.json({ error: 'not_revocable' }, { status: 409 });
  }

  await ref.update({
    status: 'revoked',
    revokedBy: session.uid,
    revokedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}
