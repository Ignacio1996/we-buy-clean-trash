'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SSOP, SSOpEyebrow } from '@/components/operator/SSOp';
import type { CompostRouteSummary } from '@/lib/types/compostRoute';

export interface ActiveRouteView {
  id: string;
  /** Clock label for when the run started, e.g. "2:04 PM". */
  startedLabel: string | null;
  /** Live tally so far on this run. */
  stops: number;
  skipped: number;
  totalWeightLbs: number;
}

function btn(bg: string, fg: string): React.CSSProperties {
  return {
    width: '100%',
    background: bg,
    color: fg,
    border: `2px solid ${SSOP.ink}`,
    borderRadius: 999,
    padding: '16px 20px',
    fontFamily: SSOP.sans,
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: -0.3,
    boxShadow: `0 4px 0 ${SSOP.ink}`,
    cursor: 'pointer',
  };
}

/**
 * Start Route / End Route control for the compost run (D1.3). Lives at the top
 * of the operator compost page. Pickups recorded while a run is open attach to
 * it automatically (server-side); ending freezes the run summary.
 */
export function CompostRouteControl({ active }: { active: ActiveRouteView | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CompostRouteSummary | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/compost-routes', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'start_failed');
      setDone(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start_failed');
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/compost-routes/${active.id}/end`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        summary?: CompostRouteSummary;
      };
      if (!res.ok) throw new Error(json.error ?? 'end_failed');
      setDone(json.summary ?? null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'end_failed');
    } finally {
      setBusy(false);
    }
  }

  // Run-complete summary, shown right after ending until the operator starts a new run.
  if (done) {
    return (
      <div
        style={{
          background: SSOP.mint,
          border: `2px solid ${SSOP.ink}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: `0 4px 0 ${SSOP.ink}`,
        }}
      >
        <SSOpEyebrow mb={6}>Run complete ✓</SSOpEyebrow>
        <div style={{ fontSize: 15, fontWeight: 900, color: SSOP.ink, lineHeight: 1.35 }}>
          {done.stops} stop{done.stops === 1 ? '' : 's'}
          {done.skipped > 0 ? ` · ${done.skipped} skipped` : ''} · {done.cartsSwapped} cart
          {done.cartsSwapped === 1 ? '' : 's'} swapped · {done.totalWeightLbs.toLocaleString()} lbs
          {done.damaged > 0 ? ` · ${done.damaged} damaged` : ''}
          {done.needsCleaning > 0 ? ` · ${done.needsCleaning} to clean` : ''}
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={start} disabled={busy} style={btn('#fff', SSOP.ink)}>
            {busy ? 'Starting…' : 'Start a new run'}
          </button>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    );
  }

  if (active) {
    return (
      <div
        style={{
          background: SSOP.mint,
          border: `2px solid ${SSOP.ink}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: `0 4px 0 ${SSOP.ink}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <SSOpEyebrow mb={0}>Run in progress</SSOpEyebrow>
          {active.startedLabel && (
            <span style={{ fontSize: 11, fontWeight: 900, color: SSOP.inkSoft }}>
              Started {active.startedLabel}
            </span>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, color: SSOP.ink }}>
          {active.stops} stop{active.stops === 1 ? '' : 's'}
          {active.skipped > 0 ? ` · ${active.skipped} skipped` : ''} ·{' '}
          {active.totalWeightLbs.toLocaleString()} lbs so far
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={end} disabled={busy} style={btn(SSOP.brand, '#fff')}>
            {busy ? 'Ending…' : 'End run'}
          </button>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={busy} style={btn(SSOP.green, '#fff')}>
        {busy ? 'Starting…' : '▶ Start run'}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 10,
        fontSize: 12,
        fontWeight: 800,
        color: SSOP.brand,
      }}
    >
      {children}
    </p>
  );
}
