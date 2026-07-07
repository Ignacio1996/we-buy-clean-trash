/**
 * Weekly reconciliation logic — compares what the app recorded for compost
 * pickups against the operations Google Sheet (Snapples / Directory), the manual
 * cross-check Tia runs every week. Pure + framework-free per the repo's logic
 * conventions so it stays trivially unit-testable.
 *
 * The two discrepancy types Tia flags by hand:
 *   1. bin-count mismatch  (e.g. Reynoldsburg — app showed 5 bins, sheet showed 4)
 *   2. fullness mismatch   (app fullness vs sheet fullness)
 * plus presence gaps on either side (recorded in app but not sheet, or vice versa).
 *
 * The sheet schema isn't fixed, so the caller maps which pasted columns are the
 * site, date, bin count, and (optional) fullness. Everything here operates on
 * those already-identified columns.
 */

/** One (site, day) cell of what the APP recorded. Built server-side from binPickups. */
export interface AppLedgerRow {
  siteId: string;
  siteName: string;
  /** Columbus-local calendar day, "YYYY-MM-DD". */
  dateKey: string;
  /** True when a pickup or recycling check was recorded that day. */
  recorded: boolean;
  /** True when this (site, day) was scheduled but nothing was recorded. */
  scheduledMissing: boolean;
  /** Number of pickup events recorded that day. */
  pickups: number;
  /** Total bins represented across the day's pickups (Σ bins[].length). */
  binCount: number;
  /** Mean bin fullness 0..1 across the day's bins, or null when no bins. */
  fullnessAvg: number | null;
  weightLbs: number;
  /** True when at least one pickup that day was a skip. */
  skipped: boolean;
}

/** One parsed row of the pasted operations sheet, already column-mapped. */
export interface SheetRow {
  siteRaw: string;
  dateKey: string | null;
  binCount: number | null;
  fullness: number | null;
  /** 1-based line number in the paste (for "row 4 didn't parse" messaging). */
  line: number;
}

export type ReconStatus =
  | 'match'
  | 'bin_mismatch'
  | 'fullness_mismatch'
  | 'missing_in_app'
  | 'missing_in_sheet';

export interface ReconResult {
  key: string;
  siteId: string | null;
  siteName: string;
  dateKey: string | null;
  status: ReconStatus;
  appBins: number | null;
  sheetBins: number | null;
  appFullness: number | null;
  sheetFullness: number | null;
  note: string;
}

/** Split pasted spreadsheet text into a grid. Auto-detects tab (Google Sheets copy) vs comma. */
export function parseDelimited(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  // Trim a single trailing blank line from the paste.
  while (rows.length > 0 && rows[rows.length - 1].trim() === '') rows.pop();
  if (rows.length === 0) return [];
  const delim = rows[0].includes('\t') ? '\t' : ',';
  return rows.map((line) => splitLine(line, delim));
}

/** Split one line respecting simple CSV double-quote quoting. */
function splitLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t').map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Best-guess the index of a column whose header matches any of `candidates` (substring, case-insensitive). Returns -1 if none. */
export function guessColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().trim());
  // Exact match first, then substring.
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  for (let i = 0; i < norm.length; i++) {
    if (candidates.some((c) => norm[i].includes(c))) return i;
  }
  return -1;
}

/** Normalize a site name for fuzzy matching: lowercase, strip punctuation, collapse whitespace. */
export function normalizeSiteName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a spreadsheet date cell into a "YYYY-MM-DD" key. Handles the formats
 * Tia's sheet is likely to use: ISO (2026-07-06), US slash (7/6/2026 or 7/6),
 * and month-name (Jul 6, "Sun, Jul 6", July 6 2026). `defaultYear` fills in a
 * missing year (the report range's year). Returns null when unparseable.
 */
export function parseSheetDate(raw: string, defaultYear: number): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : defaultYear;
    if (year < 100) year += 2000;
    return ymd(year, month, day);
  }

  // Month-name: optional weekday prefix, "Jul 6", "July 6, 2026".
  const name = /([a-z]{3,})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i.exec(s);
  if (name) {
    const month = MONTHS[name[1].slice(0, 3).toLowerCase()];
    if (month) {
      const day = Number(name[2]);
      const year = name[3] ? Number(name[3]) : defaultYear;
      return ymd(year, month, day);
    }
  }
  return null;
}

