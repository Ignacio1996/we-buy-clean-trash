/**
 * Creates the Dora Lofts site — a recycling cart-check stop (not food scrap)
 * from Tia's route plan (Monday startup + Thursday). Idempotent: fixed doc id,
 * so re-running just rewrites the same record.
 *
 *   npx tsx --env-file=.env.local scripts/create-dora-lofts.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/create-dora-lofts.ts --commit  # write
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

const COMMIT = process.argv.includes('--commit');
const ZONE_ID = 'columbus-compost';
const SITE_ID = 'dora-lofts';

const data = {
  id: SITE_ID,
  businessName: 'Dora Lofts',
  contactName: '',
  contactPhone: null,
  contactEmail: null,
  street: '1608 Greenway Ave.',
  unit: null,
  city: 'Columbus',
  state: 'OH',
  postalCode: '43203',
  geo: null,
  zoneId: ZONE_ID,
  siteType: 'recycling_check',
  // defaultBinSize/binsOnSite are unused for a recycling-check stop but kept to
  // satisfy the shared site shape.
  defaultBinSize: '32',
  binsOnSite: 0,
  pickupsPerWeek: 2,
  collectionDays: [1, 4], // Monday + Thursday
  routeOrder: 3, // Monday stop #3 (after Georgesville, Sweetgreen)
  affiliationId: null,
  materialIds: [],
  firstMonthOfData: null,
  active: true,
  status: 'active',
  driverNotes:
    'Recycling cart check — check carts, photo the cart area, flag contamination/overflow. No compost here.',
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
};

async function main() {
  const ref = adminDb.collection('commercialAccounts').doc(SITE_ID);
  const snap = await ref.get();
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${snap.exists ? 'overwrite' : 'create'} ${SITE_ID}`);
  console.log(
    `  Dora Lofts · recycling_check · days [Mon, Thu] · order 3 · ${data.street}, ${data.city}`,
  );
  if (COMMIT) {
    await ref.set(data, { merge: true });
    console.log('  ✓ written');
  } else {
    console.log('  Re-run with --commit to apply.');
  }
}

main().then(() => process.exit(0));
