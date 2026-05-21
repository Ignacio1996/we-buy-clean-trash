'use client';

import { useEffect, useState } from 'react';

interface Delivery {
  channel: 'email' | 'sms';
  ok: boolean;
  error?: string;
}

const ERROR_LABEL: Record<string, string> = {
  email_or_phone_required: 'Add an email or a phone number.',
  invalid_phone: 'That phone number doesn’t look right.',
  forbidden: 'You don’t have permission to send invites.',
};

export function ResidentInviteCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setError(null);
    setDeliveries(null);
    setEmail('');
    setPhone('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError(ERROR_LABEL.email_or_phone_required);
      return;
    }
    setBusy(true);
    setError(null);
    setDeliveries(null);
    try {
      const res = await fetch('/api/resident-invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = typeof json.error === 'string' ? json.error : '';
        setError(ERROR_LABEL[code] ?? 'Couldn’t send the invite.');
      } else {
        setDeliveries(json.deliveries ?? []);
        setEmail('');
        setPhone('');
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10"
      >
        <span aria-hidden>＋</span> Invite a resident
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resident-invite-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="resident-invite-title"
                  className="text-base font-semibold text-white"
                >
                  Invite a resident
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Sends a signup link by email, SMS, or both.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
                  placeholder="person@example.com"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">
                  Phone
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
                  placeholder="(555) 123-4567"
                />
              </label>

              {error && <p className="text-xs text-red-400">{error}</p>}

              {deliveries && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-xs">
                  <div className="text-green-400">Invite sent.</div>
                  {deliveries.map((d) => (
                    <div
                      key={d.channel}
                      className={`mt-1 ${d.ok ? 'text-green-300' : 'text-red-400'}`}
                    >
                      {d.channel === 'email' ? 'Email' : 'SMS'}:{' '}
                      {d.ok ? 'queued ✓' : `failed — ${d.error ?? 'unknown error'}`}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
