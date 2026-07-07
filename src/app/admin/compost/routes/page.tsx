import Link from 'next/link';
import { DeleteRunRowButton } from './DeleteRunRowButton';
import { ExportRunsButton } from './ExportRunsButton';
import { adminDb } from '@/lib/firebase/admin';
import type { CompostRouteSummary } from '@/lib/types/compostRoute';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { SiteCheckDoc } from '@/lib/types/siteCheck';
import type { UserDoc } from '@/lib/types/user';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import { summarizeCompostRoute } from '@/lib/logic/compostRouteSummary';
import { dayRunId } from '@/lib/logic/compostDay';
import {
  columbusDateKey,
  columbusDateLabel,
  columbusDayStart,
  columbusTimeLabel,
  columbusWeekStartKey,
  weekdayFromDateKey,
} from '@/lib/logic/columbusDate';

interface RouteRow {
  id: string;
  operatorName: string;
  dateLabel: string;
  dateKey: string;
  status: 'in_progress' | 'completed';
  startedLabel: string | null;
  endedLabel: string | null;
  summaryLine: string;
  totalWeightLbs: number;
  stops: number;
}

function summaryLine(s: CompostRouteSummary, checks: number, inProgress: boolean): string {
  if (s.stops === 0 && checks === 0) {
    return inProgress ? 'Run in progress…' : 'No pickups recorded';
  }
  const parts: string[] = [];
  if (s.stops > 0) {
    parts.push(
      `${s.stops} stop${s.stops === 1 ? '' : 's'}`,
      ...(s.skipped > 0 ? [`${s.skipped} skipped`] : []),
      `${s.cartsSwapped} cart${s.cartsSwapped === 1 ? '' : 's'} swapped`,
      `${s.totalWeightLbs.toLocaleString()} lbs`,
      ...(s.damaged > 0 ? [`${s.damaged} damaged`] : []),
      ...(s.needsCleaning > 0 ? [`${s.needsCleaning} to clean`] : []),
    );
  }
  if (checks > 0) parts.push(`${checks} recycling check${checks === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

interface DayGroup {
  operatorId: string;
  dayKey: string;
  pickups: BinPickupDoc[];
  checkCount: number;
  firstMs: number;
  lastMs: number;
}

/**
 * Build one "run" per operator per Columbus day from the recorded pickups and
 * recycling checks. There's no Start/End run to read — the day's stops ARE the
 * run, so a pickup shows up here the moment it's recorded.
 */
async function loadRoutes(): Promise<RouteRow[]> {
  const LIMIT = 1000;
  const [pickupsSnap, checksSnap] = await Promise.all([
    adminDb.collection('binPickups').orderBy('createdAt', 'desc').limit(LIMIT).get(),
    adminDb.collection('siteChecks').orderBy('createdAt', 'desc').limit(LIMIT).get(),
  ]);
  const pickups = pickupsSnap.docs.map((d) => d.data() as BinPickupDoc);
  const checks = checksSnap.docs.map((d) => d.data() as SiteCheckDoc);

  const groups = new Map<string, DayGroup>();
  const groupFor = (operatorId: string, date: Date): DayGroup => {
    const dayKey = columbusDateKey(date);
    const key = dayRunId(operatorId, dayKey);
    let g = groups.get(key);
    if (!g) {
      g = {
        operatorId,
        dayKey,
        pickups: [],
        checkCount: 0,
        firstMs: Number.POSITIVE_INFINITY,
        lastMs: Number.NEGATIVE_INFINITY,
      };
      groups.set(key, g);
    }
    const ms = date.getTime();
    g.firstMs = Math.min(g.firstMs, ms);
    g.lastMs = Math.max(g.lastMs, ms);
    return g;
  };

  for (const p of pickups) {
    const date = p.createdAt?.toDate?.();
    if (!date) continue; // server timestamp not yet resolved
    groupFor(p.operatorId, date).pickups.push(p);
  }
  for (const c of checks) {
    const date = c.createdAt?.toDate?.();
    if (!date) continue;
    groupFor(c.operatorId, date).checkCount += 1;
  }

  // Resolve operator names in one batch.
  const operatorIds = [...new Set([...groups.values()].map((g) => g.operatorId))];
  const names = new Map<string, string>();
  if (operatorIds.length > 0) {
    const realIds = operatorIds.filter((id) => id !== 'import');
    if (realIds.length > 0) {
      const userSnaps = await adminDb.getAll(
        ...realIds.map((id) => adminDb.collection('users').doc(id)),
      );
      for (const u of userSnaps) {
        if (u.exists) {
          const data = u.data() as UserDoc;
          names.set(u.id, data.name || data.email || u.id);
        }
      }
    }
    names.set('import', 'Imported');
  }

  const todayKey = columbusDateKey(new Date());
  const ordered = [...groups.values()].sort((a, b) => b.lastMs - a.lastMs);
  return ordered.map((g) => {
    const summary = summarizeCompostRoute(g.pickups);
    const inProgress = g.dayKey === todayKey;
    const firstDate = new Date(g.firstMs);
    const lastDate = new Date(g.lastMs);
    return {
      id: dayRunId(g.operatorId, g.dayKey),
      operatorName: names.get(g.operatorId) ?? g.operatorId,
      dateLabel: columbusDateLabel(firstDate),
      dateKey: g.dayKey,
      status: inProgress ? 'in_progress' : 'completed',
      startedLabel: columbusTimeLabel(firstDate),
      endedLabel: inProgress ? null : columbusTimeLabel(lastDate),
      summaryLine: summaryLine(summary, g.checkCount, inProgress),
      totalWeightLbs: summary.totalWeightLbs,
      stops: summary.stops + g.checkCount,
    };
  });
}

interface MissedSite {
  id: string;
  name: string;
  bins: number;
}

/**
 * Active sites scheduled for today (Columbus weekday) with no bin pickup or
 * recycling check recorded yet — the end-of-day completeness check that would
 * have caught the missing Dodge Park run. Program-wide (any operator).
 */
async function loadTodayMissed(): Promise<MissedSite[]> {
  const todayKey = columbusDateKey(new Date());
  const weekday = weekdayFromDateKey(todayKey);
  const dayStart = columbusDayStart(new Date());
  const [accountsSnap, pickupsSnap, checksSnap] = await Promise.all([
    adminDb.collection('commercialAccounts').where('active', '==', true).get(),
    adminDb.collection('binPickups').where('createdAt', '>=', dayStart).get(),
    adminDb.collection('siteChecks').where('createdAt', '>=', dayStart).get(),
  ]);
  const recorded = new Set<string>();
  for (const d of [...pickupsSnap.docs, ...checksSnap.docs]) {
    const accId = d.get('commercialAccountId');
    if (typeof accId === 'string') recorded.add(accId);
  }
  return accountsSnap.docs
    .map((d) => d.data() as CommercialAccountDoc)
    .filter(
      (a) =>
        a.status !== 'paused' &&
        Array.isArray(a.collectionDays) &&
        a.collectionDays.includes(weekday) &&
        !recorded.has(a.id),
    )
    .map((a) => ({
      id: a.id,
      name: a.businessName,
      bins: typeof a.binsOnSite === 'number' ? a.binsOnSite : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type RunView = 'today' | 'week' | 'all';

const VIEW_LABEL: Record<RunView, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All time',
};

export default async function CompostRoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  // Default to "this week" — Tia reviews the week's runs, not just today's.
  const view: RunView = filter === 'all' ? 'all' : filter === 'today' ? 'today' : 'week';

  const now = new Date();
  const todayKey = columbusDateKey(now);
  const todayWeekday = weekdayFromDateKey(todayKey);
  const weekStartKey = columbusWeekStartKey(now);
  const [allRoutes, missedToday] = await Promise.all([loadRoutes(), loadTodayMissed()]);

  const routes =
    view === 'all'
      ? allRoutes
      : view === 'today'
        ? allRoutes.filter((r) => r.dateKey === todayKey)
        : allRoutes.filter((r) => r.dateKey >= weekStartKey);

  // Headline tally tracks the active view.
  const viewWeight = routes.reduce((sum, r) => sum + r.totalWeightLbs, 0);

  const VIEWS: { key: RunView; href: string; label: string }[] = [
    { key: 'today', href: '/admin/compost/routes?filter=today', label: 'Today' },
    { key: 'week', href: '/admin/compost/routes', label: 'This week' },
    { key: 'all', href: '/admin/compost/routes?filter=all', label: 'All runs' },
  ];

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Compost · Tia
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Route runs</h1>
        <p className="mt-1 text-xs text-gray-500">
          The driver&apos;s day — one run per driver per day, built live from the stops they
          record (bin pickups and recycling checks). Numbers climb as pickups come in; tap a run
          to see every stop.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/70">
              {VIEW_LABEL[view]}
            </div>
            <div className="mt-0.5 text-sm text-white">
              <span className="font-semibold">{routes.length}</span> run
              {routes.length === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold">{viewWeight.toLocaleString()}</span> lbs
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.href}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  view === v.key
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/admin/compost/reconcile"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Reconcile week
            </Link>
            <ExportRunsButton rows={routes} scope={view === 'all' ? 'all' : `${view}-${todayKey}`} />
          </div>
        </div>
      </header>

      {missedToday.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-xs font-semibold text-amber-200">
            ⚠ {missedToday.length} site{missedToday.length === 1 ? '' : 's'} scheduled today (
            {COLLECTION_DAY_LABELS[todayWeekday]}) not yet recorded
          </div>
          <p className="mt-1 text-[11px] text-amber-200/70">
            No bin pickup or recycling check logged for these today. If the run is still going this
            will clear as stops come in.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missedToday.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100"
              >
                {m.name}
                {m.bins > 0 ? ` · ${m.bins} bin${m.bins === 1 ? '' : 's'}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {routes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          {view === 'today' ? (
            <>
              No runs today yet. A run appears here once an operator records a pickup on the
              compost screen.
            </>
          ) : view === 'week' ? (
            <>
              No runs this week yet. A run appears here once an operator records a pickup on the
              compost screen.
            </>
          ) : (
            <>
              No runs recorded yet. A run appears here once an operator records a pickup on the
              compost screen.
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {routes.map((r) => (
                <tr key={r.id} className="align-top transition-colors hover:bg-white/5">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/admin/compost/routes/${r.id}`} className="block">
                      <div className="font-medium text-white">{r.dateLabel}</div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {r.startedLabel ?? '—'}
                        {r.endedLabel ? ` – ${r.endedLabel}` : ''}
                      </div>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-300">{r.operatorName}</td>
                  <td className="px-4 py-3 text-gray-300">{r.summaryLine}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.status === 'completed' ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        Completed
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        In progress
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-3">
                      <Link
                        href={`/admin/compost/routes/${r.id}`}
                        className="text-[11px] font-semibold text-blue-300 underline hover:text-blue-200"
                      >
                        View
                      </Link>
                      <DeleteRunRowButton routeId={r.id} stops={r.stops} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
