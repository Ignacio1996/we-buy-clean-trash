import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import {
  SS,
  SSEyebrow,
  SSPillLink,
  SSScreen,
  SSStatusBarSpacer,
  SSStickerCard,
} from '@/components/resident/ss/SS';

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function OrderBagsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const session = await getSession();
  const snap = await adminDb.collection('bagOrders').doc(orderId).get();
  if (!snap.exists) notFound();
  const order = snap.data() as BagOrderDoc;
  if (order.residentId !== session!.uid) notFound();

  const totalBags = order.quantity * 10;
  const sheetLabel = `${order.quantity} sheet${order.quantity === 1 ? '' : 's'}`;

  const steps: Array<[string, string]> = [
    ['Bags arrive', 'Delivered on your next pickup route.'],
    ['Set out by 5:30 PM', 'Place filled bags at the curb on your pickup day.'],
    ['Points credited', 'Each bag earns points after weigh-in.'],
  ];

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '60px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: SS.green,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            fontWeight: 900,
            margin: '0 auto 28px',
            border: `4px solid ${SS.ink}`,
            boxShadow: `0 6px 0 ${SS.ink}`,
          }}
        >
          ✓
        </div>
        <SSEyebrow style={{ color: SS.green, marginBottom: 10 }}>Confirmed</SSEyebrow>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 0.92,
            color: SS.ink,
            textAlign: 'center',
            margin: 0,
          }}
        >
          Order placed!
        </h1>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.75,
            textAlign: 'center',
            lineHeight: 1.4,
            marginTop: 14,
          }}
        >
          {sheetLabel} · {totalBags} bags · {formatDollars(order.total)}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <SSStickerCard>
          <SSEyebrow style={{ marginBottom: 12 }}>What happens next</SSEyebrow>
          {steps.map(([when, what], i) => (
            <div
              key={when}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 0',
                borderTop: i > 0 ? `1px solid ${SS.line}` : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i === 0 ? SS.brand : SS.ink,
                  marginTop: 8,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: SS.inkSoft,
                  }}
                >
                  {when}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: -0.3,
                    marginTop: 2,
                  }}
                >
                  {what}
                </div>
              </div>
            </div>
          ))}
        </SSStickerCard>
      </div>

      <div style={{ padding: '24px 24px 28px' }}>
        <SSPillLink href="/resident" variant="dark">
          Back to home
        </SSPillLink>
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: SS.inkSoft,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 16,
          }}
        >
          Order ID · {order.id}
        </div>
      </div>
    </SSScreen>
  );
}
