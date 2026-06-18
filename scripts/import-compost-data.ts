/**
 * Imports Tia's historical Compost Clubhouse data (the master workbook) into
 * Firestore so the app shows her existing sites + pickups, and the diversion
 * reports reproduce her numbers.
 *
 * Source of truth: scripts/data/compost-import.json (extracted + normalized
 * from "Compost Clubhouse Collection Data.xlsx"). Re-generate that file before
 * re-running if the workbook changes.
 *
 * Idempotent: all imported docs carry `importSource: 'compost-workbook'`.
 * Each run deletes the previously-imported commercialAccounts + binPickups with
 * that tag, then rewrites from the JSON — so re-running is always safe and
 * never duplicates. Manually-created sites (no import tag) are never touched.
 *
 * Writes ONLY to compost collections (commercialAccounts, binPickups) + a
 * dedicated zone/depot. Never touches points, transactions, inventory, or any
 * recycling-program state.
 *
 *   npx tsx --env-file=.env.local scripts/import-compost-data.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/import-compost-data.ts --commit # write
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_admin';
import { FULL_BIN_WEIGHT_LBS, type BinSize } from '../src/lib/logic/binWeightTable';
import { buildCompostMonthlyReport } from '../src/lib/logic/compostReport';

const IMPORT_TAG = 'compost-workbook';
const ZONE_ID = 'columbus-compost';
const DEPOT_ID = 'columbus-compost-depot';
const MATERIAL_ID = 'food_scrap';

const COMMIT = process.argv.includes('--commit');

interface SiteJson {
  siteId: string;
  businessName: string;
  affiliationId: string | null;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  firstMonthKey: string | null;
  collectionDays: number[];
  defaultBinSize: string;
  binsOnSite: number;
  pickupsPerWeek: number;
  contactEmail: string | null;
  driverNotes: string | null;
  active: boolean;
}
interface PickupJson {
  siteId: string;
  timestamp: string;
  monthKey: string;
  binCount: number;
  fullness: number;
  binSize: string;
}

function monthKeyToTimestamp(key: string): Timestamp {
  const [y, m] = key.split('-').map(Number);
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, 1)));
}

async function deleteTagged(collection: string) {
  const snap = await adminDb.collection(collection).where('importSource', '==', IMPORT_TAG).get();
  if (snap.empty) return 0;
  // Batch deletes in chunks of 450.
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = adminDb.batch();
    for (const d of snap.docs.slice(i, i + 450)) batch.delete(d.ref);
    if (COMMIT) await batch.commit();
    n += Math.min(450, snap.docs.length - i);
  }
  return n;
}

async function commitInChunks(ops: { ref: FirebaseFirestore.DocumentReference; data: unknown }[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = adminDb.batch();
    for (const op of ops.slice(i, i + 450)) batch.set(op.ref, op.data as object);
    if (COMMIT) await batch.commit();
  }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, 'data', 'compost-import.json'), 'utf8');
  const { sites, pickups } = JSON.parse(raw) as { sites: SiteJson[]; pickups: PickupJson[] };

  console.log(`Loaded ${sites.length} sites, ${pickups.length} pickups from JSON.`);
  console.log(COMMIT ? '*** COMMIT MODE — writing to Firestore ***' : '--- DRY RUN (pass --commit to write) ---');

  // --- Zone + depot (idempotent) ---
  const zoneRef = adminDb.collection('zones').doc(ZONE_ID);
  const depotRef = adminDb.collection('depots').doc(DEPOT_ID);
  if (COMMIT) {
    const zoneSnap = await zoneRef.get();
    if (!zoneSnap.exists) {
      await zoneRef.set({
        id: ZONE_ID,
        name: 'Columbus Compost',
        depotId: DEPOT_ID,
        pickupDaysOfWeek: [3],
        zipCodes: [],
        createdAt: FieldValue.serverTimestamp(),
        importSource: IMPORT_TAG,
      });
    }
    const depotSnap = await depotRef.get();
    if (!depotSnap.exists) {
      await depotRef.set({
        id: DEPOT_ID,
        name: 'Columbus Compost Depot',
        street: '',
        city: 'Columbus',
        state: 'OH',
        postalCode: '',
        geo: null,
        managerId: null,
        zoneIds: [ZONE_ID],
        acceptedMaterials: [MATERIAL_ID],
        createdAt: FieldValue.serverTimestamp(),
        importSource: IMPORT_TAG,
      });
    }
  }

  // --- Clear prior import ---
  const delAccts = await deleteTagged('commercialAccounts');
  const delPickups = await deleteTagged('binPickups');
  console.log(`Cleared prior import: ${delAccts} accounts, ${delPickups} pickups.`);

  // --- Sites ---
  const siteOps = sites.map((s) => ({
    ref: adminDb.collection('commercialAccounts').doc(s.siteId),
    data: {
      id: s.siteId,
      businessName: s.businessName,
      contactName: '',
      contactPhone: null,
      contactEmail: s.contactEmail,
      street: s.street,
      unit: null,
      city: s.city,
      state: s.state,
      postalCode: s.postalCode,
      geo: null,
      zoneId: ZONE_ID,
      siteType: 'compost',
      defaultBinSize: s.defaultBinSize as BinSize,
      binsOnSite: s.binsOnSite,
      pickupsPerWeek: s.pickupsPerWeek,
      collectionDays: s.collectionDays,
      routeOrder: null,
      affiliationId: s.affiliationId,
      materialIds: [MATERIAL_ID],
      firstMonthOfData: s.firstMonthKey ? monthKeyToTimestamp(s.firstMonthKey) : null,
      active: s.active,
      driverNotes: s.driverNotes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      importSource: IMPORT_TAG,
    },
  }));
  await commitInChunks(siteOps);
  console.log(`Wrote ${siteOps.length} sites.`);

  // --- Pickups ---
  const pickupOps = pickups.map((p, i) => {
    const size = p.binSize as BinSize;
    const full = FULL_BIN_WEIGHT_LBS[size] ?? FULL_BIN_WEIGHT_LBS['32'];
    const weightPerBin = p.fullness * full; // linear model, matches workbook "Alternative Weight"
    const bins = Array.from({ length: p.binCount }, () => ({
      bagId: null,
      binSize: size,
      fullness: p.fullness,
      weightLbs: weightPerBin,
      interpolated: false,
    }));
    const totalWeightLbs = weightPerBin * p.binCount;
    const id = `imp_${p.siteId}_${new Date(p.timestamp).getTime()}_${i}`;
    return {
      ref: adminDb.collection('binPickups').doc(id),
      data: {
        id,
        commercialAccountId: p.siteId,
        zoneId: ZONE_ID,
        operatorId: 'import',
        routeId: null,
        materialId: MATERIAL_ID,
        bins,
        totalWeightLbs,
        contaminationSeverity: 'none',
        driverNotes: null,
        photoUrl: null,
        createdAt: Timestamp.fromDate(new Date(p.timestamp)),
        importSource: IMPORT_TAG,
      },
    };
  });
  await commitInChunks(pickupOps);
  console.log(`Wrote ${pickupOps.length} pickups.`);

  // --- Spot-check the engine against known workbook values ---
  const reportInputs = {
    sites: sites.map((s) => ({
      siteId: s.siteId,
      businessName: s.businessName,
      affiliationId: s.affiliationId,
      binsOnSite: s.binsOnSite,
      active: s.active,
      firstMonthKey: s.firstMonthKey,
    })),
    pickups: pickups.map((p) => ({
      siteId: p.siteId,
      monthKey: p.monthKey,
      totalWeightLbs: p.fullness * (FULL_BIN_WEIGHT_LBS[p.binSize as BinSize] ?? 130) * p.binCount,
      binFullness: Array.from({ length: p.binCount }, () => p.fullness),
      binCount: p.binCount,
    })),
  };
  const cch = buildCompostMonthlyReport(reportInputs.sites, reportInputs.pickups, '2026-04', 'compost_clubhouse');
  const florin = cch.allTimeSites.find((s) => s.businessName === 'Florin Cafe');
  console.log('\nSpot-check (Compost Clubhouse, Apr 2026):');
  console.log(`  Monthly total lbs: ${cch.monthly.weightLbs.toFixed(2)}  (workbook ≈ 27966.33)`);
  console.log(`  Florin all-time lbs: ${florin?.totalCollectedLbs.toFixed(3)}  (workbook = 33373.925)`);
  console.log(`  Florin months active: ${florin?.monthsActive}  (workbook = 33)`);

  if (!COMMIT) console.log('\nDRY RUN complete — no data written. Re-run with --commit to apply.');
  else console.log('\nImport complete.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
