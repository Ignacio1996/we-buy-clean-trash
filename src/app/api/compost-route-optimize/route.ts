import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { optimizeRoute, type LatLng, type RouteWaypoint } from '@/lib/maps/routes';
import { geocodeAddress } from '@/lib/maps/geocode';
import { isCompostManagerRole } from '@/lib/types/role';
import {
  isCollectionDay,
  COLLECTION_DAY_LABELS,
  type CommercialAccountDoc,
} from '@/lib/types/commercialAccount';

/**
 * Optimize the operator's compost stop order for a given weekday.
 *
 * Repurposes the residential Routes-API optimizer for Tia's commercial sites:
 * pull the sites scheduled that day, order them by drive time from a start
 * address back to a finish address, and write the result into each site's
 * `routeOrder`. The operator's site list already sorts by `routeOrder`, so this
 * is what makes "On today" come out in the order the driver actually drives.
 *
 * Pilot caveat: `routeOrder` is a single field, not per-day. A site that runs on
 * more than one day shares one order across all of them — optimizing a second
 * day overwrites the first. Fine while almost every site is a single day; a
 * `routeOrderByDay` map is the future upgrade.
 */

// Geocode a free-form address string. The structured geocoder formats
// "street, city, state zip"; passing the whole line as `street` lets Tia type a
// plain address ("1200 W Third Ave, Columbus OH") without parsing it apart.
async function geocodeFreeform(address: string): Promise<LatLng | null> {
  const result = await geocodeAddress({
    street: address,
    unit: null,
    city: '',
    state: '',
    postalCode: '',
  });
  return result ? { lat: result.lat, lng: result.lng } : null;
}

function siteGeocodeInput(a: CommercialAccountDoc) {
  return {
    street: a.street,
    unit: a.unit,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const day = typeof raw.day === 'number' ? raw.day : Number(raw.day);
  if (!isCollectionDay(day)) {
    return NextResponse.json({ error: 'invalid_day' }, { status: 400 });
  }
  const startAddress = typeof raw.startAddress === 'string' ? raw.startAddress.trim() : '';
  if (!startAddress) {
    return NextResponse.json({ error: 'missing_start_address' }, { status: 400 });
  }
  const endAddress =
    typeof raw.endAddress === 'string' && raw.endAddress.trim()
      ? raw.endAddress.trim()
      : startAddress;
  const zoneId = typeof raw.zoneId === 'string' ? raw.zoneId.trim() : '';

  // Resolve the start/finish coordinates for the route.
  const origin = await geocodeFreeform(startAddress);
  if (!origin) {
    return NextResponse.json({ error: 'start_geocode_failed' }, { status: 422 });
  }
  const destination = endAddress === startAddress ? origin : await geocodeFreeform(endAddress);
  if (!destination) {
    return NextResponse.json({ error: 'end_geocode_failed' }, { status: 422 });
  }

  // Active, non-paused sites scheduled for this weekday (optionally one zone).
  let query = adminDb.collection('commercialAccounts').where('active', '==', true);
  if (zoneId) query = query.where('zoneId', '==', zoneId);
  const snap = await query.get();
  const sites = snap.docs
    .map((d) => d.data() as CommercialAccountDoc)
    .filter(
      (a) =>
        a.status !== 'paused' &&
        Array.isArray(a.collectionDays) &&
        a.collectionDays.includes(day),
    );

  if (sites.length === 0) {
    return NextResponse.json({
      ok: true,
      day,
      dayLabel: COLLECTION_DAY_LABELS[day],
      ordered: [],
      skipped: [],
      mocked: false,
      count: 0,
    });
  }

  // Each site needs coordinates. Use stored geo; geocode from the address when
  // missing (and remember it to backfill below so the next run is cheaper).
  const waypoints: RouteWaypoint[] = [];
  const geoBackfill = new Map<string, LatLng>();
  const skipped: { id: string; name: string }[] = [];
  for (const site of sites) {
    let geo: LatLng | null = site.geo ? { lat: site.geo.lat, lng: site.geo.lng } : null;
    if (!geo) {
      const result = await geocodeAddress(siteGeocodeInput(site));
      if (result) {
        geo = { lat: result.lat, lng: result.lng };
        geoBackfill.set(site.id, geo);
      }
    }
    if (!geo) {
      skipped.push({ id: site.id, name: site.businessName });
      continue;
    }
    waypoints.push({ id: site.id, location: geo });
  }

  const optimized =
    waypoints.length > 0
      ? await optimizeRoute({ origin, destination, waypoints })
      : { orderedWaypointIds: [], mocked: false };

  // Write the optimized sequence back into routeOrder (0-based). Sites we
  // couldn't geocode are left untouched so a partial run never scrambles them.
  const orderBySite = new Map(optimized.orderedWaypointIds.map((id, idx) => [id, idx]));
  const batch = adminDb.batch();
  for (const site of sites) {
    const order = orderBySite.get(site.id);
    if (order === undefined) continue;
    const update: Record<string, unknown> = {
      routeOrder: order,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const backfilled = geoBackfill.get(site.id);
    if (backfilled) update.geo = backfilled;
    batch.update(adminDb.collection('commercialAccounts').doc(site.id), update);
  }
  await batch.commit();

  const nameById = new Map(sites.map((s) => [s.id, s.businessName]));
  const ordered = optimized.orderedWaypointIds.map((id, idx) => ({
    id,
    name: nameById.get(id) ?? id,
    order: idx,
  }));

  return NextResponse.json({
    ok: true,
    day,
    dayLabel: COLLECTION_DAY_LABELS[day],
    ordered,
    skipped,
    mocked: optimized.mocked,
    count: ordered.length,
  });
}
