import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import type { CompostRouteDoc } from '@/lib/types/compostRoute';
import type { UserDoc } from '@/lib/types/user';
import {
  columbusDateKey,
  columbusDateLabel,
  columbusTimeLabel,
} from '@/lib/logic/columbusDate';

interface RouteRow {
  id: string;
  operatorName: string;
  dateLabel: string;
  dateKey: string;
  status: CompostRouteDoc['status'];
  startedLabel: string | null;
  endedLabel: string | null;
  summaryLine: string;
  totalWeightLbs: number;
}

function summaryLine(route: CompostRouteDoc): string {
  const s = route.summary;
  if (!s) return route.status === 'in_progress' ? 'Run in progress…' : 'No pickups recorded';
  const parts = [
    `${s.stops} stop${s.stops === 1 ? '' : 's'}`,
    ...(s.skipped > 0 ? [`${s.skipped} skipped`] : []),
    `${s.cartsSwapped} cart${s.cartsSwapped === 1 ? '' : 's'} swapped`,
    `${s.totalWeightLbs.toLocaleString()} lbs`,
    ...(s.damaged > 0 ? [`${s.damaged} damaged`] : []),
    ...(s.needsCleaning > 0 ? [`${s.needsCleaning} to clean`] : []),
  ];
  return parts.join(' · ');
}

async function loadRoutes(): Promise<RouteRow[]> {
  const snap = await adminDb
    .collection('compostRoutes')
    .orderBy('startedAt', 'desc')
    .limit(100)
    .get();
  const routes = snap.docs.map((d) => d.data() as CompostRouteDoc);

  // Resolve operator names in one batch.
  const operatorIds = [...new Set(routes.map((r) => r.operatorId))];
  const names = new Map<string, string>();
  if (operatorIds.length > 0) {
    const userSnaps = await adminDb.getAll(
      ...operatorIds.map((id) => adminDb.collection('users').doc(id)),
    );
    for (const u of userSnaps) {
      if (u.exists) {
        const data = u.data() as UserDoc;
        names.set(u.id, data.name || data.email || u.id);
      }
    }
  }

  return routes.map((r) => {
    const startedAt = r.startedAt?.toDate?.() ?? null;
    const endedAt = r.endedAt?.toDate?.() ?? null;
    return {
      id: r.id,
      operatorName: names.get(r.operatorId) ?? r.operatorId,
      dateLabel: startedAt ? columbusDateLabel(startedAt) : r.date,
      dateKey: startedAt ? columbusDateKey(startedAt) : r.date,
      status: r.status,
      startedLabel: startedAt ? columbusTimeLabel(startedAt) : null,
      endedLabel: endedAt ? columbusTimeLabel(endedAt) : null,
      summaryLine: summaryLine(r),
      totalWeightLbs: r.summary?.totalWeightLbs ?? 0,
    };
  });
}

export default async function CompostRoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const todayOnly = filter === 'today';
  const todayKey = columbusDateKey(new Date());
  const allRoutes = await loadRoutes();
  const routes = todayOnly ? allRoutes.filter((r) => r.dateKey === todayKey) : allRoutes;

  // "Today" tallies — what Tia checks to confirm the run is done.
  const today = allRoutes.filter((r) => r.dateKey === todayKey);
  const todayWeight = today.reduce((sum, r) => sum + r.totalWeightLbs, 0);

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
          The driver&apos;s day — each run is a Start Route → End Route session with a frozen
          summary of stops, carts swapped, weight, skips and bin issues. Tap a run to see every
          stop.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/70">Today</div>
            <div className="mt-0.5 text-sm text-white">
              <span className="font-semibold">{today.length}</span> run
              {today.length === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold">{todayWeight.toLocaleString()}</span> lbs
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/admin/compost/routes"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                todayOnly
                  ? 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              }`}
            >
              All runs
            </Link>
            <Link
              href="/admin/compost/routes?filter=today"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                todayOnly
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
              }`}
            >
              Today
            </Link>
          </div>
        </div>
      </header>

      {routes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          {todayOnly ? (
            <>
              No runs today yet. A run appears here once an operator taps{' '}
              <span className="font-semibold text-gray-200">Start run</span> on the compost
              screen.
            </>
          ) : (
            <>
              No runs recorded yet. A run appears here once an operator taps{' '}
              <span className="font-semibold text-gray-200">Start run</span> on the compost
              screen.
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
                    <Link
                      href={`/admin/compost/routes/${r.id}`}
                      className="text-[11px] font-semibold text-blue-300 underline hover:text-blue-200"
                    >
                      View
                    </Link>
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
