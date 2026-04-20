import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await adminDb.collection('users').doc(session.uid).update({
    onboardingCompletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}
