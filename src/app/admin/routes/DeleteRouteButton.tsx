'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'draft' | 'assigned' | 'in_progress' | 'completed';

export function DeleteRouteButton({ routeId, status }: { routeId: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const warning =
      status === 'completed'
        ? 'Delete this completed route? Allowed only if it has no completed pickups or delivered orders.'
        : status === 'in_progress'
          ? 'This route is in progress. Pending pickups and queued bag orders will be released; finished work blocks deletion. Continue?'
          : 'Delete this route? Linked pending pickups and queued bag orders will be released so the next build can pick them up.';
    if (!window.confirm(warning)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/routes/${routeId}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'delete_failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete_failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={handleDelete}
        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-30"
      >
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-[10px] text-red-400">{friendly(error)}</span>}
    </div>
  );
}

function friendly(code: string): string {
  switch (code) {
    case 'route_has_finished_work':
      return 'Has finished pickups/deliveries';
    case 'route_not_found':
      return 'Already gone';
    case 'forbidden':
      return 'Admin only';
    default:
      return code;
  }
}
