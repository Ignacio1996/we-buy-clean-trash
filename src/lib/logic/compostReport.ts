/**
 * Compost diversion report engine — a pure, framework-free reproduction of the
 * "Fill in the Gaps" + "Monthly Reports" sheets in Tia's master workbook.
 *
 * No Firebase / Next imports: callers load the raw pickups + site directory and
 * hand plain objects in, so this stays trivially unit-testable. All month math
 * is done on "YYYY-MM" keys.
 *
 * See "planning/Compost Integration - Phase C.md" for the full analysis and the
 * validation targets these functions are built to reproduce.
 */
import {
  MONTHLY_MULTIPLIER,
  LBS_PER_TON,
  co2eqTons,
  carsEquivalent,
  carsEquivalentNote,
} from './compostReporting';

// ---------------------------------------------------------------------------
// Month-key helpers ("YYYY-MM")
// ---------------------------------------------------------------------------

/** Validates a "YYYY-MM" key. */
export function isMonthKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Converts a "YYYY-MM" key to an absolute month index (year*12 + month-1). */
function monthIndex(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
}

/** Converts an absolute month index back to a "YYYY-MM" key. */
function monthKeyFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Full months between two keys (DATEDIF "m" semantics). Returns 0 when `to` is
 * the same month as `from`, and a negative number when `to` precedes `from`.
 */
export function monthsBetween(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from);
}

