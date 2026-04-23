import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc, BagOrderStatus } from '@/lib/types/bagOrder';
import type { RouteDoc } from '@/lib/types/route';

function formatDollars(dollars: number): string {
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: BagOrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Payment pending';
    case 'queued':
      return 'Queued for delivery';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
  }
}

function statusEmoji(status: BagOrderStatus): string {
  switch (status) {
    case 'delivered':
      return '✅';
    case 'cancelled':
      return '✖️';
    case 'out_for_delivery':
      return '🚐';
    case 'pending':
      return '⏳';
    default:
      return '📦';
  }
}

function statusTone(status: BagOrderStatus): string {
  switch (status) {
    case 'delivered':
      return 'text-green-400';
    case 'cancelled':
      return 'text-gray-500';
    case 'out_for_delivery':
    case 'queued':
      return 'text-blue-300';
    case 'pending':
      return 'text-yellow-300';
  }
}

export default async function OrderHistoryPage() {
  const session = await getSession();
  const uid = session!.uid;

  const ordersSnap = await adminDb
    .collection('bagOrders')
    .where('residentId', '==', uid)
    .get();

  const orders = ordersSnap.docs
    .map((d) => d.data() as BagOrderDoc)
    .sort((a, b) => {
      const am = a.createdAt?.toMillis?.() ?? 0;
      const bm = b.createdAt?.toMillis?.() ?? 0;
      return bm - am;
    });

  const routeIds = Array.from(
    new Set(orders.map((o) => o.deliveryRouteId).filter((id): id is string => !!id)),
  );
  const routeDates = new Map<string, Date>();
  if (routeIds.length > 0) {
    const routeSnaps = await adminDb.getAll(
      ...routeIds.map((id) => adminDb.collection('routes').doc(id)),
    );
    for (const snap of routeSnaps) {
      if (!snap.exists) continue;
      const route = snap.data() as RouteDoc;
      const ts = route.date?.toDate?.();
      if (ts) routeDates.set(snap.id, ts);
    }
  }

  return (
    <main className="px-4 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">📦 Order history</h1>
        <Link href="/resident" className="text-xs text-gray-400">
          ← Home
        </Link>
      </div>
      <p className="mt-1 text-xs text-gray-400">All your bag orders — newest first.</p>

      {orders.length === 0 ? (
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-sm font-semibold text-white">No orders yet</div>
          <div className="mt-1 text-xs text-gray-400">
            When you order bags, they&rsquo;ll show up here.
          </div>
          <Link
            href="/resident/order-bags"
            className="mt-4 inline-block rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-black"
          >
            Order bags →
          </Link>
        </section>
      ) : (
        <ul className="mt-4 space-y-2">
          {orders.map((o) => {
            const placed = o.createdAt?.toDate?.();
            const delivered = o.deliveredAt?.toDate?.();
            const routeDate = o.deliveryRouteId ? routeDates.get(o.deliveryRouteId) : null;
            const rightLabel = delivered
              ? `Delivered ${formatDate(delivered)}`
              : routeDate
                ? `Arrives ${formatDate(routeDate)}`
                : o.status === 'cancelled'
                  ? ''
                  : 'Delivery date TBD';
            return (
              <li
                key={o.id}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">
                    {statusEmoji(o.status)} {o.quantity} sheet{o.quantity === 1 ? '' : 's'} ·{' '}
                    {o.quantity * 10} bags
                  </div>
                  <div className="text-gray-300">{formatDollars(o.total)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className={statusTone(o.status)}>{statusLabel(o.status)}</span>
                  <span className="text-gray-400">{rightLabel}</span>
                </div>
                {placed && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    Placed {formatDate(placed)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
