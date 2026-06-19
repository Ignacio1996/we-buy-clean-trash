import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';
import type { BinPickupDoc } from '@/lib/types/binPickup';

/**
 * Delete a single bin pickup — test-data cleanup for stray/mis-recorded stops
 * without nuking the whole run. Manager-only.
 *
 * Mirrors the run-delete inventory math: a pickup adds its weight to the rolled
 * up inventory key (commercial_<zone>_<material>), so we decrement that key by
 * the same weight to keep diversion totals honest. Skipped stops carry 0 weight
 * and don't touch inventory.
 *
 * Note: this does NOT rewrite a completed run's frozen summary — it's meant for
 * clearing pickups from in-progress/test runs (whose summary is computed live).
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  const ref = adminDb.collection('binPickups').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const pickup = snap.data() as BinPickupDoc;

  const batch = adminDb.batch();
  if (pickup.totalWeightLbs > 0) {
    const key = `commercial_${pickup.zoneId}_${pickup.materialId}`;
    batch.set(
      adminDb.collection('inventory').doc(key),
      { weight: FieldValue.increment(-pickup.totalWeightLbs), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  batch.delete(ref);
  await batch.commit();

  return NextResponse.json({ ok: true, reversedWeightLbs: pickup.totalWeightLbs });
}
