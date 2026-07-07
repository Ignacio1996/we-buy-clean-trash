'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, ClipboardPaste, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  parseDelimited,
  guessColumn,
  parseSheetDate,
  parseBinCount,
  parseFullness,
  reconcile,
  pctLabel,
  RECON_STATUS_LABELS,
  type AppLedgerRow,
  type SheetRow,
  type ReconStatus,
} from '@/lib/logic/reconcileCompost';

const STATUS_TONE: Record<ReconStatus, string> = {
  match: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  bin_mismatch: 'border-red-500/40 bg-red-500/15 text-red-300',
  fullness_mismatch: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  missing_in_app: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  missing_in_sheet: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
};

function dayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReconcileClient({
  ledger,
  from,
  to,
  defaultYear,
  todayKey,
}: {
  ledger: AppLedgerRow[];
  from: string;
  to: string;
  defaultYear: number;
  todayKey: string;
}) {
  const router = useRouter();
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const [paste, setPaste] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [siteCol, setSiteCol] = useState(-1);
  const [dateCol, setDateCol] = useState(-1);
  const [binsCol, setBinsCol] = useState(-1);
  const [fullnessCol, setFullnessCol] = useState(-1);
  const [mapped, setMapped] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const grid = useMemo(() => parseDelimited(paste), [paste]);
  const headers = useMemo<string[]>(() => {
    if (grid.length === 0) return [];
    if (hasHeader) return grid[0];
    // Synthesize column labels when there's no header row.
    return grid[0].map((_, i) => `Column ${i + 1}`);
  }, [grid, hasHeader]);

  // Auto-map columns when the admin loads the paste.
  function autoMap() {
    if (grid.length === 0) return;
    const h = grid[0].map((c) => c);
    setSiteCol(guessColumn(h, ['site', 'location', 'business', 'name', 'customer', 'stop']));
    setDateCol(guessColumn(h, ['date', 'day', 'pickup']));
    setBinsCol(guessColumn(h, ['bins', 'bin count', '# of bins', 'containers', 'carts', 'qty']));
    setFullnessCol(guessColumn(h, ['fullness', 'full', 'level']));
    setMapped(true);
  }

  const sheetRows = useMemo<SheetRow[]>(() => {
    if (!mapped || siteCol < 0 || dateCol < 0 || binsCol < 0) return [];
    const dataRows = hasHeader ? grid.slice(1) : grid;
    return dataRows.map((row, i) => ({
      siteRaw: row[siteCol] ?? '',
      dateKey: parseSheetDate(row[dateCol] ?? '', defaultYear),
      binCount: parseBinCount(row[binsCol] ?? ''),
      fullness: fullnessCol >= 0 ? parseFullness(row[fullnessCol] ?? '') : null,
      line: i + (hasHeader ? 2 : 1),
    }));
  }, [mapped, grid, hasHeader, siteCol, dateCol, binsCol, fullnessCol, defaultYear]);

  const results = useMemo(() => {
    if (sheetRows.length === 0) return [];
    return reconcile(ledger, sheetRows, { compareFullness: fullnessCol >= 0 });
  }, [ledger, sheetRows, fullnessCol]);

  const counts = useMemo(() => {
    const c: Record<ReconStatus, number> = {
      match: 0,
      bin_mismatch: 0,
      fullness_mismatch: 0,
      missing_in_app: 0,
      missing_in_sheet: 0,
    };
    for (const r of results) c[r.status] += 1;
    return c;
  }, [results]);

  const unparsedDates = sheetRows.filter((r) => r.siteRaw.trim() && !r.dateKey).length;
  const problemCount =
    counts.bin_mismatch + counts.fullness_mismatch + counts.missing_in_app + counts.missing_in_sheet;

  const shownResults = problemsOnly ? results.filter((r) => r.status !== 'match') : results;

  // Ledger grouped by day for a scannable read.
  const ledgerByDay = useMemo(() => {
    const map = new Map<string, AppLedgerRow[]>();
    for (const r of ledger) {
      if (!map.has(r.dateKey)) map.set(r.dateKey, []);
      map.get(r.dateKey)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, rows]) => [k, rows.sort((x, y) => x.siteName.localeCompare(y.siteName))] as const);
  }, [ledger]);

  function applyRange() {
    if (!fromInput || !toInput || toInput < fromInput) return;
    router.push(`/admin/compost/reconcile?from=${fromInput}&to=${toInput}`);
  }

  function exportResults() {
    const lines = [
      ['Site', 'Date', 'Status', 'App bins', 'Sheet bins', 'App fullness', 'Sheet fullness', 'Note']
        .join(','),
    ];
    for (const r of results) {
      lines.push(
        [
          csvCell(r.siteName),
          csvCell(r.dateKey ?? ''),
          csvCell(RECON_STATUS_LABELS[r.status]),
          r.appBins ?? '',
          r.sheetBins ?? '',
          csvCell(pctLabel(r.appFullness)),
          csvCell(pctLabel(r.sheetFullness)),
          csvCell(r.note),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const recordedCells = ledger.filter((r) => r.recorded).length;
  const missingCells = ledger.filter((r) => r.scheduledMissing).length;

  return (
    <div className="space-y-6">
      {/* Date range */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <CalendarRange className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
            Week to reconcile
          </div>
          <label className="block">
            <span className="block text-[9px] uppercase tracking-wide text-gray-500">From</span>
            <input
              type="date"
              value={fromInput}
              max={toInput || todayKey}
              onChange={(e) => setFromInput(e.target.value)}
              className="mt-0.5 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white [color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="block text-[9px] uppercase tracking-wide text-gray-500">To</span>
            <input
              type="date"
              value={toInput}
              min={fromInput}
              max={todayKey}
              onChange={(e) => setToInput(e.target.value)}
              className="mt-0.5 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={applyRange}
            className="rounded bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            Load week
          </button>
          <div className="ml-auto text-[11px] text-gray-400">
            <span className="font-semibold text-white">{recordedCells}</span> recorded ·{' '}
            <span className="font-semibold text-amber-300">{missingCells}</span> scheduled-missing
          </div>
        </div>
      </section>

      {/* App ledger */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">
          What the app recorded
          <span className="ml-1.5 text-gray-500">{from} → {to}</span>
        </h2>
        {ledgerByDay.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-gray-500">
            No pickups or scheduled sites in this range.
          </div>
        ) : (
          <div className="space-y-4">
            {ledgerByDay.map(([dateKey, rows]) => (
              <div key={dateKey} className="overflow-hidden rounded-xl border border-white/10">
                <div className="flex items-center justify-between bg-white/5 px-4 py-2">
                  <span className="text-xs font-semibold text-white">{dayLabel(dateKey)}</span>
                  <span className="text-[10px] text-gray-500">
                    {rows.filter((r) => r.recorded).length}/{rows.length} recorded
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-1.5 font-semibold">Site</th>
                      <th className="px-4 py-1.5 font-semibold">Bins</th>
                      <th className="px-4 py-1.5 font-semibold">Fullness</th>
                      <th className="px-4 py-1.5 font-semibold">Weight</th>
                      <th className="px-4 py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((r) => (
                      <tr key={`${r.siteId}-${r.dateKey}`}>
                        <td className="px-4 py-1.5 text-gray-200">{r.siteName}</td>
                        <td className="px-4 py-1.5 tabular-nums text-gray-300">
                          {r.recorded ? r.binCount : '—'}
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-gray-300">
                          {pctLabel(r.fullnessAvg)}
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-gray-300">
                          {r.recorded ? `${r.weightLbs} lbs` : '—'}
                        </td>
                        <td className="px-4 py-1.5">
                          {r.scheduledMissing ? (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                              Scheduled · not recorded
                            </span>
                          ) : r.skipped ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                              Skipped
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                              Recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Paste the sheet */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <ClipboardPaste className="h-4 w-4 text-blue-300" aria-hidden />
          Paste the operations sheet
        </h2>
        <p className="mb-3 text-[11px] text-gray-500">
          Select the week&apos;s rows in Google Sheets (including the header row) and paste here.
          Tabs or commas both work.
        </p>
        <textarea
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value);
            setMapped(false);
          }}
          rows={6}
          placeholder={'Site\tDate\tBins\tFullness\nDodge Park\t7/6/2026\t2\tFull\n…'}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder-gray-600"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                setMapped(false);
              }}
            />
            First row is a header
          </label>
          <button
            type="button"
            onClick={autoMap}
            disabled={grid.length === 0}
            className="rounded bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Match columns
          </button>
        </div>

        {mapped && grid.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ColumnSelect label="Site column" headers={headers} value={siteCol} onChange={setSiteCol} />
            <ColumnSelect label="Date column" headers={headers} value={dateCol} onChange={setDateCol} />
            <ColumnSelect label="Bins column" headers={headers} value={binsCol} onChange={setBinsCol} />
            <ColumnSelect
              label="Fullness (optional)"
              headers={headers}
              value={fullnessCol}
              onChange={setFullnessCol}
              allowNone
            />
          </div>
        )}
        {mapped && (siteCol < 0 || dateCol < 0 || binsCol < 0) && (
          <p className="mt-2 text-[11px] text-amber-300">
            Pick the site, date, and bins columns to run the comparison.
          </p>
        )}
        {mapped && unparsedDates > 0 && (
          <p className="mt-2 text-[11px] text-amber-300">
            {unparsedDates} row{unparsedDates === 1 ? '' : 's'} had a date we couldn&apos;t read —
            check the date column mapping and format.
          </p>
        )}
      </section>

      {/* Results */}
      {results.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Comparison</h2>
            {problemCount === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Everything matches
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {problemCount} to review
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300">
                <input
                  type="checkbox"
                  checked={problemsOnly}
                  onChange={(e) => setProblemsOnly(e.target.checked)}
                />
                Problems only
              </label>
              <button
                type="button"
                onClick={exportResults}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {(Object.keys(RECON_STATUS_LABELS) as ReconStatus[]).map((s) => (
              <span
                key={s}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[s]} ${
                  counts[s] === 0 ? 'opacity-40' : ''
                }`}
              >
                {counts[s]} {RECON_STATUS_LABELS[s]}
              </span>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Site</th>
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">App</th>
                  <th className="px-4 py-2 font-semibold">Sheet</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shownResults.map((r) => (
                  <tr key={r.key} className="align-top">
                    <td className="px-4 py-2 text-gray-200">{r.siteName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-400">
                      {r.dateKey ? dayLabel(r.dateKey) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-300">
                      {r.appBins ?? '—'} bins{r.appFullness !== null ? ` · ${pctLabel(r.appFullness)}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-300">
                      {r.sheetBins ?? '—'} bins
                      {r.sheetFullness !== null ? ` · ${pctLabel(r.sheetFullness)}` : ''}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status]}`}
                      >
                        {RECON_STATUS_LABELS[r.status]}
                      </span>
                      <div className="mt-0.5 text-[10px] text-gray-500">{r.note}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
  allowNone,
}: {
  label: string;
  headers: string[];
  value: number;
  onChange: (v: number) => void;
  allowNone?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
      >
        <option value={-1}>{allowNone ? 'None' : 'Select…'}</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
