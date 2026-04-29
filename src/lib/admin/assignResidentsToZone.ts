import { adminDb } from '@/lib/firebase/admin';

// Firestore `in` queries cap at 30 values per query.
const IN_CHUNK = 30;
// Each assignment writes 2 docs (address + user). Stay under the 500-op batch cap.
const BATCH_PAIRS = 240;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Assign existing residents to a zone after the zone's zipCodes change.
 * Only fills nulls — never overwrites a user/address already assigned to another zone.
 * Returns the number of residents newly assigned.
 */
export async function assignResidentsToZone(
  zoneId: string,
  zipCodes: string[],
): Promise<number> {
  if (zipCodes.length === 0) return 0;

  const matchingAddresses: { id: string; residentId: string }[] = [];
  for (const zipChunk of chunk(zipCodes, IN_CHUNK)) {
    const snap = await adminDb
      .collection('addresses')
      .where('postalCode', 'in', zipChunk)
      .get();
    for (const doc of snap.docs) {
      if (doc.get('zoneId') !== null) continue;
      const residentId = doc.get('residentId');
      if (typeof residentId !== 'string') continue;
      matchingAddresses.push({ id: doc.id, residentId });
    }
  }

  if (matchingAddresses.length === 0) return 0;

  let assigned = 0;
  for (const group of chunk(matchingAddresses, BATCH_PAIRS)) {
    const userRefs = group.map((a) => adminDb.collection('users').doc(a.residentId));
    const userSnaps = await adminDb.getAll(...userRefs);

    const batch = adminDb.batch();
    let writes = 0;
    for (let i = 0; i < group.length; i++) {
      const userSnap = userSnaps[i];
      if (!userSnap.exists) continue;
      if (userSnap.get('zoneId') !== null) continue;

      batch.update(adminDb.collection('addresses').doc(group[i].id), { zoneId });
      batch.update(userRefs[i], { zoneId });
      writes++;
    }
    if (writes > 0) {
      await batch.commit();
      assigned += writes;
    }
  }
  return assigned;
}

/**
 * Unassign residents currently in this zone whose address postalCode is no longer
 * in the zone's zipCodes list. Sets address.zoneId and user.zoneId back to null.
 * Returns the number of residents unassigned.
 */
export async function unassignResidentsFromZone(
  zoneId: string,
  currentZipCodes: string[],
): Promise<number> {
  const keep = new Set(currentZipCodes);
  const snap = await adminDb.collection('addresses').where('zoneId', '==', zoneId).get();
  const stale: { id: string; residentId: string }[] = [];
  for (const doc of snap.docs) {
    const postalCode = doc.get('postalCode');
    if (typeof postalCode !== 'string' || keep.has(postalCode)) continue;
    const residentId = doc.get('residentId');
    if (typeof residentId !== 'string') continue;
    stale.push({ id: doc.id, residentId });
  }

  if (stale.length === 0) return 0;

  let unassigned = 0;
  for (const group of chunk(stale, BATCH_PAIRS)) {
    const batch = adminDb.batch();
    for (const a of group) {
      batch.update(adminDb.collection('addresses').doc(a.id), { zoneId: null });
      batch.update(adminDb.collection('users').doc(a.residentId), { zoneId: null });
    }
    await batch.commit();
    unassigned += group.length;
  }
  return unassigned;
}
