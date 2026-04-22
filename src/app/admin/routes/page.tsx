import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { ZoneDoc } from '@/lib/types/zone';
import type { UserDoc } from '@/lib/types/user';
import { RouteBuilderClient } from './RouteBuilderClient';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

interface RouteRow {
  id: string;
  date: string;
  zoneName: string;
  operatorName: string;
  status: RouteDoc['status'];
  stopCount: number;
  bagOrderCount: number;
}

function formatDate(ts: RouteDoc['date']): string {
  try {
    const d = ts.toDate();
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

async function loadData() {
  const [zonesSnap, operatorsSnap, routesSnap] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('users').where('role', '==', 'operator').get(),
    adminDb.collection('routes').orderBy('date', 'desc').limit(50).get(),
  ]);

  const zones = zonesSnap.docs.map((d) => d.data() as ZoneDoc);
  const operators = operatorsSnap.docs.map((d) => {
    const u = d.data() as UserDoc;
    return { id: u.uid, name: u.name || u.email || u.uid };
  });
  const zoneNameById = new Map(zones.map((z) => [z.id, z.name]));
  const opNameById = new Map(operators.map((o) => [o.id, o.name]));

  const routes: RouteRow[] = routesSnap.docs.map((d) => {
    const r = d.data() as RouteDoc;
    return {
      id: r.id,
      date: formatDate(r.date),
      zoneName: zoneNameById.get(r.zoneId) ?? r.zoneId,
      operatorName: r.operatorId ? (opNameById.get(r.operatorId) ?? r.operatorId) : '—',
      status: r.status,
      stopCount: r.orderedStops.length,
      bagOrderCount: r.bagOrdersToDeliver.length,
    };
  });

  return {
    zones: zones.map((z) => ({ id: z.id, name: z.name })),
    operators,
    routes,
  };
}

const STATUS_COLORS: Record<RouteDoc['status'], string> = {
  draft: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
  assigned: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  in_progress: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  completed: 'border-green-500/30 bg-green-500/10 text-green-300',
};

export default async function AdminRoutesPage() {
  const { zones, operators, routes } = await loadData();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Routes</h1>
          <p className="mt-1 text-xs text-gray-500">
            Build a pickup route for a zone on a given day. Pending pickups and queued bag orders in
            that zone are pulled in automatically and the stop order is optimized.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-5-routes.html" />
      </header>

      <RouteBuilderClient zones={zones} operators={operators} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-white">Recent routes</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          {routes.length === 0 ? (
            <div className="bg-white/5 px-4 py-6 text-center text-xs text-gray-500">
              No routes yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Zone</th>
                  <th className="px-4 py-2 font-medium">Operator</th>
                  <th className="px-4 py-2 font-medium">Stops</th>
                  <th className="px-4 py-2 font-medium">Bag orders</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {routes.map((r) => (
                  <tr key={r.id} className="text-gray-200">
                    <td className="px-4 py-2">{r.date}</td>
                    <td className="px-4 py-2">{r.zoneName}</td>
                    <td className="px-4 py-2">{r.operatorName}</td>
                    <td className="px-4 py-2">{r.stopCount}</td>
                    <td className="px-4 py-2">{r.bagOrderCount}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_COLORS[r.status]}`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
