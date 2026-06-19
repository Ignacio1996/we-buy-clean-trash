/**
 * Read-only dump of every commercial compost site — id, name, status, days,
 * bins, pickups/week. Used to ground data-correction scripts against the live
 * docs (no writes).
 *
 *   npx tsx --env-file=.env.local scripts/list-compost-sites.ts
 */
import { adminDb } from './_admin';

async function main() {
  const snap = await adminDb.collection('commercialAccounts').get();
  const rows = snap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .sort((a, b) => String(a.businessName).localeCompare(String(b.businessName)));

  console.log(`${rows.length} commercial sites\n`);
  for (const r of rows) {
    const days = Array.isArray(r.collectionDays) ? r.collectionDays.join(',') : '—';
    console.log(
      [
        String(r.id).padEnd(38),
        String(r.businessName).slice(0, 32).padEnd(34),
        `active=${r.active !== false ? 'Y' : 'N'}`,
        `status=${r.status ?? 'active'}`.padEnd(15),
        `type=${r.siteType ?? 'compost'}`.padEnd(20),
        `days=[${days}]`.padEnd(14),
        `bins=${r.binsOnSite ?? 0}`,
        `/wk=${r.pickupsPerWeek ?? '?'}`,
      ].join('  '),
    );
  }
}

main().then(() => process.exit(0));
