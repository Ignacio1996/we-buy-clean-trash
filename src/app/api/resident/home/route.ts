import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireRole } from '@/lib/auth/session';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import type { BagOrderDoc, BagOrderStatus } from '@/lib/types/bagOrder';
import type { PickupDoc } from '@/lib/types/pickup';
import type { RouteDoc } from '@/lib/types/route';

// `pending` is intentionally excluded — abandoned Stripe checkouts shouldn't
// surface on the dashboard as live deliveries.
const OPEN_ORDER_STATUSES: readonly BagOrderStatus[] = ['queued', 'out_for_delivery'];

export interface ResidentHomePayload {
  hasEverOrdered: boolean;
  hasRedeemed: boolean;
  featuredCampaign: {
    multiplier: number;
    materialNames: string[];
    endsAtMs: number;
  } | null;
  headlineOrder: {
    totalOpenBags: number;
    status: BagOrderStatus;
    routeDateMs: number | null;
    windowStart: string | null;
    windowEnd: string | null;
  } | null;
  nextPickupDateMs: number | null;
}

export async function GET() {
  const session = await requireRole('resident');
  const uid = session.uid;

  const [ordersSnap, userRedemptionSnap, pickupsSnap, activeCampaigns, allMaterials] =
    await Promise.all([
      adminDb.collection('bagOrders').where('residentId', '==', uid).get(),
      adminDb
        .collection('redemptions')
        .where('userId', '==', uid)
        .where('status', 'in', ['pending', 'fulfilled'])
        .limit(1)
        .get(),
      adminDb
        .collection('pickups')
        .where('residentId', '==', uid)
        .where('status', '==', 'pending')
        .get(),
      loadActiveCampaigns(),
      loadActiveMaterials(),
    ]);

  const hasRedeemed = !userRedemptionSnap.empty;
  const hasEverOrdered = ordersSnap.size > 0;

  const openOrders = ordersSnap.docs
    .map((d) => d.data() as BagOrderDoc)
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status))
    .sort((a, b) => {
      const am = a.createdAt?.toMillis?.() ?? 0;
      const bm = b.createdAt?.toMillis?.() ?? 0;
      return bm - am;
    });

  const scheduledPickups = pickupsSnap.docs
    .map((d) => d.data() as PickupDoc)
    .filter((p): p is PickupDoc & { routeId: string } => !!p.routeId);

  const routeIds = Array.from(
    new Set([
      ...openOrders.map((o) => o.deliveryRouteId).filter((id): id is string => !!id),
      ...scheduledPickups.map((p) => p.routeId),
    ]),
  );

  const routeDates = new Map<string, Date>();
  const routeWindows = new Map<string, { start: string | null; end: string | null }>();
  if (routeIds.length > 0) {
    const routeSnaps = await adminDb.getAll(
      ...routeIds.map((id) => adminDb.collection('routes').doc(id)),
    );
    for (const snap of routeSnaps) {
      if (!snap.exists) continue;
      const route = snap.data() as RouteDoc;
      const ts = route.date?.toDate?.();
      if (ts) routeDates.set(snap.id, ts);
      routeWindows.set(snap.id, {
        start: route.deliveryWindowStart ?? null,
        end: route.deliveryWindowEnd ?? null,
      });
    }
  }

  const now = new Date();
  const liveCampaigns = activeCampaigns.filter((c) => c.startsAt <= now);
  const materialNameById = new Map(allMaterials.map((m) => [m.id, m.name]));
  const featured = liveCampaigns[0] ?? null;

  const headlineOrder = openOrders[0] ?? null;
  const headlineRouteDate = headlineOrder?.deliveryRouteId
    ? (routeDates.get(headlineOrder.deliveryRouteId) ?? null)
    : null;
  const headlineRouteWindow = headlineOrder?.deliveryRouteId
    ? (routeWindows.get(headlineOrder.deliveryRouteId) ?? null)
    : null;

  const nextPickupDate =
    scheduledPickups
      .map((p) => routeDates.get(p.routeId))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const totalOpenBags = openOrders.reduce((sum, o) => sum + o.quantity * 10, 0);

  const payload: ResidentHomePayload = {
    hasEverOrdered,
    hasRedeemed,
    featuredCampaign: featured
      ? {
          multiplier: featured.multiplier,
          materialNames: featured.materialIds.map((id) => materialNameById.get(id) ?? id),
          endsAtMs: featured.endsAt.getTime(),
        }
      : null,
    headlineOrder: headlineOrder
      ? {
          totalOpenBags,
          status: headlineOrder.status,
          routeDateMs: headlineRouteDate?.getTime() ?? null,
          windowStart: headlineRouteWindow?.start ?? null,
          windowEnd: headlineRouteWindow?.end ?? null,
        }
      : null,
    nextPickupDateMs: nextPickupDate?.getTime() ?? null,
  };

  return NextResponse.json(payload, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
