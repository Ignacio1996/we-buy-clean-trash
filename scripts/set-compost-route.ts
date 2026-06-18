/**
 * Applies Tia's "Driver Route Plan" to the existing compost site docs — sets
 * each site's collection day(s) and its `routeOrder` (the order the driver
 * visits, so the operator screen lists stops in route order), and renames the
 * two Sweetgreen locations.
 *
 * Targeted + idempotent: only the siteIds below are touched, only the listed
 * fields change. Pickups, inventory, and untouched sites are left alone. Sunday
 * City-of-Columbus park sites keep day 7 and are intentionally NOT listed here
 * (the plan didn't give a Sunday order — they stay alphabetical).
 *
 * NOTE: a full re-run of import-compost-data.ts would reset these fields (it
 * rewrites from the workbook JSON), so re-apply this script afterwards.
 *
 *   npx tsx --env-file=.env.local scripts/set-compost-route.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/set-compost-route.ts --commit  # write
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

const COMMIT = process.argv.includes('--commit');

interface RouteUpdate {
  siteId: string;
  routeOrder: number;
  /** ISO weekday numbers (1=Mon … 7=Sun). Omit to leave the existing days. */
  collectionDays?: number[];
  /** Rename the site. Omit to leave the existing name. */
  businessName?: string;
}

// Wednesday — Compost Clubhouse route, in the plan's listed order.
// Sweetgreen Dublin also runs Monday (plan's Monday stop #2), so it carries
// both days; its single routeOrder (9) still sorts it after Georgesville on the
// short Monday list.
const WEDNESDAY: RouteUpdate[] = [
  { siteId: 'overlook-cafe', routeOrder: 1 },
  { siteId: 'franklin-county-public-health', routeOrder: 2 },
  { siteId: 'the-columbus-foundation', routeOrder: 3 },
  { siteId: 'columbus-school-girls-csg', routeOrder: 4 },
  { siteId: 'motherful', routeOrder: 5 },
  { siteId: 'florin-cafe', routeOrder: 6 },
  { siteId: 'the-wellington-school', routeOrder: 7 },
  { siteId: 'brekkie-shack', routeOrder: 8 },
  {
    siteId: 'sweetgreen',
    routeOrder: 9,
    businessName: 'Sweetgreen Dublin',
    collectionDays: [1, 3],
  },
  {
    siteId: 'reynoldsburg',
    routeOrder: 10,
    businessName: 'Sweetgreen Reynoldsburg',
    collectionDays: [3],
  },
];

// Monday — compost startup. Georgesville is first; Dora Lofts (a recycling
// stop) is created separately and isn't a food-scrap site.
const MONDAY: RouteUpdate[] = [
  { siteId: 'georgesville-convenience-center', routeOrder: 1, collectionDays: [1] },
];

const UPDATES = [...MONDAY, ...WEDNESDAY];

async function main() {
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${UPDATES.length} site updates\n`);
  let applied = 0;
  let missing = 0;

  for (const u of UPDATES) {
    const ref = adminDb.collection('commercialAccounts').doc(u.siteId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ✗ MISSING  ${u.siteId} — no such site doc`);
      missing += 1;
      continue;
    }
    const cur = snap.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      routeOrder: u.routeOrder,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (u.collectionDays) patch.collectionDays = u.collectionDays;
    if (u.businessName) patch.businessName = u.businessName;

    const changes = [
      `order=${u.routeOrder}`,
      u.collectionDays ? `days ${JSON.stringify(cur.collectionDays)}→${JSON.stringify(u.collectionDays)}` : null,
      u.businessName && u.businessName !== cur.businessName
        ? `name "${cur.businessName}"→"${u.businessName}"`
        : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`  ✓ ${u.siteId.padEnd(34)} ${changes}`);

    if (COMMIT) await ref.update(patch);
    applied += 1;
  }

  console.log(`\n${COMMIT ? 'Wrote' : 'Would write'} ${applied} site(s). ${missing} missing.`);
  if (!COMMIT) console.log('Re-run with --commit to apply.');
}

main().then(() => process.exit(0));
