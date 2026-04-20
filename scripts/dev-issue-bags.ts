import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_admin';

function generateBagId(
  sheetNumber: number,
  bagIndex: number,
): { qrCode: string; printedNumber: string } {
  const qrCode = `BAG-${sheetNumber}-${String(bagIndex).padStart(2, '0')}`;
  const printedNumber = qrCode;
  return { qrCode, printedNumber };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run dev:issue-bags -- <uid-or-email>');
    process.exit(1);
  }

  const user = arg.includes('@')
    ? await adminAuth.getUserByEmail(arg)
    : await adminAuth.getUser(arg);

  const sheetRef = adminDb.collection('stickerSheets').doc();
  const sheetNumber = Math.floor(Math.random() * 9000) + 1000;
  const bagRefs = Array.from({ length: 10 }, () => adminDb.collection('bags').doc());

  await adminDb.runTransaction(async (tx) => {
    for (let i = 0; i < bagRefs.length; i += 1) {
      const { qrCode, printedNumber } = generateBagId(sheetNumber, i + 1);
      tx.set(bagRefs[i], {
        id: bagRefs[i].id,
        qrCode,
        printedNumber,
        stickerSheetId: sheetRef.id,
        residentId: user.uid,
        declaredType: null,
        status: 'unused',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(sheetRef, {
      id: sheetRef.id,
      residentId: user.uid,
      bagIds: bagRefs.map((r) => r.id),
      bagOrderId: null,
      printedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  console.log(`✓ issued sheet ${sheetRef.id} with 10 bags to ${user.email ?? user.uid}`);
  console.log('\nScan any of these codes on /resident/scan-bag:');
  for (let i = 0; i < 10; i += 1) {
    console.log(`  ${generateBagId(sheetNumber, i + 1).qrCode}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
