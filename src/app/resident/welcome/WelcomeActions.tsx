'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPresignupScan } from '@/lib/presignup/scan-storage';
import { SS, SSPillButton } from '@/components/resident/ss/SS';

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
    <>
      <SSPillButton onClick={dismiss} disabled={busy} variant="primary">
        {busy ? 'One sec…' : 'Get started'}
      </SSPillButton>
      <div
        style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: SS.inkSoft,
          marginTop: 16,
        }}
      >
        Have an account?{' '}
        <span style={{ color: SS.ink, textDecoration: 'underline', fontWeight: 900 }}>
          Sign in
        </span>
      </div>
    </>
  );
}
