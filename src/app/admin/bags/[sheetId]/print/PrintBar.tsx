'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PrintBar({
  sheetId,
  sheetNumber,
  printedLabel,
}: {
  sheetId: string;
  sheetNumber: string;
  printedLabel: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function printAndMark() {
    setError(null);
    window.print();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/qr-sheet/${sheetId}/printed`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'mark_failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'mark_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 mx-6 mb-4 flex items-center justify-between gap-3 border-b border-gray-300 bg-white/95 py-3 backdrop-blur print:hidden">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Sticker sheet</div>
        <div className="text-sm font-semibold">
          #{sheetNumber}{' '}
          <span className="ml-1 text-xs font-normal text-gray-500">
            {printedLabel ? `· last printed ${printedLabel}` : '· not yet printed'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {error && (
          <span className="rounded border border-red-500/30 bg-red-50 px-2 py-1 text-xs text-red-700">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={printAndMark}
          disabled={busy}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Marking…' : printedLabel ? 'Print again' : 'Print + mark'}
        </button>
        <a
          href="/admin/bags"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100"
        >
          Close
        </a>
      </div>
    </div>
  );
}
