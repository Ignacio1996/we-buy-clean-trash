'use client';

import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'wbct.signupBonusAcked.';

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
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(31, 42, 34, 0.55)' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6 text-center shadow-xl"
        style={{ background: '#FBF7EE', borderColor: '#D9D2C2' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: '#F2E8D6', color: '#A0682A' }}
        >
          <span style={{ fontFamily: 'var(--eco-serif)', fontSize: 22 }}>+</span>
        </div>
        <div className="eco-eyebrow mt-4">Signup bonus</div>
        <h2
          className="mt-1.5"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: -0.4,
            color: '#1F2A22',
          }}
        >
          You earned <em style={{ fontStyle: 'italic', color: '#2D5A3D' }}>10,000 points</em>.
        </h2>
        <p
          className="mt-3"
          style={{ fontSize: 13, color: '#5A6358', lineHeight: 1.5 }}
        >
          That&rsquo;s worth{' '}
          <span style={{ color: '#1F2A22', fontWeight: 500 }}>$1</span> toward your first
          reward.
        </p>
        <p
          className="mt-2 italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 12,
            color: '#8A8A7A',
            lineHeight: 1.5,
          }}
        >
          Earn 100,000 pts to redeem a $10 gift card. Order bags to start collecting more.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm"
          style={{ background: '#2D5A3D', color: '#FBF7EE', fontWeight: 500 }}
        >
          Let&rsquo;s go
        </button>
      </div>
    </div>
  );
}
