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
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Quantity</div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={quantity <= MIN_QTY || busy}
            className="flex size-10 items-center justify-center rounded-full border border-white/20 text-lg text-white disabled:opacity-30"
          >
            −
          </button>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{quantity}</div>
            <div className="text-xs text-gray-400">{quantity * 10} bags</div>
          </div>
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={quantity >= MAX_QTY || busy}
            className="flex size-10 items-center justify-center rounded-full border border-white/20 text-lg text-white disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex justify-between text-gray-300">
          <span>Subtotal</span>
          <span>{formatDollars(breakdown.subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-300">
          <span>Shipping</span>
          <span>
            {breakdown.freeShipping ? (
              <span className="text-green-400">Free</span>
            ) : (
              formatDollars(breakdown.shipping)
            )}
          </span>
        </div>
        <div className="mt-2 border-t border-white/10 pt-2 text-lg font-semibold text-white">
          <div className="flex justify-between">
            <span>Total</span>
            <span>{formatDollars(breakdown.total)}</span>
          </div>
        </div>
        {!breakdown.freeShipping && (
          <div className="mt-2 text-xs text-gray-400">
            Add {formatDollars(20 - breakdown.subtotal)} more to unlock free shipping.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={busy}
        className="w-full rounded-xl bg-green-500 px-3 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Placing order…' : `Checkout (stub) — ${formatDollars(breakdown.total)}`}
      </button>
      <p className="text-center text-[10px] text-gray-500">
        Pilot uses a mocked Stripe checkout — no card is charged.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
