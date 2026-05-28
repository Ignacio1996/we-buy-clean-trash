'use client';

import { useEffect, useState } from 'react';
import { SS } from './ss/SS';
import { POINTS_PER_DOLLAR, SIGNUP_BONUS_POINTS } from '@/lib/logic/calculatePoints';

const STORAGE_PREFIX = 'wbct.signupBonusAcked.';
const BONUS_PTS = SIGNUP_BONUS_POINTS.toLocaleString('en-US');
const BONUS_DOLLARS = `$${(SIGNUP_BONUS_POINTS / POINTS_PER_DOLLAR).toFixed(2)}`;

export function SignupBonusModal({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `${STORAGE_PREFIX}${uid}`;
    if (window.localStorage.getItem(key)) return;
    setOpen(true);
  }, [uid]);

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${STORAGE_PREFIX}${uid}`, '1');
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(17,17,17,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#fff',
          border: `2px solid ${SS.ink}`,
          borderRadius: 22,
          padding: 28,
          textAlign: 'center',
          boxShadow: `0 8px 0 ${SS.ink}`,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: SS.green,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 900,
            margin: '0 auto 16px',
            border: `3px solid ${SS.ink}`,
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          +
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 6,
          }}
        >
          Signup bonus
        </div>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1.05,
            color: SS.ink,
          }}
        >
          You earned <span style={{ color: SS.green }}>{BONUS_PTS} points</span>.
        </h2>
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 800, color: SS.ink, opacity: 0.75 }}>
          That&rsquo;s worth <span style={{ color: SS.ink, fontWeight: 900 }}>{BONUS_DOLLARS}</span>{' '}
          toward your first reward.
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.5,
          }}
        >
          Earn 1,000 pts for a $10 gift card. Order bags to start collecting more.
        </p>
        <button
          type="button"
          onClick={dismiss}
          style={{
            marginTop: 20,
            width: '100%',
            background: SS.green,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '16px 24px',
            fontFamily: SS.sans,
            fontSize: 17,
            fontWeight: 900,
            letterSpacing: -0.2,
            boxShadow: `0 4px 0 ${SS.greenDark}`,
            cursor: 'pointer',
          }}
        >
          Let&rsquo;s go →
        </button>
      </div>
    </div>
  );
}
