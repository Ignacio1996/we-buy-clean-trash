import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc } from '@/lib/types/user';
import { CompleteRouteButton } from './CompleteRouteButton';
import {
  SSOP,
  SSOpBadge,
  SSOpCard,
  SSOpEyebrow,
  SSOpHeader,
  SSOpShell,
  SSOpStat,
} from '@/components/operator/SSOp';

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
      <SSOpShell active="route" nav={false}>
        <SSOpHeader
          kicker="End of route"
          title={
            <>
              Nothing
              <br />
              to close.
            </>
          }
          back="Back to operator"
          backHref="/operator"
          headerBg={SSOP.mint}
        />
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 800,
            color: SSOP.inkSoft,
          }}
        >
          No route to summarize.
        </div>
      </SSOpShell>
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
  const pickups = pickupSnaps.filter((s) => s.exists).map((s) => s.data() as PickupDoc);
  const bagOrders = bagOrderSnaps.filter((s) => s.exists).map((s) => s.data() as BagOrderDoc);

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
    <SSOpShell active="route" nav={false}>
      <SSOpHeader
        kicker={`End of route · ${dateLabel}`}
        title={
          <>
            A clean
            <br />
            day&rsquo;s work.
          </>
        }
        sub={`Route ${routeIdShort} on ${dateLabel}`}
        back="Back to route"
        backHref="/operator"
        headerBg={SSOP.mint}
      />

      {/* Stats — yellow hero */}
      <div style={{ background: SSOP.yellow, padding: '24px 20px 26px' }}>
        <SSOpEyebrow>Today&rsquo;s tally</SSOpEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SSOpStat value={stopsTotal} label="Stops completed" color="#fff" />
          <SSOpStat value={completed} label="Bags collected" color={SSOP.mint} />
          <SSOpStat value={missed} label="Missed" color={SSOP.peach} />
          <SSOpStat value={issues.length} label="Issues" color={SSOP.sky} />
        </div>
      </div>

      {/* Deliveries — sky */}
      {route.bagOrdersToDeliver.length > 0 && (
        <div style={{ background: SSOP.sky, padding: '20px 20px' }}>
          <SSOpEyebrow>Bag deliveries</SSOpEyebrow>
          <SSOpCard pad={'14px 16px'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: SSOP.yellow,
                  border: `2px solid ${SSOP.ink}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                📦
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: SSOP.ink,
                    letterSpacing: -0.3,
                  }}
                >
                  {bagsDelivered} of {route.bagOrdersToDeliver.length} order
                  {route.bagOrdersToDeliver.length === 1 ? '' : 's'} fulfilled
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: SSOP.inkSoft,
                    marginTop: 1,
                  }}
                >
                  Sheets handed to residents at the door
                </div>
              </div>
              {bagsDelivered === route.bagOrdersToDeliver.length ? (
                <SSOpBadge bg={SSOP.mint}>Done</SSOpBadge>
              ) : (
                <SSOpBadge bg={SSOP.peach}>Open</SSOpBadge>
              )}
            </div>
          </SSOpCard>
        </div>
      )}

      {/* Issues — peach */}
      {issues.length > 0 && (
        <div style={{ background: SSOP.peach, padding: '20px 20px' }}>
          <SSOpEyebrow>Issues flagged</SSOpEyebrow>
          <SSOpCard>
            {issues.map((p, i) => {
              const a = addressMap.get(p.addressId);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom:
                      i < issues.length - 1 ? `1px solid ${SSOP.line}` : 'none',
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: SSOP.ink,
                        letterSpacing: -0.3,
                      }}
                    >
                      {a ? `${a.street}${a.unit ? ` · Unit ${a.unit}` : ''}` : p.addressId}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: SSOP.brand,
                        marginTop: 1,
                      }}
                    >
                      {p.issue ?? 'other'}
                      {p.issueNote ? ` — ${p.issueNote}` : ''}
                    </div>
                  </div>
                  <SSOpBadge bg={SSOP.brand} fg="#fff">
                    Issue
                  </SSOpBadge>
                </div>
              );
            })}
          </SSOpCard>
        </div>
      )}

      {missed > 0 && (
        <div style={{ background: SSOP.peach, padding: '0 20px 20px' }}>
          <SSOpEyebrow>Missed</SSOpEyebrow>
          <SSOpCard>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: SSOP.ink,
                    letterSpacing: -0.3,
                  }}
                >
                  {missed} bag{missed === 1 ? '' : 's'} not out
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 1 }}>
                  Marked as skipped during the route
                </div>
              </div>
              <SSOpBadge bg={SSOP.peach}>Skipped</SSOpBadge>
            </div>
          </SSOpCard>
        </div>
      )}

      {/* Dispatcher quote — mint */}
      <div style={{ background: SSOP.mint, padding: '22px 20px 24px' }}>
        <SSOpCard>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1,
              color: SSOP.brand,
              fontFamily: SSOP.sans,
              fontWeight: 900,
              marginBottom: 6,
            }}
          >
            &ldquo;
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: SSOP.ink,
              lineHeight: 1.4,
              letterSpacing: -0.2,
            }}
          >
            Drive back to the depot. The closing crew will weigh and sort what you brought in.
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: SSOP.inkSoft,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginTop: 10,
            }}
          >
            — Dispatcher
          </div>
        </SSOpCard>
      </div>

      {/* Close — white footer */}
      <div style={{ background: '#fff', padding: '20px 20px 28px' }}>
        {!alreadyDone ? (
          <CompleteRouteButton routeId={route.id} hasPickups={pickups.length > 0} />
        ) : (
          <div
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: SSOP.inkSoft,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Route closed on{' '}
            {route.completedAt
              ? route.completedAt.toDate().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'}
          </div>
        )}
      </div>
    </SSOpShell>
  );
}
