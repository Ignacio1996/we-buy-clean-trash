import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc, BagOrderStatus } from '@/lib/types/bagOrder';
import type { RouteDoc } from '@/lib/types/route';
import { EcoMasthead, EcoH1, EcoEmpty, EcoButton } from '@/components/resident/eco/Eco';
import { IconBox, IconTruck, IconClock } from '@/components/icons/EcoIcons';
import type { ReactNode } from 'react';

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

function statusIcon(status: BagOrderStatus): ReactNode {
  switch (status) {
    case 'delivered':
      return <IconBox size={18} color="#2D5A3D" stroke={1.5} />;
    case 'cancelled':
      return <IconBox size={18} color="#8A8A7A" stroke={1.5} />;
    case 'out_for_delivery':
      return <IconTruck size={18} color="#2D5A3D" stroke={1.5} />;
    case 'pending':
      return <IconClock size={18} color="#A0682A" stroke={1.5} />;
    default:
      return <IconBox size={18} color="#5A6358" stroke={1.5} />;
  }
}

function statusTone(status: BagOrderStatus): string {
  switch (status) {
    case 'delivered':
      return '#2D5A3D';
    case 'cancelled':
      return '#8A8A7A';
    case 'out_for_delivery':
    case 'queued':
      return '#2D5A3D';
    case 'pending':
      return '#A0682A';
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
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead title="Order history" backHref="/resident" />

      <section className="mb-5">
        <EcoH1>Order history</EcoH1>
        <p
          className="mt-2 italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 13,
            color: '#5A6358',
          }}
        >
          All your bag orders — newest first.
        </p>
      </section>

      {orders.length === 0 ? (
        <>
          <EcoEmpty
            title="No orders yet."
            body="When you order bags, they'll show up here."
          />
          <div className="mt-4 flex justify-center">
            <EcoButton href="/resident/order-bags" variant="primary">
              Order bags
            </EcoButton>
          </div>
        </>
      ) : (
        <ul className="space-y-2">
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
                className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-8 items-center justify-center rounded-[10px]"
                      style={{ background: '#E8EFE6' }}
                    >
                      {statusIcon(o.status)}
                    </span>
                    <div
                      style={{
                        fontFamily: 'var(--eco-serif)',
                        fontSize: 15,
                        color: '#1F2A22',
                      }}
                    >
                      {o.quantity} sheet{o.quantity === 1 ? '' : 's'} · {o.quantity * 10} bags
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 15,
                      color: '#1F2A22',
                    }}
                  >
                    {formatDollars(o.total)}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span style={{ color: statusTone(o.status), fontWeight: 500 }}>
                    {statusLabel(o.status)}
                  </span>
                  <span style={{ color: '#5A6358' }}>{rightLabel}</span>
                </div>
                {placed && (
                  <div className="mt-1 text-[10px]" style={{ color: '#8A8A7A' }}>
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
