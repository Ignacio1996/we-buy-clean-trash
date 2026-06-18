import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';
import type { BinPickupDoc } from '@/lib/types/binPickup';

/**
 * Delete a compost run and everything it produced — its bin pickups, the
 * inventory those pickups added, and any cleaning tickets they raised. Built for
 * clearing test runs (e.g. Friday's dry-run) before a real run. Manager-only.
 *
 * Inventory is rolled up by zone + material, so we decrement it by the summed
 * weight of the deleted pickups to keep diversion reports honest. Skipped stops
 * carry 0 weight and don't touch inventory.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  const routeRef = adminDb.collection('compostRoutes').doc(id);
  const routeSnap = await routeRef.get();
  if (!routeSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [pickupsSnap, checksSnap, ticketsSnap] = await Promise.all([
    adminDb.collection('binPickups').where('routeId', '==', id).get(),
    adminDb.collection('siteChecks').where('routeId', '==', id).get(),
    adminDb.collection('cleaningTickets').where('flaggedByRunId', '==', id).get(),
  ]);

  // Sum weight removed per inventory key (commercial_<zone>_<material>) so we can
  // undo what each pickup added.
  const inventoryDelta = new Map<string, number>();
  for (const doc of pickupsSnap.docs) {
    const p = doc.data() as BinPickupDoc;
    if (p.totalWeightLbs > 0) {
      const key = `commercial_${p.zoneId}_${p.materialId}`;
      inventoryDelta.set(key, (inventoryDelta.get(key) ?? 0) + p.totalWeightLbs);
    }
  }

  const batch = adminDb.batch();
  for (const doc of pickupsSnap.docs) batch.delete(doc.ref);
  for (const doc of checksSnap.docs) batch.delete(doc.ref);
  for (const doc of ticketsSnap.docs) batch.delete(doc.ref);
  for (const [key, weight] of inventoryDelta) {
    batch.set(
      adminDb.collection('inventory').doc(key),
      { weight: FieldValue.increment(-weight), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  batch.delete(routeRef);
  await batch.commit();

  return NextResponse.json({
    ok: true,
    deletedPickups: pickupsSnap.size,
    deletedChecks: checksSnap.size,
    deletedTickets: ticketsSnap.size,
  });
}
