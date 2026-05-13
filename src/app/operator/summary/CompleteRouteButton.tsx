'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SSOP, SSOpError, SSOpPillButton } from '@/components/operator/SSOp';

export function CompleteRouteButton({
  routeId,
  hasPickups,
}: {
  routeId: string;
  hasPickups: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    const confirmText = hasPickups
      ? 'Close this route? You won’t be able to edit stops after this.'
      : 'Close this route?';
    if (!confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/complete`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'complete_failed');
      }
      router.replace('/operator');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'complete_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SSOpPillButton
        variant="brand"
        size="lg"
        onClick={handle}
        disabled={busy}
        leftIcon={<span>✓</span>}
      >
        {busy ? 'Closing…' : 'Close route & clock out'}
      </SSOpPillButton>
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: SSOP.inkSoft,
          marginTop: 12,
          fontStyle: 'italic',
        }}
      >
        You can&rsquo;t reopen a closed route. Make sure the truck is empty.
      </div>
      {error && <SSOpError>{error}</SSOpError>}
    </>
  );
}
