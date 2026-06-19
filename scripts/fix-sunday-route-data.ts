/**
 * Data corrections from Tia's Fri 6/19 operator walkthrough — schedule days,
 * summer-break pauses, the Dora Lofts removal, and the Alum Creek drop-off
 * zone fix. Targeted + idempotent: only the docs/fields below are touched.
 *
 * Bin counts (binsOnSite) are NOT changed — the live data already matches the
 * Directory sheet (Anheuser-Busch 9, Sweetgreen Dublin 4, …). The wrong counts
 * Tia saw on the operator screen were a display bug (it counted provisioned QR
 * bag docs, not binsOnSite), fixed separately in operator/compost/page.tsx.
 *
 *   npx tsx --env-file=.env.local scripts/fix-sunday-route-data.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/fix-sunday-route-data.ts --commit  # write
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

const COMMIT = process.argv.includes('--commit');

interface SiteFix {
  siteId: string;
  /** ISO weekday numbers (1=Mon … 7=Sun). Omit to leave the existing days. */
  collectionDays?: number[];
  /** Pickups per week — keep in sync with the number of collection days. */
  pickupsPerWeek?: number;
  /** Declared bins on site — only when the Directory sheet disagrees with live. */
  binsOnSite?: number;
  /** 'paused' drops a summer-closed site off the operator's daily list. */
  status?: 'active' | 'paused';
  /** false soft-deletes the site (off the operator list and all reports). */
  active?: boolean;
  why: string;
}

const SITE_FIXES: SiteFix[] = [
  // "Alum Creek Convenience Center is Monday" — was on Sunday. (The transcript's
  // "Elm Creek Convenience Center" is this same site; there is no Elm Creek doc.)
  { siteId: 'alum-creek-convenience-center', collectionDays: [1], pickupsPerWeek: 1, why: 'Sun → Mon' },

  // "Sweetgreen is actually Monday, Tuesday, Thursday, and Friday."
  { siteId: 'sweetgreen', collectionDays: [1, 2, 4, 5], pickupsPerWeek: 4, why: 'Mon/Wed → Mon/Tue/Thu/Fri' },

  // "Overlook Cafe? Wednesday, Friday."
  { siteId: 'overlook-cafe', collectionDays: [3, 5], pickupsPerWeek: 2, why: 'Wed → Wed/Fri' },

  // Directory sheet says 5 bins; live data had 2.
  { siteId: 'linden-park-community-center', binsOnSite: 5, why: 'bins 2 → 5 per Directory' },

  // Summer break — pause so the gap doesn't read as a missed pickup.
  { siteId: 'columbus-school-girls-csg', status: 'paused', why: 'summer break' },
  { siteId: 'the-wellington-school', status: 'paused', why: 'summer break' },

  // "I would take out Dora Lofts" — recycling-only test site, one truck does both
  // workloads, mixing it confuses the City of Columbus report. Soft-delete.
  { siteId: 'dora-lofts', active: false, why: 'remove (recycling test, off reports)' },
];

interface DestinationFix {
  destId: string;
  zoneId: string;
  why: string;
}

const DESTINATION_FIXES: DestinationFix[] = [
  // Alum Creek drop-off lived in the "Ohio Market" zone, so it was filtered out
  // of Tia's (columbus-compost) drop-off picker. Move it to the compost zone.
  { destId: '0QJRpuM7WWjwD0luYRO3', zoneId: 'columbus-compost', why: 'show in compost drop-off picker' },
];

async function main() {
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${SITE_FIXES.length} sites, ${DESTINATION_FIXES.length} destinations\n`);
  let applied = 0;
  let missing = 0;

  console.log('Sites:');
  for (const f of SITE_FIXES) {
    const ref = adminDb.collection('commercialAccounts').doc(f.siteId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ✗ MISSING  ${f.siteId}`);
      missing += 1;
      continue;
    }
    const cur = snap.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const changes: string[] = [];
    if (f.collectionDays) {
      patch.collectionDays = f.collectionDays;
      changes.push(`days ${JSON.stringify(cur.collectionDays)}→${JSON.stringify(f.collectionDays)}`);
    }
    if (f.pickupsPerWeek !== undefined && f.pickupsPerWeek !== cur.pickupsPerWeek) {
      patch.pickupsPerWeek = f.pickupsPerWeek;
      changes.push(`/wk ${cur.pickupsPerWeek}→${f.pickupsPerWeek}`);
    }
    if (f.binsOnSite !== undefined && f.binsOnSite !== cur.binsOnSite) {
      patch.binsOnSite = f.binsOnSite;
      changes.push(`bins ${cur.binsOnSite}→${f.binsOnSite}`);
    }
    if (f.status && f.status !== (cur.status ?? 'active')) {
      patch.status = f.status;
      changes.push(`status ${cur.status ?? 'active'}→${f.status}`);
    }
    if (f.active !== undefined && f.active !== (cur.active !== false)) {
      patch.active = f.active;
      changes.push(`active ${cur.active !== false}→${f.active}`);
    }
    console.log(`  ✓ ${f.siteId.padEnd(34)} ${changes.join(', ') || '(no change)'}  — ${f.why}`);
    if (COMMIT && changes.length > 0) await ref.update(patch);
    applied += 1;
  }

  console.log('\nDestinations:');
  for (const f of DESTINATION_FIXES) {
    const ref = adminDb.collection('compostDestinations').doc(f.destId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ✗ MISSING  ${f.destId}`);
      missing += 1;
      continue;
    }
    const cur = snap.data() as Record<string, unknown>;
    console.log(
      `  ✓ ${String(cur.name ?? f.destId).padEnd(20)} zone ${cur.zoneId}→${f.zoneId}  — ${f.why}`,
    );
    if (COMMIT && cur.zoneId !== f.zoneId) {
      await ref.update({ zoneId: f.zoneId, updatedAt: FieldValue.serverTimestamp() });
    }
    applied += 1;
  }

  console.log(`\n${COMMIT ? 'Applied' : 'Would apply'} ${applied} doc(s). ${missing} missing.`);
  if (!COMMIT) console.log('Re-run with --commit to write.');
}

main().then(() => process.exit(0));
