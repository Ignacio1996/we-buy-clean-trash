import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Records demand for a ZIP the pilot doesn't yet serve, so admin can see where
 * to extend zones. One doc per ZIP (`coverageRequests/{zip}`), tallying how many
 * times it was checked at signup (`lookups`) and how many people signed up
 * anyway with no zone (`signups`, a stronger signal). Written server-side only
 * via the Admin SDK — clients never touch this collection.
 *
 * Best-effort: a logging failure must never break the signup path, so this
 * swallows its own errors.
 */
export async function recordCoverageRequest(
  zip: string,
  kind: 'lookup' | 'signup',
): Promise<void> {
  if (!/^\d{5}$/.test(zip)) return;
  const field = kind === 'signup' ? 'signups' : 'lookups';
  try {
    const ref = adminDb.collection('coverageRequests').doc(zip);
    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const now = FieldValue.serverTimestamp();
      if (doc.exists) {
        tx.update(ref, { [field]: FieldValue.increment(1), lastRequestedAt: now });
      } else {
        tx.set(ref, {
          zip,
          lookups: kind === 'lookup' ? 1 : 0,
          signups: kind === 'signup' ? 1 : 0,
          firstRequestedAt: now,
          lastRequestedAt: now,
        });
      }
    });
  } catch (err) {
    console.error('[coverageRequests] record failed', err);
  }
}
