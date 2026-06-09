import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { deleteResidentCompletely, type DeleteResidentResult } from './deleteResident';
import { deleteStaffCompletely } from './deleteStaff';
import type { Role } from '@/lib/types/role';

/**
 * Deletes a user account by dispatching on its role:
 *  - resident → full cascade (orders, bags, transactions, …)
 *  - operator / depot_worker / depot_manager → account + active-assignment detach,
 *    history preserved
 *  - admin → refused (admins are never deletable via this path)
 */
export async function deleteUserCompletely(uid: string): Promise<DeleteResidentResult> {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) {
    return { uid, ok: false, error: 'not_found', deletedCounts: {} };
  }
  const role = snap.get('role') as Role;
  if (role === 'resident') {
    return deleteResidentCompletely(uid);
  }
  if (role === 'operator' || role === 'depot_worker' || role === 'depot_manager') {
    return deleteStaffCompletely(uid);
  }
  return { uid, ok: false, error: 'cannot_delete_admin', deletedCounts: {} };
}
