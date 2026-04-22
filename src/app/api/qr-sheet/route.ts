import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

const SHEET_NUMBER_MIN = 1000;
const SHEET_NUMBER_MAX = 9999;
const MAX_COLLISION_RETRIES = 8;

function randomSheetNumber(): string {
  const n =
    Math.floor(Math.random() * (SHEET_NUMBER_MAX - SHEET_NUMBER_MIN + 1)) + SHEET_NUMBER_MIN;
  return String(n);
}

function bagCode(sheetNumber: string, index: number): string {
  return `BAG-${sheetNumber}-${String(index).padStart(2, '0')}`;
}

async function reserveSheetNumber(): Promise<string> {
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const candidate = randomSheetNumber();
    const existing = await adminDb
      .collection('stickerSheets')
      .where('sheetNumber', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  throw new Error('sheet_number_exhausted');
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let sheetNumber: string;
  try {
    sheetNumber = await reserveSheetNumber();
  } catch {
    return NextResponse.json({ error: 'sheet_number_exhausted' }, { status: 503 });
  }

  const sheetRef = adminDb.collection('stickerSheets').doc();
  const bagRefs = Array.from({ length: 10 }, () => adminDb.collection('bags').doc());

  await adminDb.runTransaction(async (tx) => {
    for (let i = 0; i < bagRefs.length; i += 1) {
      const code = bagCode(sheetNumber, i + 1);
      tx.set(bagRefs[i], {
        id: bagRefs[i].id,
        qrCode: code,
        printedNumber: code,
        stickerSheetId: sheetRef.id,
        residentId: null,
        declaredType: null,
        status: 'unused',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(sheetRef, {
      id: sheetRef.id,
      sheetNumber,
      residentId: null,
      bagIds: bagRefs.map((r) => r.id),
      bagOrderId: null,
      printedAt: null,
      issuedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({
    ok: true,
    stickerSheetId: sheetRef.id,
    sheetNumber,
    codes: bagRefs.map((_, i) => bagCode(sheetNumber, i + 1)),
  });
}
