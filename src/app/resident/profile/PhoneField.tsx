'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PhoneField({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(initial);

  async function save() {
    setBusy(true);
    setError(null);
    const body = value.trim() === '' ? { phone: null } : { phone: value.trim() };
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(
        json.error === 'invalid_phone'
          ? 'That phone number doesn’t look right. Try 7–15 digits.'
          : 'Save failed.',
      );
      return;
    }
    setCurrent(value.trim() === '' ? null : value.trim());
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="mt-1 flex items-center justify-between">
        <div className="text-white">{current ?? <span className="text-gray-500">— (none)</span>}</div>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? '');
            setEditing(true);
            setError(null);
          }}
          className="text-xs text-gray-400 underline"
        >
          {current ? 'Edit' : 'Add'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="555-123-4567"
        className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-white px-2 py-1 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? '');
            setEditing(false);
            setError(null);
          }}
          className="text-xs text-gray-400 underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
