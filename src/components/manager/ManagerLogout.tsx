'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/lib/auth/client';
import { SSMgLogoutButton } from './SSMg';

export function ManagerLogout() {
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

  return <SSMgLogoutButton onClick={handle} busy={busy} />;
}
