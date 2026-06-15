import { loadCompostReportData } from '@/lib/admin/loadCompostReportData';
import { buildCompostMonthlyReport, isMonthKey } from '@/lib/logic/compostReport';
import { CompostReportClient } from './CompostReportClient';

interface PageProps {
  searchParams: Promise<{ month?: string; affiliation?: string }>;
}

/** "YYYY-MM" for the current month in UTC. */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function CompostReportsPage({ searchParams }: PageProps) {
  const { month: monthRaw, affiliation: affRaw } = await searchParams;
  const { sites, pickups, affiliations, months } = await loadCompostReportData();

  // Default to the most recent month with data, else the current month.
  const fallbackMonth = months[months.length - 1] ?? currentMonthKey();
  const reportMonth = monthRaw && isMonthKey(monthRaw) ? monthRaw : fallbackMonth;

  const affiliation = affRaw && affiliations.includes(affRaw) ? affRaw : null;

  const report = buildCompostMonthlyReport(sites, pickups, reportMonth, affiliation);

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Compost · Tia
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Diversion reports</h1>
        <p className="mt-1 text-xs text-gray-500">
          Food-scrap collection reporting for Compost Clubhouse and City of Columbus drop-off
          sites. Figures reproduce Tia&apos;s master workbook (weekly average × 4.35, with gaps
          filled forward). Separate from the recycling program&apos;s points and inventory.
        </p>
      </header>

      <CompostReportClient
        report={report}
        affiliations={affiliations}
        months={months}
        selectedMonth={reportMonth}
        selectedAffiliation={affiliation}
      />
    </div>
  );
}
