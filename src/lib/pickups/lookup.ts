import { adminDb } from '@/lib/firebase/admin';
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

/**
 * Resolve a scanned QR value or typed printed number to its `bags` doc.
 * Matches `qrCode` first, then falls back to `printedNumber`.
 * Returns null when nothing matches.
 */
export async function findBagByCode(
  code: string,
): Promise<QueryDocumentSnapshot<DocumentData> | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const byQr = await adminDb.collection('bags').where('qrCode', '==', trimmed).limit(1).get();
  if (!byQr.empty) return byQr.docs[0];

  const byPrinted = await adminDb
    .collection('bags')
    .where('printedNumber', '==', trimmed)
    .limit(1)
    .get();
  if (!byPrinted.empty) return byPrinted.docs[0];

  return null;
}