/** Inclusive list of month keys from `start` to `end`. Empty if start > end. */
function monthRange(start: string, end: string): string[] {
  const a = monthIndex(start);
  const b = monthIndex(end);
  const out: string[] = [];
  for (let i = a; i <= b; i++) out.push(monthKeyFromIndex(i));
  return out;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One pickup event (the binPickups analogue of a single Form Response row). */
export interface ReportPickupInput {
  siteId: string;
  /** Month the pickup happened, as "YYYY-MM". */
  monthKey: string;
  /** Total weight for the pickup (sum across its bins). */
  totalWeightLbs: number;
  /** Fullness fraction per bin (0..1) — used for the avg-fullness column. */
  binFullness: number[];
  /** Number of bins emptied in this pickup — used for the avg-bin-count column. */
  binCount: number;
}

/** A site from the directory (commercialAccounts). */
export interface ReportSiteInput {
  siteId: string;
  businessName: string;
  affiliationId: string | null;
  /** Bins currently on site — the "Bins on Site" reference column. */
  binsOnSite: number;
  active: boolean;
  /** First month this site has data, as "YYYY-MM". Null → months-active unknown. */
  firstMonthKey: string | null;
}

// ---------------------------------------------------------------------------
// Per-site monthly series ("Fill in the Gaps")
// ---------------------------------------------------------------------------

export interface SiteMonthRow {
  monthKey: string;
  /** Sum of pickup weights actually recorded this month. */
  reportedTotalLbs: number;
  /** Number of pickup events this month. */
  entryCount: number;
  /** reportedTotalLbs / entryCount (0 when no entries). */
  weeklyAvgLbs: number;
  /**
   * The extrapolated monthly figure: weeklyAvg × 4.35. Months with zero pickups
   * contribute 0 — we report *measured* diversion only, and do NOT carry a prior
   * month's total forward. (Tia's legacy workbook carried forward indefinitely
   * and applied manual seasonal resets; those are editorial estimates, not
   * measured weight, so the app deliberately diverges. See Phase C doc.)
   */
  monthlyTotalLbs: number;
  /** Running sum of monthlyTotalLbs through this month. */
  cumulativeLbs: number;
  /** Mean per-pickup fullness this month, or null when no entries. */
  avgFullness: number | null;
  /** Mean bins-per-pickup this month, or null when no entries. */
  avgBinCount: number | null;
}

export interface SiteSeries {
  siteId: string;
  businessName: string;
  affiliationId: string | null;
  rows: SiteMonthRow[];
}

interface MonthBucket {
  weightLbs: number;
  entryCount: number;
  /** One representative fullness per pickup (mean of its bins). */
  fullnessPerPickup: number[];
  /** Bin count per pickup. */
  binCounts: number[];
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Builds the month-by-month series for one site, from its start month through
 * `reportMonthKey`. Each month's total is the measured weekly-average × 4.35;
 * months without pickups contribute 0 (no carry-forward — see SiteMonthRow).
 *
 * Start month = firstMonthKey, else the earliest pickup month, else the report
 * month. If the start month is after the report month (site not yet active),
 * the series is a single zero row at the report month.
 */
export function buildSiteSeries(
  site: ReportSiteInput,
  pickups: readonly ReportPickupInput[],
  reportMonthKey: string,
): SiteSeries {
  // Bucket this site's pickups by month.
  const buckets = new Map<string, MonthBucket>();
  let earliest: string | null = null;
  for (const p of pickups) {
    if (p.siteId !== site.siteId) continue;
    if (!earliest || monthIndex(p.monthKey) < monthIndex(earliest)) earliest = p.monthKey;
    let b = buckets.get(p.monthKey);
    if (!b) {
      b = { weightLbs: 0, entryCount: 0, fullnessPerPickup: [], binCounts: [] };
      buckets.set(p.monthKey, b);
    }
    b.weightLbs += p.totalWeightLbs;
    b.entryCount += 1;
    if (p.binFullness.length > 0) b.fullnessPerPickup.push(mean(p.binFullness));
    b.binCounts.push(p.binCount);
  }

  let start = site.firstMonthKey ?? earliest ?? reportMonthKey;
  // Don't start after the report month.
  if (monthIndex(start) > monthIndex(reportMonthKey)) start = reportMonthKey;

  const rows: SiteMonthRow[] = [];
  let cumulative = 0;
  for (const monthKey of monthRange(start, reportMonthKey)) {
    const b = buckets.get(monthKey);
    const reportedTotalLbs = b?.weightLbs ?? 0;
    const entryCount = b?.entryCount ?? 0;
    const weeklyAvgLbs = entryCount > 0 ? reportedTotalLbs / entryCount : 0;
    // Measured only: a month with no pickups contributes 0 (no carry-forward).
    const monthlyTotalLbs = entryCount > 0 ? weeklyAvgLbs * MONTHLY_MULTIPLIER : 0;
    cumulative += monthlyTotalLbs;
    rows.push({
      monthKey,
      reportedTotalLbs,
      entryCount,
      weeklyAvgLbs,
      monthlyTotalLbs,
      cumulativeLbs: cumulative,
      avgFullness: b && b.fullnessPerPickup.length > 0 ? mean(b.fullnessPerPickup) : null,
      avgBinCount: b && b.binCounts.length > 0 ? mean(b.binCounts) : null,
    });
  }

  return {
    siteId: site.siteId,
    businessName: site.businessName,
    affiliationId: site.affiliationId,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Assembled monthly report ("Monthly Reports CCH/CoC")
// ---------------------------------------------------------------------------

export interface SiteMonthlyReportLine {
  siteId: string;
  businessName: string;
  active: boolean;
  /** Monthly total (extrapolated) for the report month. */
  weightCollectedLbs: number;
  avgBinsCollected: number | null;
  binsOnSite: number;
  avgFullness: number | null;
}

export interface SiteAllTimeReportLine {
  siteId: string;
  businessName: string;
  active: boolean;
  /** Cumulative weight through the report month. */
  totalCollectedLbs: number;
  totalCollectedTons: number;
  /** Full months from the site's first month to the report month; null if unknown. */
  monthsActive: number | null;
}

export interface ReportKpis {
  weightLbs: number;
  weightTons: number;
  cars: number;
}

export interface CompostMonthlyReport {
  reportMonthKey: string;
  /** Affiliation this report was filtered to, or null for "all sites". */
  affiliationId: string | null;
  monthly: ReportKpis;
  allTime: ReportKpis;
  sites: SiteMonthlyReportLine[];
  allTimeSites: SiteAllTimeReportLine[];
  /** Footnote for the cars-equivalent figure (see compostReporting). */
  carsNote: string;
  /** Footnote explaining the measured-totals methodology vs the legacy workbook. */
  methodologyNote: string;
}

export const METHODOLOGY_NOTE =
  'Totals reflect measured pickups (weekly average × 4.35 for months with collections). ' +
  'Unlike the legacy spreadsheet, the app does not carry estimated weight forward through ' +
  'months with no pickups or apply manual seasonal resets, so historical all-time figures ' +
  'may differ from prior reports. Inactive sites are excluded from the monthly total.';

/**
 * Builds the full monthly report for a target month, optionally filtered to a
 * single affiliation. Sites are returned sorted by business name (active first
 * is left to the UI). KPI totals sum the per-site lines, matching the workbook.
 */
export function buildCompostMonthlyReport(
  sites: readonly ReportSiteInput[],
  pickups: readonly ReportPickupInput[],
  reportMonthKey: string,
  affiliationId: string | null = null,
): CompostMonthlyReport {
  const scoped = affiliationId
    ? sites.filter((s) => s.affiliationId === affiliationId)
    : [...sites];
  scoped.sort((a, b) => a.businessName.localeCompare(b.businessName));

  const monthlyLines: SiteMonthlyReportLine[] = [];
  const allTimeLines: SiteAllTimeReportLine[] = [];

  for (const site of scoped) {
    const series = buildSiteSeries(site, pickups, reportMonthKey);
    const row = series.rows.find((r) => r.monthKey === reportMonthKey) ?? null;
    const last = series.rows[series.rows.length - 1] ?? null;

    monthlyLines.push({
      siteId: site.siteId,
      businessName: site.businessName,
      active: site.active,
      weightCollectedLbs: row?.monthlyTotalLbs ?? 0,
      avgBinsCollected: row?.avgBinCount ?? null,
      binsOnSite: site.binsOnSite,
      avgFullness: row?.avgFullness ?? null,
    });

    const totalLbs = (row ?? last)?.cumulativeLbs ?? 0;
    allTimeLines.push({
      siteId: site.siteId,
      businessName: site.businessName,
      active: site.active,
      totalCollectedLbs: totalLbs,
      totalCollectedTons: totalLbs / LBS_PER_TON,
      monthsActive: site.firstMonthKey
        ? monthsBetween(site.firstMonthKey, reportMonthKey)
        : null,
    });
  }

  // Monthly KPI counts active sites only (matches the shared workbook reports,
  // which blank out discontinued sites). All-time KPI includes every site.
  const monthlyLbs = monthlyLines
    .filter((l) => l.active)
    .reduce((s, l) => s + l.weightCollectedLbs, 0);
  const allTimeLbs = allTimeLines.reduce((s, l) => s + l.totalCollectedLbs, 0);

  return {
    reportMonthKey,
    affiliationId,
    monthly: {
      weightLbs: monthlyLbs,
      weightTons: monthlyLbs / LBS_PER_TON,
      cars: carsEquivalent(monthlyLbs),
    },
    allTime: {
      weightLbs: allTimeLbs,
      weightTons: allTimeLbs / LBS_PER_TON,
      cars: carsEquivalent(allTimeLbs),
    },
    sites: monthlyLines,
    allTimeSites: allTimeLines,
    carsNote: carsEquivalentNote,
    methodologyNote: METHODOLOGY_NOTE,
  };
}

export { co2eqTons };
