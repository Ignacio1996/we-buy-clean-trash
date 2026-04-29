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
        <div
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 16,
            color: '#1F2A22',
          }}
        >
          {current ?? (
            <span className="italic" style={{ color: '#8A8A7A' }}>
              — (none)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? '');
            setEditing(true);
            setError(null);
          }}
          className="text-[12px] text-[#2D5A3D] underline"
        >
          {current ? 'Edit' : 'Add'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="555-123-4567"
        className="w-full rounded-[10px] border border-[#D9D2C2] bg-[#FBF7EE] px-3 py-2 text-[14px] text-[#1F2A22] placeholder:text-[#8A8A7A] focus:border-[#2D5A3D] focus:outline-none"
      />
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#2D5A3D] px-4 py-1.5 text-[12px] font-semibold text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:cursor-not-allowed disabled:opacity-50"
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
          className="text-[12px] text-[#5A6358] underline"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-[12px]" style={{ color: '#9A4B26' }}>
          {error}
        </p>
      )}
    </div>
  );
}
