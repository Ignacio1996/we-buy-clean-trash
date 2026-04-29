'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateBagOrderTotal } from '@/lib/logic/calculateBagOrderTotal';

const MIN_QTY = 1;
const MAX_QTY = 20;

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function OrderBagsForm({ unitPrice }: { unitPrice: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const breakdown = useMemo(
    () => calculateBagOrderTotal({ quantity, unitPrice }),
    [quantity, unitPrice],
  );

  function adjust(delta: number) {
    setQuantity((q) => Math.max(MIN_QTY, Math.min(MAX_QTY, q + delta)));
  }

  async function handleCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bag-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'order_failed');
      router.replace(body.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'order_failed');
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div
          className="uppercase"
          style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.4 }}
        >
          Quantity
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={quantity <= MIN_QTY || busy}
            className="flex size-11 items-center justify-center rounded-full border border-[#D9D2C2] bg-[#FBF7EE] text-xl text-[#1F2A22] transition-colors hover:bg-[#E8EFE6] disabled:opacity-30"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <div className="text-center">
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 40,
                fontWeight: 400,
                color: '#1F2A22',
                lineHeight: 1,
                letterSpacing: -0.5,
              }}
            >
              {quantity}
            </div>
            <div
              className="mt-1 italic"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 12,
                color: '#5A6358',
              }}
            >
              {quantity * 10} bags · {quantity} sheet{quantity === 1 ? '' : 's'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={quantity >= MAX_QTY || busy}
            className="flex size-11 items-center justify-center rounded-full border border-[#D9D2C2] bg-[#FBF7EE] text-xl text-[#1F2A22] transition-colors hover:bg-[#E8EFE6] disabled:opacity-30"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4 text-sm">
        <div className="flex items-baseline justify-between border-b border-[#E8E2D0] py-2">
          <span
            className="uppercase"
            style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.4 }}
          >
            Subtotal
          </span>
          <span
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 15,
              color: '#1F2A22',
            }}
          >
            {formatDollars(breakdown.subtotal)}
          </span>
        </div>
        <div className="flex items-baseline justify-between border-b border-[#E8E2D0] py-2">
          <span
            className="uppercase"
            style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.4 }}
          >
            Shipping
          </span>
          <span
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 15,
              color: breakdown.freeShipping ? '#2D5A3D' : '#1F2A22',
              fontStyle: breakdown.freeShipping ? 'italic' : 'normal',
            }}
          >
            {breakdown.freeShipping ? 'Free' : formatDollars(breakdown.shipping)}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between pt-3">
          <span
            className="uppercase"
            style={{ fontSize: 11, color: '#1F2A22', letterSpacing: 1.4, fontWeight: 600 }}
          >
            Total
          </span>
          <span
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 28,
              fontWeight: 400,
              color: '#1F2A22',
              letterSpacing: -0.5,
            }}
          >
            {formatDollars(breakdown.total)}
          </span>
        </div>
        {!breakdown.freeShipping && (
          <div
            className="mt-2 italic"
            style={{ fontFamily: 'var(--eco-serif)', fontSize: 12, color: '#5A6358' }}
          >
            Add {formatDollars(20 - breakdown.subtotal)} more to unlock free shipping.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={busy}
        className="w-full rounded-full bg-[#2D5A3D] px-4 py-3.5 text-[14px] font-semibold tracking-[0.3px] text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:opacity-50"
      >
        {busy ? 'Placing order…' : `Place order — ${formatDollars(breakdown.total)}`}
      </button>
      <p
        className="text-center italic"
        style={{ fontFamily: 'var(--eco-serif)', fontSize: 11, color: '#8A8A7A' }}
      >
        Pilot uses a mocked Stripe checkout — no card is charged.
      </p>

      {error && (
        <p className="rounded-[10px] border border-[rgba(154,75,38,0.3)] bg-[#F0DCC8] px-3 py-2 text-sm text-[#9A4B26]">
          {error}
        </p>
      )}
    </section>
  );
}
