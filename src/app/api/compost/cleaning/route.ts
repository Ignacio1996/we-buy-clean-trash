import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';

/**
 * Mark a site's bins cleaned — closes every open cleaning ticket for that site.
 * Cleaning is done per site ("we clean them all"), so a single tap clears the
 * site from the queue. Manager-only.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const commercialAccountId =
    typeof raw.commercialAccountId === 'string' ? raw.commercialAccountId.trim() : '';
  if (!commercialAccountId) {
    return NextResponse.json({ error: 'invalid_account_id' }, { status: 400 });
  }

  const openSnap = await adminDb
    .collection('cleaningTickets')
    .where('commercialAccountId', '==', commercialAccountId)
    .where('status', '==', 'open')
    .get();

  if (openSnap.empty) return NextResponse.json({ ok: true, resolved: 0 });

  const batch = adminDb.batch();
  for (const doc of openSnap.docs) {
    batch.update(doc.ref, {
      status: 'done',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: session.uid,
    });
  }
  await batch.commit();

  return NextResponse.json({ ok: true, resolved: openSnap.size });
}
