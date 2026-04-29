import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { optimizeRoute, type LatLng, type RouteWaypoint } from '@/lib/maps/routes';
import { geocodeAddress } from '@/lib/maps/geocode';
import type { RouteDoc, RouteStop } from '@/lib/types/route';
import type { AddressDoc } from '@/lib/types/user';
import type { DepotDoc } from '@/lib/types/depot';
import type { ZoneDoc } from '@/lib/types/zone';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

export const runtime = 'nodejs';

interface AddressStop {
  addressId: string;
  residentId: string;
  location: LatLng;
  pickups: { pickupId: string; residentId: string }[];
  bagOrderResidentId: string | null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const zoneId = typeof raw.zoneId === 'string' ? raw.zoneId.trim() : '';
  const operatorId = typeof raw.operatorId === 'string' ? raw.operatorId.trim() : '';
  const date = parseDate(raw.date);
  if (!zoneId || !operatorId || !date) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const zoneRef = adminDb.collection('zones').doc(zoneId);
  const zoneSnap = await zoneRef.get();
  if (!zoneSnap.exists) return NextResponse.json({ error: 'zone_not_found' }, { status: 404 });
  const zone = zoneSnap.data() as ZoneDoc;

  const depotSnap = await adminDb.collection('depots').doc(zone.depotId).get();
  if (!depotSnap.exists) return NextResponse.json({ error: 'depot_not_found' }, { status: 404 });
  const depot = depotSnap.data() as DepotDoc;

  // Depot coords — geocode on the fly if missing so we always have a valid origin.
  let depotGeo: LatLng | null = depot.geo;
  if (!depotGeo) {
    const result = await geocodeAddress({
      street: depot.street,
      unit: null,
      city: depot.city,
      state: depot.state,
      postalCode: depot.postalCode,
    });
    if (result) depotGeo = { lat: result.lat, lng: result.lng };
  }
  if (!depotGeo) {
    return NextResponse.json({ error: 'depot_geocode_failed' }, { status: 422 });
  }

  // Verify operator role.
  const operatorSnap = await adminDb.collection('users').doc(operatorId).get();
  if (!operatorSnap.exists || operatorSnap.get('role') !== 'operator') {
    return NextResponse.json({ error: 'invalid_operator' }, { status: 400 });
  }

  // One *active* route per operator/zone/day. Completed routes don't conflict —
  // an operator who finishes early can be assigned a fresh route the same day.
  // Catching this here avoids burning a Maps API call and prevents the
  // orphan-bag-order bug where a duplicate route ends up with empty
  // bagOrdersToDeliver because the orders are still pinned to the original.
  const routeDate = Timestamp.fromDate(date);
  const dupeSnap = await adminDb
    .collection('routes')
    .where('zoneId', '==', zoneId)
    .where('operatorId', '==', operatorId)
    .where('date', '==', routeDate)
    .get();
  const activeDupe = dupeSnap.docs.find(
    (d) => (d.data() as RouteDoc).status !== 'completed',
  );
  if (activeDupe) {
    return NextResponse.json(
      {
        error: 'route_already_exists',
        existingRouteId: activeDupe.id,
      },
      { status: 409 },
    );
  }

  // Pending pickups that aren't on a route yet; filter to this zone via address lookup.
  const pickupsSnap = await adminDb
    .collection('pickups')
    .where('status', '==', 'pending')
    .where('routeId', '==', null)
    .get();

  // Pending bag orders for this zone not already on a route.
  const bagOrdersSnap = await adminDb
    .collection('bagOrders')
    .where('zoneId', '==', zoneId)
    .where('deliveryRouteId', '==', null)
    .where('status', '==', 'queued')
    .get();
  const bagOrders = bagOrdersSnap.docs.map((d) => d.data() as BagOrderDoc);
  const bagOrderIds = bagOrders.map((o) => o.id);

