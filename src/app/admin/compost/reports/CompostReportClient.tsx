'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { CompostMonthlyReport } from '@/lib/logic/compostReport';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-04" → "Apr 2026". */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const name = MONTH_NAMES[m - 1] ?? key;
  return `${name} ${y}`;
}

const AFFILIATION_LABELS: Record<string, string> = {
  compost_clubhouse: 'Compost Clubhouse',
  city_of_columbus: 'City of Columbus',
};

function affiliationLabel(id: string): string {
  return AFFILIATION_LABELS[id] ?? id;
}

function lbs(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function tons(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

function bins(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CompostReportClient({
  report,
  affiliations,
  months,
  selectedMonth,
  selectedAffiliation,
}: {
  report: CompostMonthlyReport;
  affiliations: string[];
  months: string[];
  selectedMonth: string;
  selectedAffiliation: string | null;
}) {
  const router = useRouter();

  // Make sure the selected month is offered even if it has no pickups.
  const monthOptions = useMemo(() => {
    const set = new Set(months);
    set.add(selectedMonth);
    return [...set].sort().reverse();
  }, [months, selectedMonth]);

  function navigate(next: { month?: string; affiliation?: string | null }) {
    const params = new URLSearchParams();
    const month = next.month ?? selectedMonth;
    const affiliation =
      next.affiliation === undefined ? selectedAffiliation : next.affiliation;
    params.set('month', month);
    if (affiliation) params.set('affiliation', affiliation);
    router.push(`/admin/compost/reports?${params.toString()}`);
  }

  // Active sites first, then archived (greyed), each already name-sorted upstream.
  const monthlyRows = useMemo(
    () => [...report.sites].sort((a, b) => Number(b.active) - Number(a.active)),
    [report.sites],
  );
  const allTimeRows = useMemo(
    () => [...report.allTimeSites].sort((a, b) => Number(b.active) - Number(a.active)),
    [report.allTimeSites],
  );

  function downloadCsv() {
    const scope = report.affiliationId
      ? affiliationLabel(report.affiliationId)
      : 'All sites';
    const lines: string[] = [];
    lines.push(['Compost diversion report', scope, monthLabel(report.reportMonthKey)].map(csvCell).join(','));
    lines.push('');
    lines.push('Monthly KPIs,Weight (lbs),Weight (tons),Cars off the road');
    lines.push(
      [
        '',
        report.monthly.weightLbs.toFixed(2),
        report.monthly.weightTons.toFixed(4),
        report.monthly.cars.toFixed(2),
      ].join(','),
    );
    lines.push('All-time KPIs,Weight (lbs),Weight (tons),Cars off the road');
    lines.push(
      [
        '',
        report.allTime.weightLbs.toFixed(2),
        report.allTime.weightTons.toFixed(4),
        report.allTime.cars.toFixed(2),
      ].join(','),
    );
    lines.push('');
    lines.push('Monthly Summary');
    lines.push('Location,Weight Collected (lbs),Avg Bins Collected,Bins on Site,Avg Fullness,Status');
    for (const r of monthlyRows) {
      lines.push(
        [
          csvCell(r.businessName),
          r.active ? r.weightCollectedLbs.toFixed(2) : '',
          !r.active || r.avgBinsCollected === null ? '' : r.avgBinsCollected.toFixed(2),
          r.binsOnSite,
          !r.active || r.avgFullness === null ? '' : (r.avgFullness * 100).toFixed(0) + '%',
          r.active ? 'Active' : 'Inactive',
        ].join(','),
      );
    }
    lines.push('');
    lines.push('All Time Summary');
    lines.push('Location,Total Collected (lbs),Total Collected (tons),Months Active,Status');
    for (const r of allTimeRows) {
      lines.push(
        [
          csvCell(r.businessName),
          r.totalCollectedLbs.toFixed(2),
          r.totalCollectedTons.toFixed(4),
          r.monthsActive === null ? '' : r.monthsActive,
          r.active ? 'Active' : 'Inactive',
        ].join(','),
      );
    }
    lines.push('');
    lines.push(csvCell('* ' + report.carsNote));
    lines.push(csvCell(report.methodologyNote));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const scopeSlug = (report.affiliationId ?? 'all').replace(/[^a-z0-9]+/gi, '-');
    a.href = url;
    a.download = `compost-report-${scopeSlug}-${report.reportMonthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Controls — hidden when printing */}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wide text-gray-500">Month</span>
          <select
            value={selectedMonth}
            onChange={(e) => navigate({ month: e.target.value })}
            className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wide text-gray-500">
            Affiliation
          </span>
          <select
            value={selectedAffiliation ?? ''}
            onChange={(e) => navigate({ affiliation: e.target.value || null })}
            className="mt-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="">All sites</option>
            {affiliations.map((a) => (
              <option key={a} value={a}>
                {affiliationLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-end gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-gray-200"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Report header (shown in print) */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">
          {report.affiliationId ? affiliationLabel(report.affiliationId) : 'All sites'} — Monthly
          Report
        </h2>
        <p className="text-sm">{monthLabel(report.reportMonthKey)}</p>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Monthly lbs" value={lbs(report.monthly.weightLbs)} accent />
        <Kpi label="Monthly tons" value={tons(report.monthly.weightTons)} accent />
        <Kpi label="Monthly cars" value={lbs(report.monthly.cars)} accent footnote />
        <Kpi label="All-time lbs" value={lbs(report.allTime.weightLbs)} />
        <Kpi label="All-time tons" value={tons(report.allTime.weightTons)} />
        <Kpi label="All-time cars" value={lbs(report.allTime.cars)} footnote />
      </div>

      {/* Monthly Summary */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">Monthly Summary</h3>
        <Table
          head={['Location', 'Weight (lbs)', 'Avg Bins', 'Bins on Site', 'Avg Fullness']}
          rightAlign={[1, 2, 3, 4]}
        >
          {monthlyRows.map((r) => (
            <tr key={r.siteId} className={r.active ? '' : 'text-gray-600'}>
              <td className="py-1.5 pr-3">
                {r.businessName}
                {!r.active && <span className="ml-1 text-[10px] uppercase">(inactive)</span>}
              </td>
              <td className="py-1.5 pl-3 text-right tabular-nums">
                {r.active ? lbs(r.weightCollectedLbs) : '—'}
              </td>
              <td className="py-1.5 pl-3 text-right tabular-nums">
                {r.active ? bins(r.avgBinsCollected) : '—'}
              </td>
              <td className="py-1.5 pl-3 text-right tabular-nums">{r.binsOnSite}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums">
                {r.active ? pct(r.avgFullness) : '—'}
              </td>
            </tr>
          ))}
          {monthlyRows.length === 0 && <EmptyRow span={5} />}
        </Table>
      </section>

      {/* All Time Summary */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">All Time Summary</h3>
        <Table
          head={['Location', 'Total (lbs)', 'Total (tons)', 'Months Active']}
          rightAlign={[1, 2, 3]}
        >
          {allTimeRows.map((r) => (
            <tr key={r.siteId} className={r.active ? '' : 'text-gray-600'}>
              <td className="py-1.5 pr-3">{r.businessName}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums">{lbs(r.totalCollectedLbs)}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums">{tons(r.totalCollectedTons)}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums">
                {r.monthsActive === null ? '—' : r.monthsActive}
              </td>
            </tr>
          ))}
          {allTimeRows.length === 0 && <EmptyRow span={4} />}
        </Table>
      </section>

      <div className="space-y-1 text-[11px] text-gray-500">
        <p>* {report.carsNote}</p>
        <p>{report.methodologyNote}</p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  footnote,
}: {
  label: string;
  value: string;
  accent?: boolean;
  footnote?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
        {footnote && <span className="text-gray-600">&nbsp;*</span>}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function Table({
  head,
  rightAlign,
  children,
}: {
  head: string[];
  rightAlign: number[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
      <table className="w-full text-xs text-gray-200">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-gray-500">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2 font-medium ${
                  rightAlign.includes(i) ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-white/5 [&>tr:last-child]:border-0 [&>tr>td:first-child]:pl-3">
          {children}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-3 py-4 text-center text-gray-500">
        No sites for this selection.
      </td>
    </tr>
  );
}
