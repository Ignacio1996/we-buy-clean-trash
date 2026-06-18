import { adminDb } from '@/lib/firebase/admin';
import type { CompostRouteDoc } from '@/lib/types/compostRoute';
import type { UserDoc } from '@/lib/types/user';
import { columbusDateLabel, columbusTimeLabel } from '@/lib/logic/columbusDate';

interface RouteRow {
  id: string;
  operatorName: string;
  dateLabel: string;
  status: CompostRouteDoc['status'];
  startedLabel: string | null;
  endedLabel: string | null;
  summaryLine: string;
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
      status: r.status,
      startedLabel: startedAt ? columbusTimeLabel(startedAt) : null,
      endedLabel: endedAt ? columbusTimeLabel(endedAt) : null,
      summaryLine: summaryLine(r),
    };
  });
}

export default async function CompostRoutesPage() {
  const routes = await loadRoutes();

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
          summary of stops, carts swapped, weight, skips and bin issues. Most recent 100 runs.
        </p>
      </header>

      {routes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          No runs recorded yet. A run appears here once an operator taps{' '}
          <span className="font-semibold text-gray-200">Start run</span> on the compost screen.
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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {routes.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-medium text-white">{r.dateLabel}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {r.startedLabel ?? '—'}
                      {r.endedLabel ? ` – ${r.endedLabel}` : ''}
                    </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
