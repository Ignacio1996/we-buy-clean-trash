import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc, BagOrderStatus } from '@/lib/types/bagOrder';
import type { RouteDoc } from '@/lib/types/route';
import {
  SS,
  SSEyebrow,
  SSPillLink,
  SSScreen,
  SSStatusBarSpacer,
  SSStickerCard,
} from '@/components/resident/ss/SS';

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

function statusChip(status: BagOrderStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'delivered':
      return { bg: SS.green, fg: '#fff', border: SS.ink };
    case 'out_for_delivery':
      return { bg: SS.yellow, fg: SS.ink, border: SS.ink };
    case 'queued':
      return { bg: SS.sky, fg: SS.ink, border: SS.ink };
    case 'pending':
      return { bg: SS.peach, fg: SS.ink, border: SS.ink };
    case 'cancelled':
      return { bg: '#fff', fg: SS.inkSoft, border: SS.line };
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
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/resident"
          aria-label="Back"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            textDecoration: 'none',
            fontFamily: SS.sans,
          }}
        >
          ←
        </Link>
        <Link
          href="/resident/order-bags"
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: SS.ink,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textDecoration: 'underline',
          }}
        >
          New order
        </Link>
      </div>

      <div style={{ padding: '28px 24px 8px' }}>
        <SSEyebrow style={{ color: SS.brand, marginBottom: 8 }}>Bags</SSEyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          Order history.
        </h1>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.4,
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          All your bag orders — newest first.
        </p>
      </div>

      {orders.length === 0 ? (
        <div style={{ padding: '24px 20px' }}>
          <SSStickerCard>
            <SSEyebrow style={{ marginBottom: 10 }}>Nothing here yet</SSEyebrow>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: SS.ink,
                letterSpacing: -0.6,
                lineHeight: 1.05,
              }}
            >
              No orders yet.
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS.inkSoft,
                marginTop: 8,
                lineHeight: 1.4,
              }}
            >
              When you order bags, they&rsquo;ll show up here.
            </div>
          </SSStickerCard>
          <div style={{ marginTop: 20 }}>
            <SSPillLink href="/resident/order-bags" variant="primary">
              Order bags
            </SSPillLink>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '20px 20px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
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
                  : 'Delivery TBD';
            const chip = statusChip(o.status);
            return (
              <SSStickerCard
                key={o.id}
                style={{ padding: '16px 18px', boxShadow: `0 3px 0 ${SS.ink}` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: -0.4,
                    }}
                  >
                    {o.quantity} sheet{o.quantity === 1 ? '' : 's'} · {o.quantity * 10} bags
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: -0.5,
                    }}
                  >
                    {formatDollars(o.total)}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: chip.bg,
                      color: chip.fg,
                      border: `2px solid ${chip.border}`,
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {statusLabel(o.status)}
                  </span>
                  {rightLabel && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: SS.inkSoft,
                        textAlign: 'right',
                      }}
                    >
                      {rightLabel}
                    </span>
                  )}
                </div>
                {placed && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: SS.inkSoft,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      marginTop: 8,
                    }}
                  >
                    Placed {formatDate(placed)}
                  </div>
                )}
              </SSStickerCard>
            );
          })}
        </div>
      )}
    </SSScreen>
  );
}
