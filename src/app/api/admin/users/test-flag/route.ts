import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

/**
 * Admin-only: flip a user's `isTest` flag. This is the single server-side gate
 * for the Stripe payment bypass — test accounts auto-confirm bag orders as paid
 * without a real charge — and for excluding test records from admin views and
 * exports. Never settable by the user themselves.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const uid = typeof raw.uid === 'string' ? raw.uid : '';
  const isTest = raw.isTest === true;
  if (!uid) {
    return NextResponse.json({ error: 'missing_uid' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await userRef.update({ isTest, updatedAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ ok: true, uid, isTest });
}
