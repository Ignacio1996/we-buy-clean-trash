import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const zoneRef = adminDb.collection('zones').doc(id);
  const zoneSnap = await zoneRef.get();
  if (!zoneSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const usersSnap = await adminDb.collection('users').where('zoneId', '==', id).limit(1).get();
  if (!usersSnap.empty) {
    return NextResponse.json({ error: 'zone_has_residents' }, { status: 409 });
  }

  const depotId = zoneSnap.get('depotId') as string | undefined;
  await adminDb.runTransaction(async (tx) => {
    tx.delete(zoneRef);
    if (depotId) {
      tx.update(adminDb.collection('depots').doc(depotId), {
        zoneIds: FieldValue.arrayRemove(id),
      });
    }
  });
  return NextResponse.json({ ok: true });
}
