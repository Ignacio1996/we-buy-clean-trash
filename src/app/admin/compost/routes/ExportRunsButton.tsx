'use client';

import { Download } from 'lucide-react';

export interface ExportRunRow {
  dateLabel: string;
  operatorName: string;
  startedLabel: string | null;
  endedLabel: string | null;
  status: 'in_progress' | 'completed';
  stops: number;
  totalWeightLbs: number;
  summaryLine: string;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Downloads the currently-shown route runs as a CSV. Client-only — builds the
 * file in the browser from the rows the server already rendered, so it always
 * matches the active filter (This week / Today / All runs).
 */
export function ExportRunsButton({ rows, scope }: { rows: ExportRunRow[]; scope: string }) {
  function download() {
    const lines: string[] = [];
    lines.push(
      ['Date', 'Driver', 'Started', 'Ended', 'Status', 'Stops', 'Weight (lbs)', 'Summary'].join(
        ',',
      ),
    );
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.dateLabel),
          csvCell(r.operatorName),
          csvCell(r.startedLabel ?? ''),
          csvCell(r.endedLabel ?? ''),
          r.status === 'completed' ? 'Completed' : 'In progress',
          r.stops,
          r.totalWeightLbs,
          csvCell(r.summaryLine),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compost-runs-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      Export CSV
    </button>
  );
}
