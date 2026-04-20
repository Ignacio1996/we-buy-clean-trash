'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPresignupScan } from '@/lib/presignup/scan-storage';

export function WelcomeActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    setBusy(true);
    try {
      await fetch('/api/onboarding/complete', { method: 'POST' });
      clearPresignupScan();
      router.replace('/resident');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={dismiss}
      disabled={busy}
      className="mt-6 w-full rounded-xl bg-green-500 px-3 py-3 text-sm font-semibold text-black disabled:opacity-50"
    >
      {busy ? 'One sec…' : "Let's go →"}
    </button>
  );
}
