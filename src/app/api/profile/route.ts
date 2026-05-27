import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { normalizePhone } from '@/lib/types/user';

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  if ('phone' in raw) {
    const v = raw.phone;
    if (v === null || v === '') {
      updates.phone = null;
    } else {
      const normalized = normalizePhone(v);
      if (!normalized) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
      updates.phone = normalized;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  updates.updatedAt = FieldValue.serverTimestamp();
  await adminDb.collection('users').doc(session.uid).update(updates);
  return NextResponse.json({ ok: true });
}
