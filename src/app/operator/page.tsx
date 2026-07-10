import { Timestamp } from 'firebase-admin/firestore';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc, PickupStatus } from '@/lib/types/pickup';
import type { BagDoc, DeclaredBagType } from '@/lib/types/bag';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import { TodaysRouteClient } from './TodaysRouteClient';
import {
  SSOP,
  SSOpEyebrow,
  SSOpHeader,
  SSOpPillLink,
  SSOpShell,
} from '@/components/operator/SSOp';
import { LogoutLink } from './LogoutLink';

export interface StopPickup {
  id: string;
  bagId: string;
  bagCode: string;
  declaredType: DeclaredBagType | null;
  status: PickupStatus;
  order: number;
}

export interface StopBagOrder {
  id: string;
  quantity: number;
  status: BagOrderDoc['status'];
}

export interface StopView {
  addressId: string;
  residentId: string;
  residentName: string;
  street: string;
  unitLine: string;
  cityLine: string;
  pickups: StopPickup[];
  bagOrdersToDeliver: StopBagOrder[];
  order: number;
  allDone: boolean;
}

export interface RouteView {
  id: string;
  status: RouteDoc['status'];
  dateLabel: string;
  stops: StopView[];
  stats: {
    stopsTotal: number;
    stopsDone: number;
    bagsTotal: number;
    bagsDone: number;
    deliveriesTotal: number;
    deliveriesDone: number;
    deliveriesPending: number;
  };
}

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function formatDate(ts: RouteDoc['date']): string {
  try {
    const d = ts.toDate();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return `${weekday} · ${month} ${d.getDate()}`;
  } catch {
    return '—';
  }
}

