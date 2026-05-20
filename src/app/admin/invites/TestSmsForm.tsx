'use client';

import { useState } from 'react';

export function TestSmsForm() {
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/test-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toPhone: phone, body: body || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to send.');
      } else {
        setResult({ mode: json.mode });
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5"
    >
      <h2 className="text-sm font-semibold text-white">Send test SMS</h2>
      <p className="mt-1 text-[11px] text-gray-500">
        Sends via the same <code>sendSMS()</code> the app uses. Trial Twilio accounts only deliver
        to verified numbers. Goes through Twilio when <code>SMS_MODE=twilio</code>, otherwise
        logged to <code>smsLog</code> only.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Phone (E.164)</span>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">
            Message (optional)
          </span>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Default: WBCT test SMS …"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send test SMS'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
        {result && (
          <span className="text-xs text-green-400">
            Submitted (mode: {result.mode}). Check phone + smsLog collection.
          </span>
        )}
      </div>
    </form>
  );
}
