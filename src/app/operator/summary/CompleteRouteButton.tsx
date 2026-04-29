'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="mt-6">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Closing…' : hasPickups ? 'Deliver to depot →' : 'Close route →'}
      </button>
      {error && (
        <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
