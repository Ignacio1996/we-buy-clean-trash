import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc } from '@/lib/types/user';
import { CompleteRouteButton } from './CompleteRouteButton';
import {
  OP_TOK,
  OpBackRow,
  OpEyebrow,
  OpDisplay,
  OpPage,
  OpPaper,
  SummaryStat,
} from '@/components/operator/Op';
import { IconBag } from '@/components/icons/EcoIcons';

export const dynamic = 'force-dynamic';

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

async function loadRouteForSummary(operatorUid: string) {
  const snap = await adminDb
    .collection('routes')
    .where('operatorId', '==', operatorUid)
    .where('date', '>=', startOfToday())
    .get();
  if (snap.empty) return null;
  const priority: Record<RouteDoc['status'], number> = {
    in_progress: 0,
    assigned: 1,
    completed: 2,
    draft: 3,
  };
  const routes = snap.docs.map((d) => d.data() as RouteDoc);
  routes.sort((a, b) => {
    const p = priority[a.status] - priority[b.status];
    if (p !== 0) return p;
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
  return routes[0];
}

function formatDateLabel(ts: RouteDoc['date']): string {
  try {
    const d = ts.toDate();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return `${weekday} · ${month} ${d.getDate()}`;
  } catch {
    return '—';
  }
}

export default async function OperatorSummaryPage() {
  const session = await requireRole('operator');
  const route = await loadRouteForSummary(session.uid);

  if (!route) {
    return (
      <OpPage>
        <OpBackRow label="Back" href="/operator" />
        <p
          className="mt-6 italic"
          style={{ fontFamily: OP_TOK.serif, fontSize: 14, color: OP_TOK.inkSoft }}
        >
          No route to summarize.
        </p>
      </OpPage>
    );
  }

  const pickupIds = route.orderedStops
    .map((s) => s.pickupId)
    .filter((id): id is string => id !== null);
  const [pickupSnaps, bagOrderSnaps] = await Promise.all([
    pickupIds.length
      ? adminDb.getAll(...pickupIds.map((id) => adminDb.collection('pickups').doc(id)))
      : Promise.resolve([]),
    route.bagOrdersToDeliver.length
      ? adminDb.getAll(
          ...route.bagOrdersToDeliver.map((id) => adminDb.collection('bagOrders').doc(id)),
        )
      : Promise.resolve([]),
  ]);
  const pickups = pickupSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as PickupDoc);
  const bagOrders = bagOrderSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as BagOrderDoc);

  const completed = pickups.filter((p) => p.status === 'completed').length;
  const missed = pickups.filter((p) => p.status === 'missed').length;
  const issues = pickups.filter((p) => p.status === 'issue');
  const bagsDelivered = bagOrders.filter((o) => o.status === 'delivered').length;
  const stopsTotal = new Set(pickups.map((p) => p.addressId)).size;

  const addressIds = [...new Set(issues.map((i) => i.addressId))];
  const addressSnaps = addressIds.length
    ? await adminDb.getAll(...addressIds.map((id) => adminDb.collection('addresses').doc(id)))
    : [];
  const addressMap = new Map<string, AddressDoc>();
  addressSnaps.forEach((s) => {
    if (s.exists) addressMap.set(s.id, s.data() as AddressDoc);
  });

  const alreadyDone = route.status === 'completed';
  const dateLabel = formatDateLabel(route.date);
  const routeIdShort = route.id.slice(-6);

  return (
    <OpPage>
      <OpBackRow label="Back to route" href="/operator" />

      <header className="mb-5">
        <OpEyebrow>End of route</OpEyebrow>
        <OpDisplay className="mt-1.5">
          A clean <em style={{ color: OP_TOK.green, fontStyle: 'italic' }}>day&rsquo;s work</em>.
        </OpDisplay>
        <div
          className="mt-1.5 italic"
          style={{ fontFamily: OP_TOK.serif, fontSize: 13, color: OP_TOK.inkSoft }}
        >
          {dateLabel} · route {routeIdShort}
        </div>
      </header>

      {pickups.length > 0 && (
        <section
          className="grid grid-cols-2 gap-x-6 gap-y-5"
          style={{
            padding: '22px 0',
            borderTop: `2px solid ${OP_TOK.ink}`,
            borderBottom: `1px solid ${OP_TOK.line}`,
          }}
        >
          <SummaryStat label="Stops completed" value={stopsTotal} tone="ink" />
          <SummaryStat label="Bags collected" value={completed} tone="green" />
          <SummaryStat label="Missed" value={missed} tone={missed > 0 ? 'amber' : 'ink'} />
          <SummaryStat
            label="Issues flagged"
            value={issues.length}
            tone={issues.length > 0 ? 'rust' : 'ink'}
          />
        </section>
      )}

      {route.bagOrdersToDeliver.length > 0 && (
        <section className="mt-5">
          <OpPaper>
            <div className="flex items-center gap-2.5">
              <IconBag size={16} color={OP_TOK.green} stroke={1.5} />
              <OpEyebrow color={OP_TOK.green}>Deliveries</OpEyebrow>
            </div>
            <div
              className="mt-2"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 18,
                color: OP_TOK.ink,
                letterSpacing: -0.2,
              }}
            >
              <span style={{ fontFeatureSettings: '"lnum","tnum"' }}>{bagsDelivered}</span> of{' '}
              {route.bagOrdersToDeliver.length} bag order
              {route.bagOrdersToDeliver.length === 1 ? '' : 's'} fulfilled
            </div>
          </OpPaper>
        </section>
      )}

      {issues.length > 0 && (
        <section className="mt-4">
          <OpPaper
            style={{
              background: OP_TOK.rustSoft,
              border: `1px solid ${OP_TOK.rust}`,
            }}
          >
            <OpEyebrow color={OP_TOK.rust}>Issues flagged</OpEyebrow>
            <ul className="mt-2.5">
              {issues.map((p, i) => {
                const a = addressMap.get(p.addressId);
                return (
                  <li
                    key={p.id}
                    style={{
                      padding: '10px 0',
                      borderBottom:
                        i < issues.length - 1 ? `1px solid rgba(154,75,38,0.25)` : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: OP_TOK.serif,
                        fontSize: 14,
                        color: OP_TOK.ink,
                      }}
                    >
                      {a ? `${a.street}${a.unit ? ` · Unit ${a.unit}` : ''}` : p.addressId}
                    </div>
                    <div
                      className="mt-0.5 italic"
                      style={{
                        fontFamily: OP_TOK.serif,
                        fontSize: 12,
                        color: OP_TOK.rust,
                      }}
                    >
                      {p.issue ?? 'other'}
                      {p.issueNote ? ` — ${p.issueNote}` : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          </OpPaper>
        </section>
      )}

      <blockquote
        className="mt-6"
        style={{
          padding: '20px 24px',
          borderLeft: `2px solid ${OP_TOK.green}`,
          margin: 0,
        }}
      >
        <p
          className="italic"
          style={{
            fontFamily: OP_TOK.serif,
            fontSize: 16,
            color: OP_TOK.ink,
            lineHeight: 1.4,
            letterSpacing: -0.2,
          }}
        >
          “Drive back to the depot. The closing crew will weigh and sort what you brought in.”
        </p>
        <div
          className="mt-2.5 uppercase"
          style={{
            fontFamily: OP_TOK.sans,
            fontSize: 11,
            color: OP_TOK.inkSoft,
            letterSpacing: 1.4,
          }}
        >
          — Dispatcher
        </div>
      </blockquote>

      {!alreadyDone ? (
        <CompleteRouteButton routeId={route.id} hasPickups={pickups.length > 0} />
      ) : (
        <p
          className="mt-7 text-center italic"
          style={{
            fontFamily: OP_TOK.serif,
            fontSize: 11,
            color: OP_TOK.inkFaint,
          }}
        >
          Route was closed on{' '}
          {route.completedAt
            ? route.completedAt.toDate().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '—'}
          .
        </p>
      )}
    </OpPage>
  );
}
