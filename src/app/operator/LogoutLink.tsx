'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth/client';
import { SSOP } from '@/components/operator/SSOp';

export function LogoutLink() {
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
        background: '#fff',
        border: `2px solid ${SSOP.ink}`,
        color: SSOP.ink,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: SSOP.sans,
        boxShadow: `0 2px 0 ${SSOP.ink}`,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
