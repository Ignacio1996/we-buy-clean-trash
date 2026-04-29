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
  OP_TOK,
  OpAvatar,
  OpDisplay,
  OpEyebrow,
  OpMasthead,
  OpPage,
} from '@/components/operator/Op';
import { LogoutLink } from './LogoutLink';
import { IconChevR, IconLeaf } from '@/components/icons/EcoIcons';

export const dynamic = 'force-dynamic';

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

  return (
    <OpPage>
      <OpMasthead
        date={route?.dateLabel ?? formatTodayLabel()}
        rightSlot={
          <OpAvatar
            name={operator.name}
            initial={operator.initial}
            signOutSlot={<LogoutLink />}
          />
        }
      />

      {!route ? (
        <>
          {compostSiteCount > 0 && (
            <CompostBanner count={compostSiteCount} />
          )}
          <div className="mt-20 text-center">
            <div
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 24,
                color: OP_TOK.ink,
                letterSpacing: -0.3,
              }}
            >
              No route assigned.
            </div>
            <div
              className="mt-2 italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 13,
                color: OP_TOK.inkSoft,
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
        <RouteHeader route={route} compostSiteCount={compostSiteCount}>
          <TodaysRouteClient route={route} operatorLabel={operator.displayLabel} />
        </RouteHeader>
      )}

      <p
        className="mt-10 text-center italic"
        style={{
          fontFamily: OP_TOK.serif,
          fontSize: 11,
          color: OP_TOK.inkFaint,
        }}
      >
        Questions during a shift? Slack the dispatcher.
      </p>
    </OpPage>
  );
}

function RouteHeader({
  route,
  compostSiteCount,
  children,
}: {
  route: RouteView;
  compostSiteCount: number;
  children: React.ReactNode;
}) {
  const allHandled =
    route.stats.stopsDone === route.stats.stopsTotal &&
    route.stats.deliveriesPending === 0;
  const idx = route.stats.stopsDone + 1;
  const currentStop = route.stops.find((s) => !s.allDone);

  return (
    <>
      <div className="mb-5">
        <OpEyebrow>Today&rsquo;s route</OpEyebrow>
        <OpDisplay className="mt-1.5">
          {route.status === 'assigned' ? (
            <>
              Ready when{' '}
              <em style={{ color: OP_TOK.green, fontStyle: 'italic' }}>you are</em>.
            </>
          ) : allHandled ? (
            <>
              All stops{' '}
              <em style={{ color: OP_TOK.green, fontStyle: 'italic' }}>handled</em>.
            </>
          ) : (
            <>
              Stop{' '}
              <em style={{ color: OP_TOK.green, fontStyle: 'italic' }}>
                {String(idx).padStart(2, '0')}
              </em>{' '}
              &mdash;
            </>
          )}
        </OpDisplay>
        {route.status === 'in_progress' && currentStop && !allHandled && (
          <div
            className="mt-1.5 italic"
            style={{
              fontFamily: OP_TOK.serif,
              fontSize: 13,
              color: OP_TOK.inkSoft,
            }}
          >
            {currentStop.street}
            {currentStop.unitLine ? ` · ${currentStop.unitLine}` : ''}
          </div>
        )}
      </div>

      {compostSiteCount > 0 && <CompostBanner count={compostSiteCount} className="mb-5" />}

      {children}
    </>
  );
}

function CompostBanner({ count, className = '' }: { count: number; className?: string }) {
  return (
    <Link
      href="/operator/compost"
      className={`flex items-center justify-between gap-3 ${className}`}
      style={{
        background: OP_TOK.amberSoft,
        border: `1px solid rgba(160,104,42,0.3)`,
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: '#fff' }}
        >
          <IconLeaf size={16} color={OP_TOK.amber} stroke={1.5} />
        </div>
        <div>
          <div style={{ fontFamily: OP_TOK.serif, fontSize: 14, color: OP_TOK.ink }}>
            Compost route &mdash; {count} site{count === 1 ? '' : 's'}
          </div>
          <div
            className="mt-0.5 italic"
            style={{ fontFamily: OP_TOK.serif, fontSize: 11, color: OP_TOK.amber }}
          >
            Tap to view today&rsquo;s commercial pickups.
          </div>
        </div>
      </div>
      <IconChevR size={16} color={OP_TOK.amber} />
    </Link>
  );
}