function formatTodayLabel(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday} · ${month} ${d.getDate()}`;
}

async function loadTodaysRoute(operatorUid: string): Promise<RouteView | null> {
  const snap = await adminDb
    .collection('routes')
    .where('operatorId', '==', operatorUid)
    .where('status', 'in', ['assigned', 'in_progress'])
    .where('date', '>=', startOfToday())
    .orderBy('date', 'asc')
    .limit(1)
    .get();
  if (snap.empty) return null;

  const route = snap.docs[0].data() as RouteDoc;
  const pickupIds = route.orderedStops
    .map((s) => s.pickupId)
    .filter((id): id is string => id !== null);
  const bagOrderIds = route.bagOrdersToDeliver;

  const [pickupSnaps, bagOrderSnaps] = await Promise.all([
    pickupIds.length
      ? adminDb.getAll(...pickupIds.map((id) => adminDb.collection('pickups').doc(id)))
      : Promise.resolve([]),
    bagOrderIds.length
      ? adminDb.getAll(...bagOrderIds.map((id) => adminDb.collection('bagOrders').doc(id)))
      : Promise.resolve([]),
  ]);

  const pickups = pickupSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as PickupDoc);
  const bagOrders = bagOrderSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as BagOrderDoc);

  const orderByPickupId = new Map(
    route.orderedStops
      .filter((s): s is typeof s & { pickupId: string } => s.pickupId !== null)
      .map((s) => [s.pickupId, s.order]),
  );
  const orderByAddressId = new Map(route.orderedStops.map((s) => [s.addressId, s.order]));
  const addressIds = new Set<string>();
  const residentIds = new Set<string>();
  const bagIds = new Set<string>();
  pickups.forEach((p) => {
    addressIds.add(p.addressId);
    residentIds.add(p.residentId);
    bagIds.add(p.bagId);
  });
  bagOrders.forEach((o) => {
    addressIds.add(o.addressId);
    residentIds.add(o.residentId);
  });

  const [addressSnaps, residentSnaps, bagSnaps] = await Promise.all([
    addressIds.size
      ? adminDb.getAll(...[...addressIds].map((id) => adminDb.collection('addresses').doc(id)))
      : Promise.resolve([]),
    residentIds.size
      ? adminDb.getAll(...[...residentIds].map((id) => adminDb.collection('users').doc(id)))
      : Promise.resolve([]),
    bagIds.size
      ? adminDb.getAll(...[...bagIds].map((id) => adminDb.collection('bags').doc(id)))
      : Promise.resolve([]),
  ]);

  const addressMap = new Map<string, AddressDoc>();
  addressSnaps.forEach((s) => {
    if (s.exists) addressMap.set(s.id, s.data() as AddressDoc);
  });
  const userMap = new Map<string, UserDoc>();
  residentSnaps.forEach((s) => {
    if (s.exists) userMap.set(s.id, s.data() as UserDoc);
  });
  const bagMap = new Map<string, BagDoc>();
  bagSnaps.forEach((s) => {
    if (s.exists) bagMap.set(s.id, s.data() as BagDoc);
  });

  const stopMap = new Map<string, StopView>();
  for (const pickup of pickups) {
    const stop = ensureStop(stopMap, pickup.addressId, pickup.residentId, addressMap, userMap);
    const bag = bagMap.get(pickup.bagId);
    stop.pickups.push({
      id: pickup.id,
      bagId: pickup.bagId,
      bagCode: bag?.qrCode ?? bag?.printedNumber ?? pickup.bagId,
      declaredType: (bag?.declaredType as DeclaredBagType | null) ?? null,
      status: pickup.status,
      order: orderByPickupId.get(pickup.id) ?? 0,
    });
  }
  for (const order of bagOrders) {
    if (order.status === 'delivered') continue;
    const stop = ensureStop(stopMap, order.addressId, order.residentId, addressMap, userMap);
    stop.bagOrdersToDeliver.push({ id: order.id, quantity: order.quantity, status: order.status });
  }

  const stops = [...stopMap.values()].map((stop): StopView => {
    stop.pickups.sort((a, b) => a.order - b.order);
    const pickupsDone = stop.pickups.every((p) => p.status !== 'pending');
    const deliveriesDone = stop.bagOrdersToDeliver.length === 0;
    return {
      ...stop,
      order: stop.pickups.length
        ? stop.pickups[0].order
        : (orderByAddressId.get(stop.addressId) ?? 9999),
      allDone: pickupsDone && deliveriesDone,
    };
  });
  stops.sort((a, b) => a.order - b.order);

  const stopsTotal = stops.length;
  const stopsDone = stops.filter((s) => s.allDone).length;
  const bagsTotal = pickups.length;
  const bagsDone = pickups.filter((p) => p.status !== 'pending').length;
  const deliveriesTotal = bagOrders.length;
  const deliveriesDone = bagOrders.filter((o) => o.status === 'delivered').length;
  const deliveriesPending = deliveriesTotal - deliveriesDone;

  return {
    id: route.id,
    status: route.status,
    dateLabel: formatDate(route.date),
    stops,
    stats: {
      stopsTotal,
      stopsDone,
      bagsTotal,
      bagsDone,
      deliveriesTotal,
      deliveriesDone,
      deliveriesPending,
    },
  };
}

function ensureStop(
  map: Map<string, StopView>,
  addressId: string,
  residentId: string,
  addressMap: Map<string, AddressDoc>,
  userMap: Map<string, UserDoc>,
): StopView {
  const existing = map.get(addressId);
  if (existing) return existing;
  const addr = addressMap.get(addressId);
  const user = userMap.get(residentId);
  const stop: StopView = {
    addressId,
    residentId,
    residentName: user?.name ?? 'Resident',
    street: addr?.street ?? '—',
    unitLine: addr?.unit ? `Unit ${addr.unit}` : '',
    cityLine: addr ? `${addr.city}, ${addr.state} ${addr.postalCode}` : '',
    pickups: [],
    bagOrdersToDeliver: [],
    order: 0,
    allDone: false,
  };
  map.set(addressId, stop);
  return stop;
}

async function loadCompostSiteCount(operatorUid: string): Promise<number> {
  const operatorSnap = await adminDb.collection('users').doc(operatorUid).get();
  const zoneId = operatorSnap.exists ? (operatorSnap.get('zoneId') as string | undefined) : undefined;
  let q = adminDb.collection('commercialAccounts').where('active', '==', true);
  if (zoneId) q = q.where('zoneId', '==', zoneId);
  const snap = await q.count().get();
  return snap.data().count;
}

function deriveOperator(uid: string, name: string | undefined, email: string | null) {
  const fullName = name?.trim() || email?.split('@')[0] || 'Operator';
  const initial = fullName.charAt(0).toUpperCase() || '·';
  return { name: fullName, initial, displayLabel: email ?? uid };
}

export default async function OperatorHome() {
  const session = await requireRole('operator');
  const [route, compostSiteCount, userSnap] = await Promise.all([
    loadTodaysRoute(session.uid),
    loadCompostSiteCount(session.uid),
    adminDb.collection('users').doc(session.uid).get(),
  ]);
  const userData = userSnap.exists ? (userSnap.data() as UserDoc) : null;
  const operator = deriveOperator(session.uid, userData?.name, session.email ?? null);

  const allHandled =
    route &&
    route.stats.stopsDone === route.stats.stopsTotal &&
    route.stats.deliveriesPending === 0;
  const currentStop = route?.stops.find((s) => !s.allDone) ?? null;
  const idx = (route?.stats.stopsDone ?? 0) + 1;

  // Header content varies by state
  const headerKicker = `${route?.dateLabel ?? formatTodayLabel()} · Operator`;
  const headerTitle = route ? (
    route.status === 'assigned' ? (
      <>
        Ready when
        <br />
        you are.
      </>
    ) : allHandled ? (
      <>
        Route
        <br />
        handled.
      </>
    ) : currentStop ? (
      <>
        Stop {String(idx).padStart(2, '0')}
        <br />
        <span style={{ color: SSOP.brand }}>{currentStop.street}.</span>
      </>
    ) : (
      <>
        Today&rsquo;s
        <br />
        route.
      </>
    )
  ) : (
    <>
      No route
      <br />
      today.
    </>
  );

  const headerSub = route
    ? `${route.stats.stopsTotal} stops · ${route.stats.bagsTotal} bags${
        route.stats.deliveriesTotal > 0
          ? ` · ${route.stats.deliveriesTotal} delivery${route.stats.deliveriesTotal === 1 ? '' : 's'}`
          : ''
      }`
    : undefined;

  return (
    <SSOpShell
      active="route"
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: SSOP.ink,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {operator.initial}
          </div>
          <LogoutLink />
        </div>
      }
    >
      <SSOpHeader kicker={headerKicker} title={headerTitle} sub={headerSub} />

      {/* Always-available fallback: scan any bag even if routing failed. */}
      <div style={{ background: '#fff', padding: '14px 20px 4px' }}>
        <SSOpPillLink
          href="/operator/scan"
          variant="ink"
          size="md"
          leftIcon={<span>📷</span>}
        >
          Scan a bag manually
        </SSOpPillLink>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: SSOP.inkSoft,
            textAlign: 'center',
            marginTop: 8,
            letterSpacing: 0.2,
          }}
        >
          Works even if no route is assigned.
        </div>
      </div>

      {!route ? (
        <>
          {compostSiteCount > 0 && <CompostBanner count={compostSiteCount} />}
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: SSOP.ink,
                letterSpacing: -0.6,
              }}
            >
              No route assigned.
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SSOP.inkSoft,
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              Check back once an admin builds one,
              <br />
              or sign out if you&rsquo;re done for the day.
            </div>
          </div>
        </>
      ) : (
        <>
          {compostSiteCount > 0 && <CompostBanner count={compostSiteCount} />}
          <TodaysRouteClient route={route} operatorLabel={operator.displayLabel} />
        </>
      )}

      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: SSOP.inkSoft,
          padding: '20px 20px 8px',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        Signed in as {operator.displayLabel}
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: SSOP.inkSoft,
          padding: '0 20px 16px',
          fontStyle: 'italic',
        }}
      >
        Questions during a shift? Slack the dispatcher.
      </div>
    </SSOpShell>
  );
}

function CompostBanner({ count }: { count: number }) {
  return (
    <div style={{ background: SSOP.peach, padding: '14px 20px', borderBottom: `2px solid ${SSOP.ink}` }}>
      <Link
        href="/operator/compost"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#fff',
          border: `2px solid ${SSOP.ink}`,
          borderRadius: 14,
          padding: '12px 14px',
          textDecoration: 'none',
          boxShadow: `0 3px 0 ${SSOP.ink}`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: SSOP.mint,
            border: `2px solid ${SSOP.ink}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          C
        </div>
        <div style={{ flex: 1 }}>
          <SSOpEyebrow mb={2} color={SSOP.ink}>
            Compost route
          </SSOpEyebrow>
          <div style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink, letterSpacing: -0.2 }}>
            {count} site{count === 1 ? '' : 's'} in your zone
          </div>
        </div>
        <span style={{ fontSize: 22, fontWeight: 900, color: SSOP.ink }}>›</span>
      </Link>
    </div>
  );
}
