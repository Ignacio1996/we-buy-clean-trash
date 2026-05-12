'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SS } from '@/components/resident/ss/SS';

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: SS.ink, letterSpacing: -0.3 }}>
          {current ?? (
            <span style={{ color: SS.inkSoft, fontWeight: 800 }}>— (none)</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setValue(current ?? '');
            setEditing(true);
            setError(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: SS.sans,
            fontSize: 12,
            fontWeight: 900,
            color: SS.brand,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {current ? 'Edit' : 'Add'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="555-123-4567"
        style={{
          width: '100%',
          borderRadius: 12,
          border: `2px solid ${SS.ink}`,
          background: '#fff',
          padding: '10px 14px',
          fontFamily: SS.sans,
          fontSize: 16,
          fontWeight: 800,
          color: SS.ink,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          style={{
            borderRadius: 999,
            background: SS.green,
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            fontFamily: SS.sans,
            fontSize: 13,
            fontWeight: 900,
            boxShadow: `0 3px 0 ${SS.greenDark}`,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
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
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: SS.sans,
            fontSize: 13,
            fontWeight: 800,
            color: SS.inkSoft,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: SS.brand }}>{error}</p>
      )}
    </div>
  );
}
