import { Timestamp } from 'firebase-admin/firestore';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { LogoutButton } from '@/components/LogoutButton';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc, PickupStatus } from '@/lib/types/pickup';
import type { BagDoc, DeclaredBagType } from '@/lib/types/bag';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import { TodaysRouteClient } from './TodaysRouteClient';

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
    return ts
      .toDate()
      .toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
  } catch {
    return '—';
  }
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
  const pickupIds = route.orderedStops.map((s) => s.pickupId);
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

  const orderByPickupId = new Map(route.orderedStops.map((s) => [s.pickupId, s.order]));
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

  // Group by addressId.
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

  // Finalize: sort pickups within stop, compute min order + done flag, sort stops.
  const stops = [...stopMap.values()].map((stop): StopView => {
    stop.pickups.sort((a, b) => a.order - b.order);
    const pickupsDone = stop.pickups.every((p) => p.status !== 'pending');
    const deliveriesDone = stop.bagOrdersToDeliver.length === 0;
    return {
      ...stop,
      order: stop.pickups.length ? stop.pickups[0].order : 9999,
      allDone: pickupsDone && deliveriesDone,
    };
  });
  stops.sort((a, b) => a.order - b.order);

  const stopsTotal = stops.length;
  const stopsDone = stops.filter((s) => s.allDone).length;
  const bagsTotal = pickups.length;
  const bagsDone = pickups.filter((p) => p.status !== 'pending').length;
  const deliveriesPending = bagOrders.filter((o) => o.status !== 'delivered').length;

  return {
    id: route.id,
    status: route.status,
    dateLabel: formatDate(route.date),
    stops,
    stats: { stopsTotal, stopsDone, bagsTotal, bagsDone, deliveriesPending },
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

export default async function OperatorHome() {
  const session = await requireRole('operator');
  const [route, compostSiteCount] = await Promise.all([
    loadTodaysRoute(session.uid),
    loadCompostSiteCount(session.uid),
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Operator</div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">
            {route ? 'Today’s Route' : 'No active route'}
          </h1>
          {route && <div className="mt-0.5 text-xs text-gray-400">{route.dateLabel}</div>}
        </div>
        <LogoutButton />
      </header>

      {compostSiteCount > 0 && (
        <Link
          href="/operator/compost"
          className="mt-3 flex items-center justify-between rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/15"
        >
          <span>
            🥬 Compost route — {compostSiteCount} site{compostSiteCount === 1 ? '' : 's'} in zone
          </span>
          <span className="text-blue-300">→</span>
        </Link>
      )}

      {!route ? (
        <section className="mt-10 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
          You don’t have a route assigned for today or later. Check back once an admin builds one,
          or sign out if you’re done for the day.
        </section>
      ) : (
        <TodaysRouteClient route={route} operatorLabel={session.email ?? session.uid} />
      )}

      <p className="mt-10 text-[11px] text-gray-600">
        Questions during a shift? Ask the admin via Slack.
      </p>
    </main>
  );
}
