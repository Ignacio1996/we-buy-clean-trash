'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OP_TOK, OpPrimaryButton } from '@/components/operator/Op';
import { IconCheck } from '@/components/icons/EcoIcons';

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
    <div className="mt-7">
      <OpPrimaryButton onClick={handle} disabled={busy}>
        <IconCheck size={18} color={OP_TOK.paper} stroke={2} />
        {busy ? 'Closing…' : 'Close route & clock out'}
      </OpPrimaryButton>
      <p
        className="mt-2.5 text-center italic"
        style={{
          fontFamily: OP_TOK.serif,
          fontSize: 11,
          color: OP_TOK.inkFaint,
        }}
      >
        You can’t reopen a closed route. Make sure the truck is empty.
      </p>
      {error && (
        <p
          className="mt-3"
          style={{
            background: OP_TOK.rustSoft,
            border: `1px solid ${OP_TOK.rust}`,
            color: OP_TOK.rust,
            borderRadius: 10,
            padding: '8px 12px',
            fontFamily: OP_TOK.serif,
            fontSize: 12,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
