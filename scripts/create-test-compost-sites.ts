/**
 * Creates two TEST compost sites for a hands-on workflow run with Tia.
 *
 * Each site is a `commercialAccounts` doc (siteType: 'compost') with "TEST" in
 * the business name so it's obvious in the operator UI that it's not real. Both
 * collect every weekday (collectionDays Mon–Fri) so they always show in the
 * operator's daily list regardless of the test day, and each is provisioned with
 * 2 reusable bins (BagDocs, reusable: true) so the QR-scan pickup flow works.
 *
 * Idempotent: fixed site doc ids (re-running rewrites the same sites). Bins are
 * only provisioned if the site has none yet, so re-running won't duplicate them.
 *
 *   npx tsx --env-file=.env.local scripts/create-test-compost-sites.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/create-test-compost-sites.ts --commit  # write
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

const COMMIT = process.argv.includes('--commit');
const ZONE_ID = 'columbus-compost';

const BINS_PER_SITE = 2;
const BIN_NUMBER_MIN = 1000;
const BIN_NUMBER_MAX = 9999;
const MAX_COLLISION_RETRIES = 12;

type ContainerType = 'bin_32' | 'bin_48' | 'bin_64';

const SITES = [
  {
    id: 'test-compost-site-1',
    businessName: 'Test Compost Site 1 (TEST)',
    street: '100 Test Ave',
    postalCode: '43201',
    defaultBinSize: '64' as const,
    containerType: 'bin_64' as ContainerType,
    routeOrder: 1,
  },
  {
    id: 'test-compost-site-2',
    businessName: 'Test Compost Site 2 (TEST)',
    street: '200 Test Blvd',
    postalCode: '43203',
    defaultBinSize: '32' as const,
    containerType: 'bin_32' as ContainerType,
    routeOrder: 2,
  },
];

function buildSiteDoc(site: (typeof SITES)[number]) {
  return {
    id: site.id,
    businessName: site.businessName,
    contactName: 'Tia (test)',
    contactPhone: null,
    contactEmail: null,
    street: site.street,
    unit: null,
    city: 'Columbus',
    state: 'OH',
    postalCode: site.postalCode,
    geo: null,
    zoneId: ZONE_ID,
    siteType: 'compost' as const,
    defaultBinSize: site.defaultBinSize,
    binsOnSite: BINS_PER_SITE,
    pickupsPerWeek: 5,
    collectionDays: [1, 2, 3, 4, 5], // every weekday so it always shows during testing
    routeOrder: site.routeOrder,
    affiliationId: 'compost_clubhouse',
    materialIds: ['food_scrap'],
    firstMonthOfData: null,
    active: true,
    status: 'active' as const,
    driverNotes: 'TEST site — created for the workflow walkthrough with Tia. Safe to delete after.',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function randomBinNumber(): string {
  const n = Math.floor(Math.random() * (BIN_NUMBER_MAX - BIN_NUMBER_MIN + 1)) + BIN_NUMBER_MIN;
  return String(n);
}

async function reserveBinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const candidate = `BIN-${randomBinNumber()}`;
    const existing = await adminDb
      .collection('bags')
      .where('qrCode', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  throw new Error('bin_number_exhausted');
}

async function provisionBins(siteId: string, containerType: ContainerType): Promise<string[]> {
  // Skip if this site already has bins — keeps the script idempotent.
  const existing = await adminDb
    .collection('bags')
    .where('commercialAccountId', '==', siteId)
    .limit(1)
    .get();
  if (!existing.empty) {
    console.log(`    bins already provisioned — skipping`);
    return [];
  }

  const codes: string[] = [];
  for (let i = 0; i < BINS_PER_SITE; i += 1) codes.push(await reserveBinCode());
  const bagRefs = codes.map(() => adminDb.collection('bags').doc());

  await adminDb.runTransaction(async (tx) => {
    for (let i = 0; i < bagRefs.length; i += 1) {
      tx.set(bagRefs[i], {
        id: bagRefs[i].id,
        qrCode: codes[i],
        printedNumber: codes[i],
        stickerSheetId: `commercial:${siteId}`,
        residentId: null,
        commercialAccountId: siteId,
        declaredType: null,
        status: 'unused',
        containerType,
        reusable: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
  return codes;
}

async function main() {
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — 2 TEST compost sites in zone ${ZONE_ID}\n`);

  for (const site of SITES) {
    const ref = adminDb.collection('commercialAccounts').doc(site.id);
    const snap = await ref.get();
    console.log(`${snap.exists ? 'overwrite' : 'create'} ${site.id}`);
    console.log(
      `  ${site.businessName} · compost · days [Mon–Fri] · order ${site.routeOrder} · ${BINS_PER_SITE}× ${site.defaultBinSize}gal bins`,
    );

    if (!COMMIT) continue;

    await ref.set(buildSiteDoc(site), { merge: true });
    console.log('  ✓ site written');
    const codes = await provisionBins(site.id, site.containerType);
    if (codes.length) console.log(`  ✓ bins: ${codes.join(', ')}`);
  }

  if (!COMMIT) console.log('\nRe-run with --commit to apply.');
}

main().then(() => process.exit(0));
