'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth/client';
import { SS } from '@/components/resident/ss/SS';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      await logout();
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      style={{
        width: '100%',
        background: '#fff',
        color: SS.brand,
        border: `2px solid ${SS.brand}`,
        borderRadius: 999,
        padding: '14px 20px',
        fontFamily: SS.sans,
        fontSize: 16,
        fontWeight: 900,
        letterSpacing: -0.2,
        boxShadow: `0 3px 0 ${SS.brand}`,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
