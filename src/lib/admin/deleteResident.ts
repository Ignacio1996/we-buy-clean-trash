import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { RouteStop } from '@/lib/types/route';

/**
 * Permanently deletes a resident and ALL data tied to them. Destructive and
 * irreversible — gated to `role === 'resident'` so it can never wipe staff
 * accounts (operators/depot/manager/admin), whose UIDs are also referenced by
 * operational records.
 *
 * Cleanup covers, for the given uid:
 *  - Firestore docs keyed by `residentId` or `userId` across every collection
 *  - `routes`: removes the resident's stops + their deleted bag-orders
 *  - `complianceBatches`: arrayRemove the uid from `residentIds`
 *  - `customers/{uid}` (Stripe extension data) via recursive delete
 *  - the `users/{uid}` doc and the Firebase Auth account
 *
 * Note: this is not a single atomic transaction (a resident can exceed the
 * 500-write limit and Auth deletion lives outside Firestore). Firestore cleanup
 * runs in chunked batches first; the Auth record is deleted last, after the
 * data is gone.
 */

const COLLECTIONS_BY_RESIDENT_ID = [
  'addresses',
  'bagOrders',
  'bags',
  'stickerSheets',
  'bagProcessing',
  'pickups',
  'contaminationFlags',
  'complianceNotices',
] as const;

const COLLECTIONS_BY_USER_ID = ['transactions', 'redemptions'] as const;

const BATCH_LIMIT = 450;

export interface DeleteResidentResult {
  uid: string;
  ok: boolean;
  error?: string;
  /** Per-collection count of docs deleted / records scrubbed. */
  deletedCounts: Record<string, number>;
}

export async function deleteResidentCompletely(uid: string): Promise<DeleteResidentResult> {
  const deletedCounts: Record<string, number> = {};

  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { uid, ok: false, error: 'not_found', deletedCounts };
  }
  if (userSnap.get('role') !== 'resident') {
    return { uid, ok: false, error: 'not_resident', deletedCounts };
  }

  const refsToDelete: FirebaseFirestore.DocumentReference[] = [];
  const deletedBagOrderIds = new Set<string>();

  for (const col of COLLECTIONS_BY_RESIDENT_ID) {
    const snap = await adminDb.collection(col).where('residentId', '==', uid).get();
    deletedCounts[col] = snap.size;
    snap.docs.forEach((d) => {
      refsToDelete.push(d.ref);
      if (col === 'bagOrders') deletedBagOrderIds.add(d.id);
    });
  }

  for (const col of COLLECTIONS_BY_USER_ID) {
    const snap = await adminDb.collection(col).where('userId', '==', uid).get();
    deletedCounts[col] = snap.size;
    snap.docs.forEach((d) => refsToDelete.push(d.ref));
  }

  // routes: strip this resident's stops and any of their deleted bag-orders.
  // orderedStops is an array of objects, which Firestore can't query on, so we
  // scan all routes (pilot scale) and rewrite only those that reference them.
  const routesSnap = await adminDb.collection('routes').get();
  const routeUpdates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    update: Record<string, unknown>;
  }> = [];
  routesSnap.docs.forEach((d) => {
    const stops = (d.get('orderedStops') ?? []) as RouteStop[];
    const orders = (d.get('bagOrdersToDeliver') ?? []) as string[];
    const keptStops = stops.filter((s) => s.residentId !== uid);
    const keptOrders = orders.filter((id) => !deletedBagOrderIds.has(id));
    if (keptStops.length !== stops.length || keptOrders.length !== orders.length) {
      routeUpdates.push({
        ref: d.ref,
        update: { orderedStops: keptStops, bagOrdersToDeliver: keptOrders },
      });
    }
  });
  deletedCounts.routes = routeUpdates.length;

  // complianceBatches: the uid lives inside a residentIds[] array.
  const batchesSnap = await adminDb
    .collection('complianceBatches')
    .where('residentIds', 'array-contains', uid)
    .get();
  deletedCounts.complianceBatches = batchesSnap.size;

  refsToDelete.push(userRef);

  // Commit Firestore work in chunked batches (500-write limit per batch).
  let batch = adminDb.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = adminDb.batch();
      ops = 0;
    }
  };
  for (const ref of refsToDelete) {
    batch.delete(ref);
    if (++ops >= BATCH_LIMIT) await flush();
  }
  for (const { ref, update } of routeUpdates) {
    batch.update(ref, update);
    if (++ops >= BATCH_LIMIT) await flush();
  }
  for (const d of batchesSnap.docs) {
    batch.update(d.ref, { residentIds: FieldValue.arrayRemove(uid) });
    if (++ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  // Stripe extension data (customers/{uid}/checkout_sessions|payments|...).
  // Best-effort: a test resident may have never hit Stripe.
  try {
    await adminDb.recursiveDelete(adminDb.collection('customers').doc(uid));
  } catch {
    // ignore — no Stripe customer doc for this resident.
  }

  // Auth account last, after the data is gone. Missing record is fine.
  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string })?.code !== 'auth/user-not-found') {
      return { uid, ok: false, error: 'auth_delete_failed', deletedCounts };
    }
  }

  return { uid, ok: true, deletedCounts };
}
