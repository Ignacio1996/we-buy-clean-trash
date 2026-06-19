/**
 * Provision QR-coded bins for commercial compost sites so they match the
 * declared `binsOnSite` / `defaultBinSize` from the Compost Clubhouse workbook.
 *
 * Background: importing the workbook only set the `binsOnSite` number and
 * `defaultBinSize` on each `commercialAccounts` doc — it never created the
 * actual coded bin documents (top-level `bags` with reusable=true and a
 * `BIN-####` qrCode). Bin docs are only ever created by the admin "Provision
 * bins" form. This script back-fills them in bulk.
 *
 * Target set: ACTIVE, siteType=compost (not recycling_check), non-TEST sites
 * with binsOnSite > 0.
 *
 * For each target it ensures EXACTLY `binsOnSite` reusable bins of
 * `defaultBinSize` exist:
 *   - already correct (count + every size matches) → skipped, codes preserved
 *   - otherwise → existing reusable bins deleted and re-created to match
 *     ("reset to match sheet exactly")
 *
 * Bin codes (`qrCode` === `printedNumber`) match the app's format: `BIN-####`,
 * a random 4-digit number, globally unique across the `bags` collection.
 *
 * Historical `binPickups` records snapshot their own bin data, so deleting old
 * bin docs does not break reporting — stale bagId references are simply inert.
 *
 * DRY-RUN by default (prints the plan, writes nothing). Pass --commit to write.
 *
 *   npx tsx --env-file=.env.local scripts/provision-compost-bins.ts
 *   npx tsx --env-file=.env.local scripts/provision-compost-bins.ts --commit
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_admin';

const COMMIT = process.argv.includes('--commit');

const BIN_NUMBER_MIN = 1000;
const BIN_NUMBER_MAX = 9999;

type BinSize = '32' | '48' | '64';
type ContainerType = 'bin_32' | 'bin_48' | 'bin_64';

function normalizeBinSize(raw: unknown): BinSize {
  const s = String(raw ?? '').trim();
  if (s === '48') return '48';
  if (s === '64') return '64';
  return '32'; // default / fallback
}

function binSizeToContainer(size: BinSize): ContainerType {
  if (size === '48') return 'bin_48';
  if (size === '64') return 'bin_64';
  return 'bin_32';
}

function isTestSite(id: string, name: string): boolean {
  return id.startsWith('test-compost-site') || /\(TEST\)/i.test(name);
}

/** Allocate `n` globally-unique BIN-#### codes, avoiding ones already taken. */
function allocateCodes(n: number, taken: Set<string>): string[] {
  const out: string[] = [];
  let guard = 0;
  while (out.length < n) {
    if (guard++ > 100000) throw new Error('bin_number_exhausted');
    const num = Math.floor(Math.random() * (BIN_NUMBER_MAX - BIN_NUMBER_MIN + 1)) + BIN_NUMBER_MIN;
    const code = `BIN-${num}`;
    if (taken.has(code)) continue;
    taken.add(code);
    out.push(code);
  }
  return out;
}

interface Plan {
  id: string;
  name: string;
  targetCount: number;
  size: BinSize;
  existing: { id: string; qrCode: string; containerType: string }[];
  action: 'skip' | 'reset' | 'create';
}

async function main() {
  console.log(`\n=== Provision compost bins (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===\n`);

  const acctSnap = await adminDb.collection('commercialAccounts').get();

  // Pre-load every existing qrCode so generated codes are globally unique
  // without a per-code Firestore round-trip.
  const allBags = await adminDb.collection('bags').select('qrCode').get();
  const taken = new Set<string>();
  allBags.docs.forEach((d) => {
    const c = d.get('qrCode');
    if (typeof c === 'string') taken.add(c);
  });

  // Existing reusable bins grouped by commercialAccountId.
  const reusableSnap = await adminDb.collection('bags').where('reusable', '==', true).get();
  const binsByAcct = new Map<string, { id: string; qrCode: string; containerType: string }[]>();
  reusableSnap.docs.forEach((d) => {
    const x = d.data();
    const k = typeof x.commercialAccountId === 'string' ? x.commercialAccountId : '';
    if (!k) return;
    if (!binsByAcct.has(k)) binsByAcct.set(k, []);
    binsByAcct.get(k)!.push({ id: d.id, qrCode: x.qrCode, containerType: x.containerType });
  });

  const plans: Plan[] = [];

  for (const doc of acctSnap.docs) {
    const a = doc.data() as Record<string, unknown>;
    const id = doc.id;
    const name = String(a.businessName ?? id);
    const active = a.active !== false;
    const siteType = (a.siteType as string) ?? 'compost';
    const binsOnSite = Number(a.binsOnSite ?? 0);

    // Scope: active compost sites only, excluding TEST sites.
    if (!active) continue;
    if (siteType === 'recycling_check') continue;
    if (isTestSite(id, name)) continue;
    if (!(binsOnSite > 0)) continue;

    const size = normalizeBinSize(a.defaultBinSize);
    const wantContainer = binSizeToContainer(size);
    const existing = binsByAcct.get(id) ?? [];

    const alreadyCorrect =
      existing.length === binsOnSite && existing.every((b) => b.containerType === wantContainer);

    let action: Plan['action'];
    if (alreadyCorrect) action = 'skip';
    else if (existing.length > 0) action = 'reset';
    else action = 'create';

    plans.push({ id, name, targetCount: binsOnSite, size, existing, action });
  }

  plans.sort((a, b) => a.name.localeCompare(b.name));

  let toCreate = 0;
  let toDelete = 0;
  for (const p of plans) {
    const tag =
      p.action === 'skip'
        ? 'SKIP (already correct)'
        : p.action === 'reset'
          ? `RESET delete ${p.existing.length} → create ${p.targetCount}`
          : `CREATE ${p.targetCount}`;
    console.log(
      `${p.name.slice(0, 30).padEnd(32)} ${p.size.padStart(2)}gal  ${tag}`,
    );
    if (p.action !== 'skip') toCreate += p.targetCount;
    if (p.action === 'reset') toDelete += p.existing.length;
  }

  console.log(
    `\nSites: ${plans.length} in scope | bins to delete: ${toDelete} | bins to create: ${toCreate}`,
  );

  if (!COMMIT) {
    console.log('\nDRY-RUN — no writes. Re-run with --commit to apply.\n');
    return;
  }

  console.log('\nApplying...\n');
  for (const p of plans) {
    if (p.action === 'skip') continue;

    const container = binSizeToContainer(p.size);
    const batch = adminDb.batch();

    // Delete existing reusable bins (reset).
    for (const b of p.existing) {
      batch.delete(adminDb.collection('bags').doc(b.id));
    }

    // Create the target bins.
    const codes = allocateCodes(p.targetCount, taken);
    for (const code of codes) {
      const ref = adminDb.collection('bags').doc();
      batch.set(ref, {
        id: ref.id,
        qrCode: code,
        printedNumber: code,
        stickerSheetId: `commercial:${p.id}`,
        residentId: null,
        commercialAccountId: p.id,
        declaredType: null,
        status: 'unused',
        containerType: container,
        reusable: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(
      `  ${p.name.slice(0, 30).padEnd(32)} done — ${codes.length} bins [${codes.join(' ')}]`,
    );
  }

  console.log('\nDone.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
