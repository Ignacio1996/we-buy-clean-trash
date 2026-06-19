'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline delete for a run in the list — test-data cleanup without opening the
 * run first. Confirms, calls the same DELETE endpoint, then refreshes the list.
 */
export function DeleteRunRowButton({ routeId, stops }: { routeId: string; stops: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !confirm(
        `Delete this run and its ${stops} stop${stops === 1 ? '' : 's'}? This also reverses the weight it added to diversion totals. Can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/compost-routes/${routeId}`, { method: 'DELETE' });
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
