'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateSheetButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/qr-sheet', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        stickerSheetId?: string;
      };
      if (!res.ok || !body.stickerSheetId) {
        throw new Error(body.error ?? 'generate_failed');
      }
      router.push(`/admin/bags/${body.stickerSheetId}/print`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'generate_failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Generate new sheet'}
      </button>
      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
