'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export function InviteRowActions({
  token,
  canRevoke,
  canEmail,
  canSms,
}: {
  token: string;
  canRevoke: boolean;
  canEmail: boolean;
  canSms: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [emailState, setEmailState] = useState<SendState>('idle');
  const [smsState, setSmsState] = useState<SendState>('idle');

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

  async function handleSms() {
    setSmsState('sending');
    try {
      const res = await fetch(`/api/invites/${token}/send-sms`, { method: 'POST' });
      setSmsState(res.ok ? 'sent' : 'error');
    } catch {
      setSmsState('error');
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

  function sendLabel(state: SendState, baseLabel: string): string {
    if (state === 'sending') return 'Sending…';
    if (state === 'sent') return 'Sent ✓';
    if (state === 'error') return 'Failed — retry';
    return baseLabel;
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
          {sendLabel(emailState, 'Email link')}
        </button>
      )}
      {canSms && (
        <button
          type="button"
          onClick={handleSms}
          disabled={smsState === 'sending' || smsState === 'sent'}
          className={`rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${
            smsState === 'error'
              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
              : 'border-white/15 text-gray-300 hover:bg-white/10'
          }`}
        >
          {sendLabel(smsState, 'SMS link')}
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
