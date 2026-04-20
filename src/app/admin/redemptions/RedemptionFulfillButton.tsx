'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RedemptionFulfillButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const code = window.prompt(
      'Optional fulfillment reference (e.g. gift card code or note). Leave blank to mark fulfilled without one.',
      '',
    );
    if (code === null) return; // cancelled
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/redemptions/${id}/fulfill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fulfillmentCode: code.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg bg-green-500 px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
      >
        {busy ? '…' : 'Mark fulfilled'}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