  const addressIds = new Set<string>();
  pickupsSnap.docs.forEach((d) => addressIds.add(d.get('addressId') as string));
  bagOrders.forEach((o) => addressIds.add(o.addressId));
  const addressMap = new Map<string, AddressDoc>();
  if (addressIds.size > 0) {
    const refs = [...addressIds].map((id) => adminDb.collection('addresses').doc(id));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) addressMap.set(snap.id, snap.data() as AddressDoc);
    });
  }

  // One AddressStop per physical address — pickups and bag-order deliveries at
  // the same address share a single waypoint so the operator visits it once.
  const stopByAddress = new Map<string, AddressStop>();

  function ensureStop(addressId: string, residentId: string): AddressStop | null {
    const existing = stopByAddress.get(addressId);
    if (existing) return existing;
    const addr = addressMap.get(addressId);
    if (!addr || addr.zoneId !== zoneId) return null;
    if (!addr.geo) return null; // skip un-geocoded; admin can re-save the address to backfill geo
    const stop: AddressStop = {
      addressId,
      residentId,
      location: { lat: addr.geo.lat, lng: addr.geo.lng },
      pickups: [],
      bagOrderResidentId: null,
    };
    stopByAddress.set(addressId, stop);
    return stop;
  }

  for (const doc of pickupsSnap.docs) {
    const pickup = doc.data() as PickupDoc;
    const stop = ensureStop(pickup.addressId, pickup.residentId);
    if (!stop) continue;
    stop.pickups.push({ pickupId: pickup.id, residentId: pickup.residentId });
  }
  for (const order of bagOrders) {
    const stop = ensureStop(order.addressId, order.residentId);
    if (!stop) continue;
    if (stop.pickups.length === 0) stop.bagOrderResidentId = order.residentId;
  }

  const uniqueStops = [...stopByAddress.values()];
  const waypoints: RouteWaypoint[] = uniqueStops.map((s) => ({
    id: s.addressId,
    location: s.location,
  }));
  const optimized = await optimizeRoute({
    origin: depotGeo,
    destination: depotGeo,
    waypoints,
  });

  const orderByAddress = new Map(optimized.orderedWaypointIds.map((id, idx) => [id, idx]));
  const orderedStops: RouteStop[] = [];
  for (const stop of uniqueStops) {
    const order = orderByAddress.get(stop.addressId) ?? orderedStops.length;
    if (stop.pickups.length > 0) {
      // Multiple pickups at the same address each get their own RouteStop entry
      // (so each pickupId stays linkable), sharing the optimized address order.
      for (const p of stop.pickups) {
        orderedStops.push({
          pickupId: p.pickupId,
          addressId: stop.addressId,
          residentId: p.residentId,
          order,
        });
      }
    } else if (stop.bagOrderResidentId) {
      orderedStops.push({
        pickupId: null,
        addressId: stop.addressId,
        residentId: stop.bagOrderResidentId,
        order,
      });
    }
  }
  orderedStops.sort((a, b) => a.order - b.order);

  const routeRef = adminDb.collection('routes').doc();

  await adminDb.runTransaction(async (tx) => {
    const routeDoc: RouteDoc = {
      id: routeRef.id,
      date: routeDate,
      zoneId,
      operatorId,
      orderedStops,
      bagOrdersToDeliver: bagOrderIds,
      status: 'assigned',
      // serverTimestamp below; cast to satisfy RouteDoc
      createdAt: FieldValue.serverTimestamp() as unknown as RouteDoc['createdAt'],
      startedAt: null,
      completedAt: null,
      returnedToDepotAt: null,
    };
    tx.set(routeRef, routeDoc);
    for (const stop of orderedStops) {
      if (!stop.pickupId) continue;
      tx.update(adminDb.collection('pickups').doc(stop.pickupId), {
        routeId: routeRef.id,
        operatorId,
      });
    }
    for (const bagOrderId of bagOrderIds) {
      tx.update(adminDb.collection('bagOrders').doc(bagOrderId), {
        deliveryRouteId: routeRef.id,
      });
    }
  });

  return NextResponse.json({
    ok: true,
    routeId: routeRef.id,
    stops: uniqueStops.length,
    bagOrders: bagOrderIds.length,
    mocked: optimized.mocked,
  });
}
