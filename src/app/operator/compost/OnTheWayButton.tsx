'use client';

import { useState } from 'react';
import { SSOP } from '@/components/operator/SSOp';

export interface DestinationChoice {
  id: string;
  name: string;
}

/**
 * Tap-triggered "heading to drop-off" action. After the last pickup the operator
 * picks the destination; the server texts the program manager (and the facility
 * if it opted in). No GPS — matches Tia's manual "I text JD" flow today.
 */
export function OnTheWayButton({ destinations }: { destinations: DestinationChoice[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (destinations.length === 0) return null;

  async function send(destinationId: string, destinationName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/compost/on-the-way', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ destinationId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        notifiedManagers?: number;
        notifiedDestination?: boolean;
      };
      if (!res.ok) throw new Error(json.error ?? 'send_failed');
      setSentFor(destinationName);
      const bits: string[] = [];
      bits.push(
        `${json.notifiedManagers ?? 0} manager${json.notifiedManagers === 1 ? '' : 's'} notified`,
      );
      bits.push(json.notifiedDestination ? `${destinationName} texted` : `${destinationName} not texted`);
      setSummary(bits.join(' · '));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: '#fff', padding: '8px 20px 28px' }}>
      {sentFor ? (
        <div
          style={{
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 14,
            background: SSOP.mint,
            padding: '14px 16px',
            boxShadow: `0 3px 0 ${SSOP.ink}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>
            ✓ On the way to {sentFor}
          </div>
          {summary && (
            <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 2 }}>
              {summary}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSentFor(null);
              setSummary(null);
            }}
            style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 800,
              color: SSOP.inkSoft,
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Send another
          </button>
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 14,
            background: SSOP.yellow,
            padding: '16px',
            fontSize: 15,
            fontWeight: 900,
            color: SSOP.ink,
            boxShadow: `0 3px 0 ${SSOP.ink}`,
            cursor: 'pointer',
          }}
        >
          🚚 Done — heading to drop-off
        </button>
      ) : (
        <div
          style={{
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 14,
            background: '#fff',
            padding: '14px 16px',
            boxShadow: `0 3px 0 ${SSOP.ink}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: SSOP.ink, textTransform: 'uppercase', letterSpacing: 1 }}>
            Where are you dropping off?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {destinations.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={busy}
                onClick={() => send(d.id, d.name)}
                style={{
                  border: `2px solid ${SSOP.ink}`,
                  borderRadius: 12,
                  background: busy ? '#eee' : SSOP.sky,
                  padding: '12px 14px',
                  fontSize: 14,
                  fontWeight: 900,
                  color: SSOP.ink,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            style={{
              marginTop: 10,
              fontSize: 11,
              fontWeight: 800,
              color: SSOP.inkSoft,
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>
          Couldn&apos;t send: {error}
        </div>
      )}
    </div>
  );
}
