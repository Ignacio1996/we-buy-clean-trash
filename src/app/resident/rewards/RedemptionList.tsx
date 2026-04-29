'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconGift, IconBox } from '@/components/icons/EcoIcons';

const GIFT_CARD_POINTS = 100_000;

type ActiveBrand = 'amazon' | 'walmart';

type Option =
  | {
      key: ActiveBrand;
      icon: ReactNode;
      label: string;
      subtitle: string;
      disabled: false;
    }
  | {
      key: string;
      icon: ReactNode;
      label: string;
      subtitle: string;
      disabled: true;
    };

const OPTIONS: Option[] = [
  {
    key: 'amazon',
    icon: <IconGift size={18} color="#2D5A3D" stroke={1.5} />,
    label: 'Amazon gift card',
    subtitle: '100,000 pts = $10',
    disabled: false,
  },
  {
    key: 'walmart',
    icon: <IconGift size={18} color="#2D5A3D" stroke={1.5} />,
    label: 'Walmart gift card',
    subtitle: '100,000 pts = $10',
    disabled: false,
  },
  {
    key: 'pay_trash_bill',
    icon: <IconBox size={18} color="#8A8A7A" stroke={1.5} />,
    label: 'Pay trash bill',
    subtitle: 'Coming soon',
    disabled: true,
  },
  {
    key: 'donate',
    icon: <IconBox size={18} color="#8A8A7A" stroke={1.5} />,
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
    <section className="mt-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
      <div className="eco-eyebrow mb-1">Redeem for</div>
      <ul className="mt-1 divide-y divide-[#E8E2D0]">
        {OPTIONS.map((opt) => {
          const locked = opt.disabled || !canRedeem;
          return (
            <li key={opt.key} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: opt.disabled ? '#F8F3E5' : '#E8EFE6' }}
                >
                  {opt.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 15,
                      color: locked ? '#8A8A7A' : '#1F2A22',
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    className="mt-0.5 italic"
                    style={{
                      fontFamily: 'var(--eco-serif)',
                      fontSize: 12,
                      color: '#5A6358',
                    }}
                  >
                    {opt.subtitle}
                  </div>
                </div>
              </div>
              {opt.disabled ? (
                <span
                  className="rounded-full border px-3 py-1 text-[11px] uppercase"
                  style={{
                    borderColor: '#D9D2C2',
                    color: '#8A8A7A',
                    letterSpacing: 1.2,
                  }}
                >
                  Soon
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => redeem(opt.key as ActiveBrand)}
                  disabled={locked || busy === opt.key}
                  className="rounded-full bg-[#2D5A3D] px-4 py-1.5 text-[12px] font-semibold tracking-[0.3px] text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy === opt.key ? '…' : canRedeem ? 'Redeem' : 'Locked'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {success && (
        <p
          className="mt-3 rounded-[10px] border px-3 py-2 text-[12px]"
          style={{
            background: '#E8EFE6',
            borderColor: 'rgba(45,90,61,0.3)',
            color: '#2D5A3D',
          }}
        >
          {success}
        </p>
      )}
      {error && (
        <p
          className="mt-3 rounded-[10px] border px-3 py-2 text-[12px]"
          style={{
            background: '#F0DCC8',
            borderColor: 'rgba(154,75,38,0.3)',
            color: '#9A4B26',
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
