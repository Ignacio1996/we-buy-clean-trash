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

export const runtime = 'nodejs';

interface StopPlan {
  pickupId: string;
  residentId: string;
  addressId: string;
  location: LatLng;
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

  // One route per operator/zone/day. Catching this here avoids burning a Maps
  // API call and prevents the orphan-bag-order bug where a duplicate route
  // ends up with empty bagOrdersToDeliver because the orders are still pinned
  // to the original route.
  const routeDate = Timestamp.fromDate(date);
  const dupeSnap = await adminDb
    .collection('routes')
    .where('zoneId', '==', zoneId)
    .where('operatorId', '==', operatorId)
    .where('date', '==', routeDate)
    .limit(1)
    .get();
  if (!dupeSnap.empty) {
    return NextResponse.json(
      {
        error: 'route_already_exists',
        existingRouteId: dupeSnap.docs[0].id,
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

  const addressIds = [...new Set(pickupsSnap.docs.map((d) => d.get('addressId') as string))];
  const addressMap = new Map<string, AddressDoc>();
  if (addressIds.length > 0) {
    const refs = addressIds.map((id) => adminDb.collection('addresses').doc(id));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) addressMap.set(snap.id, snap.data() as AddressDoc);
    });
  }

  const stops: StopPlan[] = [];
  for (const doc of pickupsSnap.docs) {
    const pickup = doc.data() as PickupDoc;
    const addr = addressMap.get(pickup.addressId);
    if (!addr || addr.zoneId !== zoneId) continue;
    if (!addr.geo) continue; // skip un-geocoded addresses; they'll be picked up once the admin
                             // re-saves the resident's address. Alternative: geocode here lazily.
    stops.push({
      pickupId: pickup.id,
      residentId: pickup.residentId,
      addressId: pickup.addressId,
      location: { lat: addr.geo.lat, lng: addr.geo.lng },
    });
  }

  // Pending bag orders for this zone not already on a route.
  const bagOrdersSnap = await adminDb
    .collection('bagOrders')
    .where('zoneId', '==', zoneId)
    .where('deliveryRouteId', '==', null)
    .where('status', '==', 'queued')
    .get();
  const bagOrderIds = bagOrdersSnap.docs.map((d) => d.id);

  const waypoints: RouteWaypoint[] = stops.map((s) => ({ id: s.pickupId, location: s.location }));
  const optimized = await optimizeRoute({
    origin: depotGeo,
    destination: depotGeo,
    waypoints,
  });

  const pickupById = new Map(stops.map((s) => [s.pickupId, s]));
  const orderedStops: RouteStop[] = optimized.orderedWaypointIds
    .map((pickupId, idx) => {
      const plan = pickupById.get(pickupId);
      if (!plan) return null;
      return {
        pickupId,
        addressId: plan.addressId,
        residentId: plan.residentId,
        order: idx,
      } satisfies RouteStop;
    })
    .filter((s): s is RouteStop => s !== null);

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
    stops: orderedStops.length,
    bagOrders: bagOrderIds.length,
    mocked: optimized.mocked,
  });
}
