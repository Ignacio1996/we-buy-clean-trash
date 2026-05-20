'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EmailState = 'idle' | 'sending' | 'sent' | 'error';

export function InviteRowActions({
  token,
  canRevoke,
  canEmail,
}: {
  token: string;
  canRevoke: boolean;
  canEmail: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [emailState, setEmailState] = useState<EmailState>('idle');

  async function handleCopy() {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy invite URL:', url);
    }
  }

  async function handleEmail() {
    setEmailState('sending');
    try {
      const res = await fetch(`/api/invites/${token}/send-email`, { method: 'POST' });
      setEmailState(res.ok ? 'sent' : 'error');
    } catch {
      setEmailState('error');
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

  const emailLabel =
    emailState === 'sending'
      ? 'Sending…'
      : emailState === 'sent'
        ? 'Sent ✓'
        : emailState === 'error'
          ? 'Failed — retry'
          : 'Email link';

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10"
      >
        Copy link
      </button>
      {canEmail && (
        <button
          type="button"
          onClick={handleEmail}
          disabled={emailState === 'sending' || emailState === 'sent'}
          className={`rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${
            emailState === 'error'
              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
              : 'border-white/15 text-gray-300 hover:bg-white/10'
          }`}
        >
          {emailLabel}
        </button>
      )}
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
