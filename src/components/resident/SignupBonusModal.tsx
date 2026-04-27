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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-green-500/30 bg-[#0b1d12] p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">🎉</div>
        <h2 className="mt-3 text-lg font-semibold text-white">You earned 10,000 points</h2>
        <p className="mt-2 text-sm text-gray-300">
          That&rsquo;s your signup bonus — worth <span className="font-semibold text-white">$1</span>{' '}
          toward your first reward.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Earn 100,000 pts to redeem a $10 gift card. Order bags to start collecting more.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black"
        >
          Let&rsquo;s go
        </button>
      </div>
    </div>
  );
}
