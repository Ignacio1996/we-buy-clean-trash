import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const depotRef = adminDb.collection('depots').doc(id);
  const depotSnap = await depotRef.get();
  if (!depotSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const zonesSnap = await adminDb.collection('zones').where('depotId', '==', id).limit(1).get();
  if (!zonesSnap.empty) {
    return NextResponse.json({ error: 'depot_has_zones' }, { status: 409 });
  }

  await depotRef.delete();
  return NextResponse.json({ ok: true });
}
