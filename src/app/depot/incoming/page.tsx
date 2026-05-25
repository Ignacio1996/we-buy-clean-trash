import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import {
  DP_TOK,
  DpAlert,
  DpEmpty,
  DpListLink,
  DpMasthead,
  DpProgressBar,
  DpStatusPill,
  type DpStatusKey,
} from '@/components/depot/Dp';
import { IconTruck } from '@/components/icons/EcoIcons';

export const dynamic = 'force-dynamic';

interface RouteRow {
  id: string;
  operatorLabel: string;
  bagsTotal: number;
  bagsProcessed: number;
  arrivedLabel: string;
  status: DpStatusKey;
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
  const routeSnap = await adminDb
    .collection('routes')
    .where('status', '==', 'completed')
    .where('zoneId', 'in', depotZoneIds.slice(0, 30))
    .orderBy('returnedToDepotAt', 'desc')
    .limit(50)
    .get();

  // Skip delivery-only routes — if no stop has a pickupId, the operator only
  // dropped off empty bags and there's nothing for the depot to process.
  const routes = routeSnap.docs
    .map((d) => d.data() as RouteDoc)
    .filter((r) => r.orderedStops.some((s) => s.pickupId !== null));
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

    let status: DpStatusKey = 'new';
    if (bagsTotal > 0 && bagsProcessed === bagsTotal) status = 'done';
    else if (bagsProcessed > 0) status = 'in_progress';

    const operator = route.operatorId ? operatorMap.get(route.operatorId) : null;
    rows.push({
      id: route.id,
      operatorLabel: operator?.name ?? 'Operator',
      bagsTotal,
      bagsProcessed,
      arrivedLabel: formatArrived(route.returnedToDepotAt),
      status,
      progressPct: bagsTotal > 0 ? Math.round((bagsProcessed / bagsTotal) * 100) : 0,
    });
  }
  return rows;
}

export default async function DepotIncomingPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <DpAlert tone="rust">
        {depotRes.error === 'depot_not_found'
          ? 'No depot is assigned to your account yet. Ask an admin to assign one.'
          : 'Your user record could not be loaded.'}
      </DpAlert>
    );
  }

  const { depot } = depotRes.context;
  const rows = await loadIncoming(depot.zoneIds);

  return (
    <section>
      <DpMasthead
        eyebrow={depot.name}
        title={
          <>
            Incoming{' '}
            <em style={{ color: DP_TOK.green, fontStyle: 'italic' }}>deliveries</em>.
          </>
        }
      />

      {rows.length === 0 ? (
        <DpEmpty
          title="Nothing waiting."
          body="Completed operator routes will land here for processing."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <DpListLink
                href={`/depot/incoming/${row.id}`}
                icon={<IconTruck size={18} color={DP_TOK.green} stroke={1.5} />}
                title={`Route — ${row.operatorLabel}`}
                subtitle={
                  <>
                    {row.bagsTotal} bags · Arrived {row.arrivedLabel}
                    {row.status === 'in_progress' && (
                      <>
                        {' · '}Processing {row.bagsProcessed}/{row.bagsTotal}
                      </>
                    )}
                  </>
                }
                rightSlot={<DpStatusPill status={row.status} />}
                footer={
                  row.status === 'in_progress' ? (
                    <DpProgressBar pct={row.progressPct} tone="green" />
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
