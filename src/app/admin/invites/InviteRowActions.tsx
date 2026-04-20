'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteRowActions({ token, canRevoke }: { token: string; canRevoke: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy invite URL:', url);
    }
  }

  async function handleRevoke() {
    if (!confirm('Revoke this invite?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10"
      >
        Copy link
      </button>
      {canRevoke && (
        <button
          type="button"
          onClick={handleRevoke}
          disabled={busy}
          className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {busy ? '…' : 'Revoke'}
        </button>
      )}
    </div>
  );
}
