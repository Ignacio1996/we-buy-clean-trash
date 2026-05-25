'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateBagOrderTotal, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/lib/logic/calculateBagOrderTotal';
import { startBagCheckout } from '@/lib/payments/stripe-client';
import { SS, SSPillButton, SSStickerCard } from '@/components/resident/ss/SS';

const MIN_QTY = 1;
const MAX_QTY = 20;

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function OrderBagsForm({
  unitPrice,
  freeSheetCredits = 0,
}: {
  unitPrice: number;
  freeSheetCredits?: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(freeSheetCredits > 0 ? 1 : 4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const breakdown = useMemo(
    () => calculateBagOrderTotal({ quantity, unitPrice, freeSheetCredits }),
    [quantity, unitPrice, freeSheetCredits],
  );

  function adjust(delta: number) {
    setQuantity((q) => Math.max(MIN_QTY, Math.min(MAX_QTY, q + delta)));
  }

  async function handleCheckout() {
    setBusy(true);
    setError(null);
    try {
      // 1. Server creates the bagOrders doc as `pending` (no route enqueue,
      //    no welcome credit consumed yet — that happens at confirm time).
      const res = await fetch('/api/bag-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'order_failed');

      // 2. $0 (welcome-credit-only) order: nothing to charge. Jump to the
      //    success page; its server-side confirm flips status to queued.
      if (body.total === 0) {
        router.replace(`/resident/order-bags/success?order=${body.orderId}`);
        return;
      }

      // 3. Paid order: hand off to the firestore-stripe-payments extension,
      //    which writes a checkout_sessions doc and returns the Stripe URL.
      //    startBagCheckout() does window.location.assign — flow leaves SPA.
      await startBagCheckout({
        orderId: body.orderId,
        billableQuantity: body.billableQuantity,
        includeShipping: !body.freeShipping,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'order_failed');
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '20px 20px 8px' }}>
      <SSStickerCard background={SS.sky} style={{ padding: '24px 22px', borderRadius: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: SS.ink }}>Sheets of bags</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={() => adjust(-1)}
              disabled={busy || quantity <= MIN_QTY}
              aria-label="Decrease"
              style={stepBtnStyle(false, busy || quantity <= MIN_QTY)}
            >
              −
            </button>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: SS.ink,
                minWidth: 24,
                textAlign: 'center',
                letterSpacing: -0.8,
              }}
            >
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => adjust(1)}
              disabled={busy || quantity >= MAX_QTY}
              aria-label="Increase"
              style={stepBtnStyle(true, busy || quantity >= MAX_QTY)}
            >
              +
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: `1px dashed ${SS.ink}`,
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink }}>Bags</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: SS.ink }}>
            {formatDollars(quantity * unitPrice)}
          </div>
        </div>

        {breakdown.freeSheetCredits > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: `1px dashed ${SS.ink}`,
              paddingTop: 10,
              marginTop: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: SS.green }}>
              Welcome credit · 1 sheet
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: SS.green, fontStyle: 'italic' }}>
              −{formatDollars(breakdown.discount)}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: `1px dashed ${SS.ink}`,
            paddingTop: 10,
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink }}>
            {quantity * 10} bags ·{' '}
            {breakdown.freeShipping ? 'free delivery' : `+$${SHIPPING_FEE.toFixed(2)} delivery`}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: SS.ink, letterSpacing: -0.5 }}>
            {formatDollars(breakdown.total)}
          </div>
        </div>
      </SSStickerCard>

      {!breakdown.freeShipping && breakdown.subtotal > 0 && breakdown.subtotal < FREE_SHIPPING_THRESHOLD && (
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 12,
            padding: '0 4px',
          }}
        >
          Add {formatDollars(FREE_SHIPPING_THRESHOLD - breakdown.subtotal)} more to unlock free
          delivery.
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <SSPillButton variant="primary" disabled={busy} onClick={handleCheckout}>
          {busy
            ? 'Placing order…'
            : breakdown.total === 0
              ? 'Claim your free sheet'
              : `Place order — ${formatDollars(breakdown.total)}`}
        </SSPillButton>
      </div>

      {breakdown.total > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: SS.inkSoft,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginTop: 14,
          }}
        >
          Secure checkout · Stripe (test mode)
        </div>
      )}

      {error && (
        <div
          style={{
            background: SS.brand,
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: 14,
            color: '#fff',
            marginTop: 14,
            fontFamily: SS.sans,
            fontSize: 14,
            fontWeight: 900,
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function stepBtnStyle(filled: boolean, disabled: boolean) {
  return {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: filled ? SS.ink : '#fff',
    color: filled ? '#fff' : SS.ink,
    border: `2px solid ${SS.ink}`,
    fontFamily: SS.sans,
    fontWeight: 900 as const,
    fontSize: 20,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

