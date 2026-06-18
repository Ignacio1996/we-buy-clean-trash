'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Closes every open cleaning ticket for a site (cleaning is done per-site). */
export function MarkCleanedButton({
  commercialAccountId,
  count,
}: {
  commercialAccountId: string;
  count: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/compost/cleaning', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commercialAccountId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'resolve_failed');
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={resolve}
        disabled={busy}
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {busy ? 'Saving…' : `✓ Mark cleaned${count > 1 ? ` (${count})` : ''}`}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