function ymd(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parse a bin-count cell to an integer, or null. */
export function parseBinCount(raw: string): number | null {
  const m = /-?\d+/.exec(raw ?? '');
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Parse a fullness cell to 0..1. Accepts "75%", "0.75", "3/4", "¾", or words
 * (empty/quarter/half/three-quarter/full). Returns null when blank/unknown.
 */
export function parseFullness(raw: string): number | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;

  if (s.includes('¼')) return 0.25;
  if (s.includes('½')) return 0.5;
  if (s.includes('¾')) return 0.75;

  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (pct) return clamp01(Number(pct[1]) / 100);

  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (frac) {
    const d = Number(frac[2]);
    return d ? clamp01(Number(frac[1]) / d) : null;
  }

  const num = Number(s);
  if (Number.isFinite(num)) return num > 1 ? clamp01(num / 100) : clamp01(num);

  if (s.includes('empty')) return 0;
  if (s.includes('full') && !s.includes('half')) return 1;
  if (s.includes('half')) return 0.5;
  if (s.includes('quarter')) return s.includes('three') ? 0.75 : 0.25;
  return null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Two fullness values are "the same" within a quarter-bucket tolerance. */
function fullnessClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.13; // < half a 0.25 bucket
}

/**
 * Reconcile the app ledger against the pasted sheet rows. Matches on
 * (normalized site name, date). `compareFullness` gates fullness checks — off
 * when the sheet has no fullness column.
 */
export function reconcile(
  appRows: AppLedgerRow[],
  sheetRows: SheetRow[],
  options: { compareFullness: boolean },
): ReconResult[] {
  const results: ReconResult[] = [];
  const matchKey = (name: string, date: string | null) => `${normalizeSiteName(name)}|${date ?? ''}`;

  const sheetByKey = new Map<string, SheetRow>();
  for (const r of sheetRows) {
    if (!r.dateKey || !r.siteRaw.trim()) continue;
    sheetByKey.set(matchKey(r.siteRaw, r.dateKey), r);
  }
  const usedSheet = new Set<string>();

  // Walk the app ledger; find each cell's sheet counterpart.
  for (const app of appRows) {
    if (!app.recorded && !app.scheduledMissing) continue;
    const key = matchKey(app.siteName, app.dateKey);
    const sheet = sheetByKey.get(key);
    if (sheet) usedSheet.add(key);

    if (!sheet) {
      // App recorded something the sheet is missing (only flag actual activity).
      if (app.recorded) {
        results.push(base(app, null, 'missing_in_sheet', 'Recorded in app, not found on sheet'));
      }
      continue;
    }

    const appBins = app.recorded ? app.binCount : null;
    const sheetBins = sheet.binCount;
    if (appBins !== null && sheetBins !== null && appBins !== sheetBins) {
      results.push(
        base(app, sheet, 'bin_mismatch', `App ${appBins} bins vs sheet ${sheetBins} bins`),
      );
      continue;
    }
    if (
      options.compareFullness &&
      app.fullnessAvg !== null &&
      sheet.fullness !== null &&
      !fullnessClose(app.fullnessAvg, sheet.fullness)
    ) {
      results.push(
        base(
          app,
          sheet,
          'fullness_mismatch',
          `App ${pctLabel(app.fullnessAvg)} vs sheet ${pctLabel(sheet.fullness)}`,
        ),
      );
      continue;
    }
    results.push(base(app, sheet, 'match', 'Matches'));
  }

  // Sheet rows with no app counterpart.
  for (const r of sheetRows) {
    if (!r.dateKey || !r.siteRaw.trim()) continue;
    const key = matchKey(r.siteRaw, r.dateKey);
    if (usedSheet.has(key)) continue;
    results.push({
      key: `sheet:${key}:${r.line}`,
      siteId: null,
      siteName: r.siteRaw.trim(),
      dateKey: r.dateKey,
      status: 'missing_in_app',
      appBins: null,
      sheetBins: r.binCount,
      appFullness: null,
      sheetFullness: r.fullness,
      note: 'On sheet, no pickup recorded in app',
    });
  }

  return results.sort((a, b) => rank(a.status) - rank(b.status) || a.siteName.localeCompare(b.siteName));
}

function base(
  app: AppLedgerRow,
  sheet: SheetRow | null,
  status: ReconStatus,
  note: string,
): ReconResult {
  return {
    key: `app:${app.siteId}:${app.dateKey}`,
    siteId: app.siteId,
    siteName: app.siteName,
    dateKey: app.dateKey,
    status,
    appBins: app.recorded ? app.binCount : null,
    sheetBins: sheet?.binCount ?? null,
    appFullness: app.fullnessAvg,
    sheetFullness: sheet?.fullness ?? null,
    note,
  };
}

/** Sort order — problems first, matches last. */
function rank(s: ReconStatus): number {
  switch (s) {
    case 'bin_mismatch':
      return 0;
    case 'missing_in_app':
      return 1;
    case 'missing_in_sheet':
      return 2;
    case 'fullness_mismatch':
      return 3;
    case 'match':
      return 4;
  }
}

export function pctLabel(n: number | null): string {
  if (n === null) return '—';
  return `${Math.round(n * 100)}%`;
}

export const RECON_STATUS_LABELS: Record<ReconStatus, string> = {
  match: 'Match',
  bin_mismatch: 'Bin count differs',
  fullness_mismatch: 'Fullness differs',
  missing_in_app: 'Missing in app',
  missing_in_sheet: 'Missing on sheet',
};
