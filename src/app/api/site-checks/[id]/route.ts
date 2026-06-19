import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';

/**
 * Delete a single recycling-cart site check — test-data cleanup. Manager-only.
 * Site checks never touch inventory or the diversion ledger, so this is a plain
 * delete with no reversal.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  const ref = adminDb.collection('siteChecks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await ref.delete();
  return NextResponse.json({ ok: true });
}
