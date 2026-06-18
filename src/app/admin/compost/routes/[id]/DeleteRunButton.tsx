'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Deletes a run + its pickups (test-data cleanup). Manager-confirmed, then redirects to the list. */
export function DeleteRunButton({ routeId, stops }: { routeId: string; stops: number }) {
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
    router.push('/admin/compost/routes');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded border border-red-500/30 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete run'}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
