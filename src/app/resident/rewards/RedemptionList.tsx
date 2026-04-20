'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GIFT_CARD_POINTS = 100_000;

type ActiveBrand = 'amazon' | 'walmart';

const OPTIONS: Array<
  | { key: ActiveBrand; icon: string; label: string; subtitle: string; disabled: false }
  | { key: string; icon: string; label: string; subtitle: string; disabled: true }
> = [
  {
    key: 'amazon',
    icon: '🛒',
    label: 'Amazon gift card',
    subtitle: '100,000 pts = $10',
    disabled: false,
  },
  {
    key: 'walmart',
    icon: '🏪',
    label: 'Walmart gift card',
    subtitle: '100,000 pts = $10',
    disabled: false,
  },
  {
    key: 'pay_trash_bill',
    icon: '🧾',
    label: 'Pay trash bill',
    subtitle: 'Coming soon',
    disabled: true,
  },
  {
    key: 'donate',
    icon: '❤️',
    label: 'Donate to nonprofit',
    subtitle: 'Coming soon',
    disabled: true,
  },
];

export function RedemptionList({ balance }: { balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function redeem(brand: ActiveBrand) {
    if (balance < GIFT_CARD_POINTS) return;
    setBusy(brand);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/redemptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'redemption_failed');
      setSuccess(
        `Request submitted — an admin will email your ${brand === 'amazon' ? 'Amazon' : 'Walmart'} code shortly.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'redemption_failed');
    } finally {
      setBusy(null);
    }
  }

  const canRedeem = balance >= GIFT_CARD_POINTS;

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">Redeem for</div>
      <ul className="mt-2 divide-y divide-white/5">
        {OPTIONS.map((opt) => {
          const locked = opt.disabled || !canRedeem;
          return (
            <li key={opt.key} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-base">
                  {opt.icon}
                </span>
                <div>
                  <div className={`text-sm font-medium ${locked ? 'text-gray-400' : 'text-white'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-gray-500">{opt.subtitle}</div>
                </div>
              </div>
              {opt.disabled ? (
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-gray-500">
                  Soon
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => redeem(opt.key as ActiveBrand)}
                  disabled={locked || busy === opt.key}
                  className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-30"
                >
                  {busy === opt.key ? '…' : canRedeem ? 'Redeem' : 'Locked'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {success && <p className="mt-3 text-xs text-green-400">{success}</p>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </section>
  );
}
