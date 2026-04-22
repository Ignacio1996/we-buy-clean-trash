import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { DepotDoc } from '@/lib/types/depot';

export async function loadManagerDepots(uid: string): Promise<DepotDoc[]> {
  const snap = await adminDb.collection('depots').where('managerId', '==', uid).get();
  return snap.docs.map((d) => d.data() as DepotDoc);
}

export async function loadManagedDepot(
  uid: string,
  depotId: string,
): Promise<DepotDoc | null> {
  const snap = await adminDb.collection('depots').doc(depotId).get();
  if (!snap.exists) return null;
  const depot = snap.data() as DepotDoc;
  if (depot.managerId !== uid) return null;
  return depot;
}
