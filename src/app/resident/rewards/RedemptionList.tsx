'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconGift, IconBox } from '@/components/icons/EcoIcons';
import { SS, SSEyebrow } from '@/components/resident/ss/SS';

const GIFT_CARD_POINTS = 1_000;

type ActiveBrand = 'amazon' | 'walmart';

type Option =
  | {
      key: ActiveBrand;
      icon: ReactNode;
      label: string;
      subtitle: string;
      tint: string;
      disabled: false;
    }
  | {
      key: string;
      icon: ReactNode;
      label: string;
      subtitle: string;
      tint: string;
      disabled: true;
    };

const OPTIONS: Option[] = [
  {
    key: 'amazon',
    icon: <IconGift size={22} color={SS.ink} stroke={2.25} />,
    label: 'Amazon gift card',
    subtitle: '1,000 pts = $10',
    tint: SS.yellow,
    disabled: false,
  },
  {
    key: 'walmart',
    icon: <IconGift size={22} color={SS.ink} stroke={2.25} />,
    label: 'Walmart gift card',
    subtitle: '1,000 pts = $10',
    tint: SS.sky,
    disabled: false,
  },
  {
    key: 'pay_trash_bill',
    icon: <IconBox size={22} color={SS.ink} stroke={2.25} />,
    label: 'Pay trash bill',
    subtitle: 'Coming soon',
    tint: SS.mint,
    disabled: true,
  },
  {
    key: 'donate',
    icon: <IconBox size={22} color={SS.ink} stroke={2.25} />,
    label: 'Donate to nonprofit',
    subtitle: 'Coming soon',
    tint: SS.peach,
    disabled: true,
  },
];

export type PilotGate = 'open' | 'already_redeemed' | 'cap_reached';

const ERROR_MESSAGES: Record<string, string> = {
  already_redeemed_pilot: 'You already redeemed during the pilot — limit one gift card per user.',
  pilot_cap_reached: 'The pilot gift-card batch is fully claimed. Thanks for joining.',
  insufficient_balance: 'Not enough points yet.',
};

export function RedemptionList({
  balance,
  pilotGate,
}: {
  balance: number;
  pilotGate: PilotGate;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function redeem(brand: ActiveBrand) {
    if (balance < GIFT_CARD_POINTS) return;
    if (pilotGate !== 'open') return;
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
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : 'redemption_failed';
        throw new Error(ERROR_MESSAGES[code] ?? code);
      }
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

  const canRedeem = balance >= GIFT_CARD_POINTS && pilotGate === 'open';

  const gateNotice =
    pilotGate === 'already_redeemed'
      ? 'You already claimed your pilot gift card — limit one per user during the pilot.'
      : pilotGate === 'cap_reached'
        ? 'The pilot gift-card batch is fully claimed. Cash payouts coming soon.'
        : null;

  return (
    <section style={{ padding: '28px 20px 8px' }}>
      <SSEyebrow style={{ marginBottom: 12 }}>Redeem for</SSEyebrow>

      {gateNotice && (
        <div
          style={{
            background: SS.peach,
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            lineHeight: 1.4,
            boxShadow: `0 3px 0 ${SS.ink}`,
          }}
        >
          {gateNotice}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {OPTIONS.map((opt) => {
          const locked = opt.disabled || !canRedeem;
          const isBusy = busy === opt.key;
          return (
            <div
              key={opt.key}
              style={{
                background: opt.disabled ? '#fff' : opt.tint,
                border: `2px solid ${SS.ink}`,
                borderRadius: 18,
                padding: '14px 16px',
                boxShadow: `0 4px 0 ${SS.ink}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: opt.disabled ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#fff',
                  border: `2px solid ${SS.ink}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {opt.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: -0.3,
                    lineHeight: 1.1,
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: SS.ink,
                    opacity: 0.7,
                    marginTop: 4,
                    letterSpacing: 0.2,
                  }}
                >
                  {opt.subtitle}
                </div>
              </div>
              {opt.disabled ? (
                <span
                  style={{
                    background: '#fff',
                    border: `2px solid ${SS.ink}`,
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: SS.ink,
                  }}
                >
                  Soon
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => redeem(opt.key as ActiveBrand)}
                  disabled={locked || isBusy}
                  style={{
                    background: locked ? '#fff' : SS.green,
                    color: locked ? SS.inkSoft : '#fff',
                    border: locked ? `2px solid ${SS.ink}` : 'none',
                    borderRadius: 999,
                    padding: '10px 18px',
                    fontFamily: SS.sans,
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    cursor: locked || isBusy ? 'not-allowed' : 'pointer',
                    boxShadow: locked ? `0 3px 0 ${SS.ink}` : `0 3px 0 ${SS.greenDark}`,
                    opacity: locked && !opt.disabled ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {isBusy ? '…' : canRedeem ? 'Redeem' : 'Locked'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {success && (
        <div
          style={{
            marginTop: 14,
            background: SS.mint,
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            lineHeight: 1.4,
            boxShadow: `0 3px 0 ${SS.ink}`,
          }}
        >
          {success}
        </div>
      )}
      {error && (
        <div
          style={{
            marginTop: 14,
            background: SS.peach,
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            lineHeight: 1.4,
            boxShadow: `0 3px 0 ${SS.ink}`,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
