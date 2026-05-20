'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 2500;
const MAX_TRIES = 16; // ~40s — Stripe webhook usually arrives in 1–3s

/**
 * Polls /api/bag-orders/[id]/confirm until the order reconciles (outcome
 * 'confirmed') or we exhaust MAX_TRIES. Renders nothing visible — its parent
 * (success page in pending state) controls the surrounding UI; this just
 * drives the refresh.
 */
export function ConfirmPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [exhausted, setExhausted] = useState(false);
  const tries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      tries.current += 1;
      try {
        const res = await fetch(`/api/bag-orders/${orderId}/confirm`, {
          method: 'POST',
        });
        if (cancelled) return;
        const body = (await res.json().catch(() => ({}))) as { outcome?: string };
        if (body.outcome === 'confirmed') {
          // Server has flipped the order to queued — re-render the server
          // component to pick up the new status.
          router.refresh();
          return;
        }
      } catch {
        // Network blip — keep polling until the budget runs out.
      }
      if (tries.current >= MAX_TRIES) {
        setExhausted(true);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, router]);

  if (!exhausted) return null;
  return (
    <div
      style={{
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#666',
        marginTop: 10,
      }}
    >
      Still waiting on Stripe — refresh this page in a minute.
    </div>
  );
}
