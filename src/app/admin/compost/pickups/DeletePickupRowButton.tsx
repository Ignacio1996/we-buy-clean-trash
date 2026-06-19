'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline delete for a single recorded stop (a bin pickup or a site check).
 * Confirms, hits the matching DELETE endpoint, then refreshes the list. Built
 * for clearing stray/test submissions one at a time.
 */
export function DeletePickupRowButton({
  kind,
  id,
  weightLbs,
}: {
  kind: 'bin' | 'check';
  id: string;
  weightLbs: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const msg =
      kind === 'bin'
        ? weightLbs > 0
          ? `Delete this pickup? This also removes its ${weightLbs.toLocaleString()} lbs from diversion totals. Can't be undone.`
          : `Delete this pickup? Can't be undone.`
        : `Delete this cart check? Can't be undone.`;
    if (!confirm(msg)) return;

    setBusy(true);
    setError(null);
    const endpoint = kind === 'bin' ? `/api/bin-pickups/${id}` : `/api/site-checks/${id}`;
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'delete_failed');
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-[11px] font-semibold text-red-400 underline hover:text-red-300 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
