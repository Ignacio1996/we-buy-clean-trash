'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth/client';

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
      className="cursor-pointer p-0 italic underline disabled:opacity-50"
      style={{
        background: 'transparent',
        border: 'none',
        fontFamily: 'var(--eco-serif)',
        fontSize: 11,
        color: '#5A6358',
        textDecorationColor: '#D9D2C2',
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
