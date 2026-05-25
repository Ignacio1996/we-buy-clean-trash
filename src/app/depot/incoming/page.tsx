import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import { SS } from '@/components/resident/ss/SS';

export const dynamic = 'force-dynamic';

type RouteStatus = 'new' | 'in_progress' | 'done';

interface RouteRow {
  id: string;
  operatorLabel: string;
  bagsTotal: number;
  bagsProcessed: number;
  arrivedLabel: string;
  status: RouteStatus;
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

    let status: RouteStatus = 'new';
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

const STATUS_THEME: Record<
  RouteStatus,
  { background: string; eyebrowColor: string; eyebrowLabel: string }
> = {
  new: {
    background: SS.yellow,
    eyebrowColor: SS.brand,
    eyebrowLabel: 'Just arrived',
  },
  in_progress: {
    background: SS.sky,
    eyebrowColor: SS.inkSoft,
    eyebrowLabel: 'In progress',
  },
  done: {
    background: SS.mint,
    eyebrowColor: SS.green,
    eyebrowLabel: 'Done today',
  },
};

function StickerRouteCard({ row }: { row: RouteRow }) {
  const theme = STATUS_THEME[row.status];
  return (
    <Link
      href={`/depot/incoming/${row.id}`}
      style={{
        display: 'block',
        background: theme.background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: `0 4px 0 ${SS.ink}`,
        textDecoration: 'none',
        color: SS.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: theme.eyebrowColor,
            }}
          >
            {theme.eyebrowLabel}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: -0.4,
              color: SS.ink,
              marginTop: 4,
              lineHeight: 1.15,
            }}
          >
            Route · {row.operatorLabel}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: SS.ink,
              opacity: 0.75,
              marginTop: 4,
            }}
          >
            {row.status === 'in_progress'
              ? `${row.bagsProcessed} / ${row.bagsTotal} bags processed`
              : `${row.bagsTotal} bags · ${row.arrivedLabel}`}
          </div>
        </div>
        {row.status === 'new' && (
          <div
            style={{
              background: SS.brand,
              color: '#fff',
              border: `2px solid ${SS.ink}`,
              borderRadius: 8,
              padding: '3px 9px',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1,
              flexShrink: 0,
            }}
          >
            NEW
          </div>
        )}
        {row.status === 'in_progress' && (
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: -0.5,
              color: SS.ink,
              flexShrink: 0,
            }}
          >
            {row.progressPct}%
          </div>
        )}
        {row.status === 'done' && (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: SS.green,
              color: '#fff',
              border: `2px solid ${SS.ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
        )}
      </div>
      {row.status === 'in_progress' && (
        <div
          style={{
            marginTop: 10,
            height: 6,
            borderRadius: 999,
            background: '#fff',
            border: `1.5px solid ${SS.ink}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${row.progressPct}%`,
              height: '100%',
              background: SS.brand,
            }}
          />
        </div>
      )}
    </Link>
  );
}

export default async function DepotIncomingPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <section style={{ padding: '20px' }}>
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {depotRes.error === 'depot_not_found'
            ? 'No depot is assigned to your account yet. Ask an admin to assign one.'
            : 'Your user record could not be loaded.'}
        </div>
      </section>
    );
  }

  const { depot } = depotRes.context;
  const rows = await loadIncoming(depot.zoneIds);

  const bagsTotal = rows.reduce((acc, r) => acc + r.bagsTotal, 0);
  const bagsProcessed = rows.reduce((acc, r) => acc + r.bagsProcessed, 0);
  const overallPct =
    bagsTotal > 0 ? Math.round((bagsProcessed / bagsTotal) * 100) : 0;

  const newCount = rows.filter((r) => r.status === 'new').length;
  const inProgressCount = rows.filter((r) => r.status === 'in_progress').length;

  return (
    <section>
      {/* Yellow hero — today's processing stats */}
      <div
        style={{
          background: SS.yellow,
          padding: '24px 20px 22px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
          }}
        >
          {depot.name}
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: -1.6,
            lineHeight: 0.95,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          {bagsProcessed} / {bagsTotal}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.75,
            marginTop: 4,
          }}
        >
          bags processed across incoming routes
        </div>
        <div
          style={{
            marginTop: 14,
            height: 8,
            borderRadius: 999,
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${overallPct}%`,
              height: '100%',
              background: SS.brand,
            }}
          />
        </div>
      </div>

      {/* Quick stats strip */}
      {rows.length > 0 && (
        <div
          style={{
            background: '#fff',
            padding: '14px 20px 8px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div
            style={{
              background: SS.sky,
              border: `2px solid ${SS.ink}`,
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.8,
                color: SS.ink,
                lineHeight: 1,
              }}
            >
              {newCount}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
                marginTop: 4,
              }}
            >
              New routes
            </div>
          </div>
          <div
            style={{
              background: SS.peach,
              border: `2px solid ${SS.ink}`,
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: -0.8,
                color: SS.ink,
                lineHeight: 1,
              }}
            >
              {inProgressCount}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
                marginTop: 4,
              }}
            >
              In progress
            </div>
          </div>
        </div>
      )}

      {/* Incoming routes list */}
      <div style={{ background: '#fff', padding: '14px 20px 28px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 12,
          }}
        >
          Incoming routes
        </div>
        {rows.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: `2px dashed ${SS.ink}`,
              borderRadius: 16,
              padding: '28px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: -0.4,
                color: SS.ink,
              }}
            >
              Nothing waiting.
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: SS.inkSoft,
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              Completed operator routes will land here for processing.
            </div>
          </div>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {rows.map((row) => (
              <li key={row.id}>
                <StickerRouteCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
