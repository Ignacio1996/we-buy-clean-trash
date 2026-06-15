/**
 * Standalone verification for the compost report engine — no test framework in
 * this repo, so this asserts the engine against hand-verified values.
 * Run with:  npx tsx scripts/verify-compost-report.ts
 *
 * Semantics (measured totals — see "planning/Compost Integration - Phase C.md"):
 *   - A month's total = (reported lbs / pickup entries) × 4.35.
 *   - Months with no pickups contribute 0 (NO carry-forward).
 *   - Cumulative = running sum of monthly totals.
 *   - The monthly KPI excludes inactive sites.
 *
 * Reference (Chapman's Eat Market, first month): 585 lbs over 2 entries →
 * weeklyAvg 292.5 → monthly 292.5 × 4.35 = 1272.375.
 */
import {
  buildSiteSeries,
  buildCompostMonthlyReport,
  monthsBetween,
  type ReportSiteInput,
  type ReportPickupInput,
} from '../src/lib/logic/compostReport';

let failures = 0;
function check(label: string, actual: number, expected: number, tol = 1e-6) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${actual}, expected ${expected}`);
}
function checkEq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${String(actual)}, expected ${String(expected)}`);
}

const activeSite: ReportSiteInput = {
  siteId: 'florin',
  businessName: 'Florin Cafe',
  affiliationId: 'compost_clubhouse',
  binsOnSite: 1,
  active: true,
  firstMonthKey: '2023-07',
};
const inactiveSite: ReportSiteInput = {
  siteId: 'chapmans',
  businessName: "Chapman's Eat Market",
  affiliationId: 'compost_clubhouse',
  binsOnSite: 2,
  active: false,
  firstMonthKey: '2023-07',
};

// Each site: two Jul pickups summing to 585 lbs across 2 entries; nothing in Aug.
const pickups: ReportPickupInput[] = [
  { siteId: 'florin', monthKey: '2023-07', totalWeightLbs: 292.5, binFullness: [0.5], binCount: 3 },
  { siteId: 'florin', monthKey: '2023-07', totalWeightLbs: 292.5, binFullness: [0.75], binCount: 2 },
  { siteId: 'chapmans', monthKey: '2023-07', totalWeightLbs: 292.5, binFullness: [0.5], binCount: 3 },
  { siteId: 'chapmans', monthKey: '2023-07', totalWeightLbs: 292.5, binFullness: [0.75], binCount: 2 },
];

// --- Series math (measured, no carry-forward) ---
const series = buildSiteSeries(activeSite, pickups, '2023-08');
const jul = series.rows.find((r) => r.monthKey === '2023-07')!;
const aug = series.rows.find((r) => r.monthKey === '2023-08')!;

check('Jul reportedTotal', jul.reportedTotalLbs, 585);
checkEq('Jul entryCount', jul.entryCount, 2);
check('Jul weeklyAvg', jul.weeklyAvgLbs, 292.5);
check('Jul monthlyTotal (×4.35)', jul.monthlyTotalLbs, 1272.375);
check('Jul cumulative', jul.cumulativeLbs, 1272.375);
check('Jul avgBinCount', jul.avgBinCount ?? -1, 2.5);

checkEq('Aug entryCount (gap)', aug.entryCount, 0);
check('Aug monthlyTotal (no carry-forward)', aug.monthlyTotalLbs, 0);
check('Aug cumulative (unchanged)', aug.cumulativeLbs, 1272.375);
checkEq('Aug avgFullness (null in gap)', aug.avgFullness, null);

// --- Months active (DATEDIF "m") ---
checkEq('monthsBetween Jul2023→Apr2026', monthsBetween('2023-07', '2026-04'), 33);

// --- Assembled report at the data month, with one inactive site present ---
const report = buildCompostMonthlyReport([activeSite, inactiveSite], pickups, '2023-07', 'compost_clubhouse');
check('Monthly KPI excludes inactive', report.monthly.weightLbs, 1272.375);
check('All-time KPI includes both sites', report.allTime.weightLbs, 2544.75);
check('All-time cars (lbs / 1.17)', report.allTime.cars, 2544.75 / 1.17);
checkEq('Report site count (active + inactive)', report.sites.length, 2);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
