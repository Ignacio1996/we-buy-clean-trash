import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';

export const dynamic = 'force-dynamic';

type RouteStatusBadge = 'NEW' | 'IN PROGRESS' | 'DONE';

interface RouteRow {
  id: string;
  operatorLabel: string;
  bagsTotal: number;
  bagsProcessed: number;
  arrivedLabel: string;
  badge: RouteStatusBadge;
  progressPct: number;
}

function formatArrived(ts: RouteDoc['returnedToDepotAt']): string {
  if (!ts) return '—';
  try {
    return ts
      .toDate()
      .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

async function loadIncoming(depotZoneIds: string[]): Promise<RouteRow[]> {
  if (depotZoneIds.length === 0) return [];
  // Firestore `in` supports up to 30 values — depot zone count stays small.
  const routeSnap = await adminDb
    .collection('routes')
    .where('status', '==', 'completed')
    .where('zoneId', 'in', depotZoneIds.slice(0, 30))
    .orderBy('returnedToDepotAt', 'desc')
    .limit(50)
    .get();

  const routes = routeSnap.docs.map((d) => d.data() as RouteDoc);
  if (routes.length === 0) return [];

  const operatorIds = Array.from(
    new Set(routes.map((r) => r.operatorId).filter((v): v is string => !!v)),
  );
  const operatorMap = new Map<string, UserDoc>();
  if (operatorIds.length) {
    const snaps = await adminDb.getAll(
      ...operatorIds.map((id) => adminDb.collection('users').doc(id)),
    );
    snaps.forEach((s) => {
      if (s.exists) operatorMap.set(s.id, s.data() as UserDoc);
    });
  }

  const rows: RouteRow[] = [];
  for (const route of routes) {
    const pickupIds = route.orderedStops
      .map((s) => s.pickupId)
      .filter((id): id is string => id !== null);
    const pickupSnaps = pickupIds.length
      ? await adminDb.getAll(...pickupIds.map((id) => adminDb.collection('pickups').doc(id)))
      : [];
    const completedPickups = pickupSnaps
      .filter((s) => s.exists)
      .map((s) => s.data() as PickupDoc)
      .filter((p) => p.status === 'completed');
    const bagIds = completedPickups.map((p) => p.bagId);
    const bagSnaps = bagIds.length
      ? await adminDb.getAll(...bagIds.map((id) => adminDb.collection('bags').doc(id)))
      : [];
    const bags = bagSnaps.filter((s) => s.exists).map((s) => s.data() as BagDoc);
    const bagsTotal = bags.length;
    const bagsProcessed = bags.filter((b) => b.status === 'processed').length;

    let badge: RouteStatusBadge = 'NEW';
    if (bagsTotal > 0 && bagsProcessed === bagsTotal) badge = 'DONE';
    else if (bagsProcessed > 0) badge = 'IN PROGRESS';

    const operator = route.operatorId ? operatorMap.get(route.operatorId) : null;
    rows.push({
      id: route.id,
      operatorLabel: operator?.name ?? 'Operator',
      bagsTotal,
      bagsProcessed,
      arrivedLabel: formatArrived(route.returnedToDepotAt),
      badge,
      progressPct: bagsTotal > 0 ? Math.round((bagsProcessed / bagsTotal) * 100) : 0,
    });
  }
  return rows;
}

function BadgePill({ badge }: { badge: RouteStatusBadge }) {
  const styles: Record<RouteStatusBadge, string> = {
    NEW: 'bg-white text-black',
    'IN PROGRESS': 'bg-white/10 text-gray-300',
    DONE: 'bg-white/5 text-gray-500',
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[badge]}`}
    >
      {badge}
    </span>
  );
}

export default async function DepotIncomingPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <section className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
        {depotRes.error === 'depot_not_found'
          ? 'No depot is assigned to your account yet. Ask an admin to assign one.'
          : 'Your user record could not be loaded.'}
      </section>
    );
  }

  const { depot } = depotRes.context;
  const rows = await loadIncoming(depot.zoneIds);

  return (
    <section className="mt-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
          {depot.name}
        </div>
        <h1 className="mt-0.5 text-lg font-semibold text-white">Incoming deliveries</h1>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
          No routes waiting for processing. Completed operator routes will appear here.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/depot/incoming/${row.id}`}
                className="block rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
                      🚐
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Route — {row.operatorLabel}
                      </div>
                      <div className="text-xs text-gray-400">
                        {row.bagsTotal} bags · Arrived {row.arrivedLabel}
                        {row.badge === 'IN PROGRESS' && (
                          <> · Processing {row.bagsProcessed}/{row.bagsTotal}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <BadgePill badge={row.badge} />
                </div>
                {row.badge === 'IN PROGRESS' && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${row.progressPct}%` }}
                    />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
