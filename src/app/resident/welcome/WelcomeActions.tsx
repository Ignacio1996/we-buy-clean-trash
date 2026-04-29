'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPresignupScan } from '@/lib/presignup/scan-storage';
import { IconArrow } from '@/components/icons/EcoIcons';

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
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#2D5A3D] px-5 py-3 text-[14px] font-semibold tracking-[0.3px] text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'One sec…' : "Let's go"}
      {!busy && <IconArrow size={14} color="#FBF7EE" />}
    </button>
  );
}
