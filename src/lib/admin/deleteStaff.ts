import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { DeleteResidentResult } from './deleteResident';
import type { Role } from '@/lib/types/role';

/**
 * Permanently deletes a staff account (operator / depot_worker / depot_manager)
 * and removes their login. Gated to staff roles so it can never wipe a resident
 * (which has its own cascade in `deleteResidentCompletely`) or an admin.
 *
 * Unlike resident deletion, staff operational history is PRESERVED — pickups,
 * `bagProcessing`, completed routes, and bin pickups reference the staff uid as
 * an opaque historical id, and that record stays valuable after the person
 * leaves. We only detach ACTIVE assignments so nothing live points at a ghost:
 *  - `depots.managerId` → null (the depot loses its manager)
 *  - non-completed `routes.operatorId` → null (future/in-flight routes unassigned)
 *
 * Then the `users/{uid}` doc and the Firebase Auth account are deleted.
 */

const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  'operator',
  'depot_worker',
  'depot_manager',
]);

const BATCH_LIMIT = 450;

export async function deleteStaffCompletely(uid: string): Promise<DeleteResidentResult> {
  const deletedCounts: Record<string, number> = {};

  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { uid, ok: false, error: 'not_found', deletedCounts };
  }
  if (!STAFF_ROLES.has(userSnap.get('role') as Role)) {
    return { uid, ok: false, error: 'not_staff', deletedCounts };
  }

  const updates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    update: Record<string, unknown>;
  }> = [];

  // Detach as depot manager.
  const depotsSnap = await adminDb.collection('depots').where('managerId', '==', uid).get();
  depotsSnap.docs.forEach((d) => updates.push({ ref: d.ref, update: { managerId: null } }));
  deletedCounts.depots = depotsSnap.size;

  // Detach from active (non-completed) routes; completed routes keep the uid as
  // historical record of who ran them.
  const routesSnap = await adminDb.collection('routes').where('operatorId', '==', uid).get();
  const detachedRoutes = routesSnap.docs.filter((d) => d.get('status') !== 'completed');
  detachedRoutes.forEach((d) => updates.push({ ref: d.ref, update: { operatorId: null } }));
  deletedCounts.routes = detachedRoutes.length;

  // Commit detach updates + the user doc deletion in chunked batches.
  let batch = adminDb.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = adminDb.batch();
      ops = 0;
    }
  };
  for (const { ref, update } of updates) {
    batch.update(ref, update);
    if (++ops >= BATCH_LIMIT) await flush();
  }
  batch.delete(userRef);
  ops++;
  await flush();

  // Auth account last, after Firestore is clean. Missing record is fine.
  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string })?.code !== 'auth/user-not-found') {
      return { uid, ok: false, error: 'auth_delete_failed', deletedCounts };
    }
  }

  return { uid, ok: true, deletedCounts };
}
