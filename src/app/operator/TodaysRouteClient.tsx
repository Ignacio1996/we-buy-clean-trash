'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PickupIssue } from '@/lib/types/pickup';
import type { RouteView, StopView } from './page';

export function TodaysRouteClient({
  route,
  operatorLabel,
}: {
  route: RouteView;
  operatorLabel: string;
}) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const openStops = route.stops.filter((s) => !s.allDone);
  const visibleStops = openStops.filter((s) => !skipped.has(s.addressId));

  // "Current" = first non-skipped open stop. If none, all skipped — show the
  // first skipped stop again instead of a dead state.
  const currentStop = visibleStops[0] ?? openStops[0] ?? null;
  const nextStops = useMemo(() => {
    if (!currentStop) return [] as StopView[];
    const after = openStops.filter((s) => s.addressId !== currentStop.addressId).slice(0, 2);
    return after;
  }, [currentStop, openStops]);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json.error === 'string' ? json.error : 'request_failed');
    }
    return res;
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/routes/${route.id}/start`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start_failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleNotOut(stop: StopView) {
    if (!confirm(`Mark all ${pendingCount(stop)} bag(s) at ${stop.street} as not out?`)) return;
    await batchPost(stop, (pickupId) => post(`/api/pickups/${pickupId}/not-out`), 'not_out_failed');
  }

  async function handleIssue(stop: StopView, issue: PickupIssue, note: string) {
    await batchPost(
      stop,
      (pickupId) => post(`/api/pickups/${pickupId}/issue`, { issue, note }),
      'issue_failed',
    );
    setIssueOpen(false);
  }

  async function handleNotify(stop: StopView) {
    const first = stop.pickups.find((p) => p.status === 'pending');
    if (!first) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post(`/api/pickups/${first.id}/notify-on-way`);
      const json = await res.json().catch(() => ({}));
      if (json?.phoneKnown === false) {
        setError('Heads up: this resident has no phone on file — logged to smsLog only.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'notify_failed');
    } finally {
      setBusy(false);
    }
  }

  async function batchPost(
    stop: StopView,
    fn: (pickupId: string) => Promise<unknown>,
    errLabel: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const pending = stop.pickups.filter((p) => p.status === 'pending').map((p) => p.id);
      await Promise.all(pending.map(fn));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : errLabel);
    } finally {
      setBusy(false);
    }
  }

  const routeFinished = route.stats.stopsDone === route.stats.stopsTotal && route.stats.deliveriesPending === 0;

  return (
    <>
      {(() => {
        const showStops = route.stats.stopsTotal > 0;
        const showBags = route.stats.bagsTotal > 0;
        const showDeliver = route.stats.deliveriesTotal > 0;
        const visible = [showStops, showBags, showDeliver].filter(Boolean).length;
        if (visible === 0) return null;
        const cols = visible === 1 ? 'grid-cols-1' : visible === 2 ? 'grid-cols-2' : 'grid-cols-3';
        return (
          <section className={`mt-4 grid ${cols} gap-2`}>
            {showStops && (
              <Stat label="Stops" value={`${route.stats.stopsDone}/${route.stats.stopsTotal}`} />
            )}
            {showBags && (
              <Stat label="Bags" value={`${route.stats.bagsDone}/${route.stats.bagsTotal}`} />
            )}
            {showDeliver && (
              <Stat
                label="Deliver"
                value={`${route.stats.deliveriesDone}/${route.stats.deliveriesTotal}`}
              />
            )}
          </section>
        );
      })()}

      {route.status === 'assigned' && (
        <section className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
          <div className="font-semibold text-white">Ready to roll?</div>
          <p className="mt-1 text-xs text-blue-200/80">
            Tap <strong>Start route</strong> to begin. You can’t complete stops until the route is
            started.
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? 'Starting…' : '▶ Start route'}
          </button>
        </section>
      )}

      {route.status === 'in_progress' && currentStop && (
        <section className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Current stop</div>
          <div className="mt-1 font-semibold text-white">{currentStop.street}</div>
          {(currentStop.unitLine || currentStop.cityLine) && (
            <div className="text-xs text-gray-400">
              {[currentStop.unitLine, currentStop.cityLine].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500">{currentStop.residentName}</div>

          {currentStop.pickups.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {currentStop.pickups.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-mono text-white">{p.bagCode}</div>
                    <div className="text-gray-400">
                      {p.declaredType === 'separated'
                        ? '⭐ Separated'
                        : p.declaredType === 'mixed'
                          ? '🔀 Mixed'
                          : '—'}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}

          {currentStop.pickups.some((p) => p.status === 'pending') && (
            <Link
              href={`/operator/stop/${currentStop.pickups.find((p) => p.status === 'pending')!.id}`}
              className="mt-3 block rounded-lg bg-green-500 px-4 py-3 text-center text-sm font-semibold text-black"
            >
              ✓ SCAN &amp; COMPLETE
            </Link>
          )}

          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setSkipped((prev) => new Set(prev).add(currentStop.addressId));
                setError(null);
              }}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-gray-200 disabled:opacity-50"
            >
              ⏭ Skip
            </button>
            <button
              type="button"
              onClick={() => handleNotOut(currentStop)}
              disabled={busy || pendingCount(currentStop) === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-gray-200 disabled:opacity-50"
            >
              📦 Not out
            </button>
            <button
              type="button"
              onClick={() => setIssueOpen(true)}
              disabled={busy || pendingCount(currentStop) === 0}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-[11px] text-red-300 disabled:opacity-50"
            >
              ⚠ Issue
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleNotify(currentStop)}
            disabled={busy || pendingCount(currentStop) === 0}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-gray-200 disabled:opacity-50"
          >
            📲 Text resident: driver on the way
          </button>

          {currentStop.bagOrdersToDeliver.length > 0 && (
            <div className="mt-3 rounded-lg border border-green-500/25 bg-green-500/10 p-3 text-xs">
              <div className="font-semibold text-green-200">📦 Deliver bags + QR stickers</div>
              {currentStop.bagOrdersToDeliver.map((o) => (
                <Link
                  key={o.id}
                  href={`/operator/deliver/${o.id}`}
                  className="mt-2 block rounded-md bg-green-500/20 px-3 py-2 text-green-100 hover:bg-green-500/25"
                >
                  {o.quantity} sheet{o.quantity === 1 ? '' : 's'} (10 bags each) →
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {route.status === 'in_progress' && nextStops.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Next 2 stops</div>
          <ul className="mt-2 space-y-1.5">
            {nextStops.map((s) => (
              <li key={s.addressId} className="text-xs text-gray-300">
                <div className="text-white">{s.street}</div>
                <div className="text-gray-500">
                  {s.pickups.length} bag{s.pickups.length === 1 ? '' : 's'}
                  {s.bagOrdersToDeliver.length > 0 && ' · deliver'}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {route.status === 'in_progress' && routeFinished && (
        <section className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <div className="font-semibold text-green-200">🎉 All stops handled</div>
          <p className="mt-1 text-xs text-green-300/80">
            Head back to the depot, then tap below to close the route.
          </p>
          <Link
            href="/operator/summary"
            className="mt-3 block rounded-lg bg-green-500 px-3 py-2 text-center text-sm font-semibold text-black"
          >
            End-of-route summary →
          </Link>
        </section>
      )}

      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {issueOpen && currentStop && (
        <IssueModal
          stop={currentStop}
          busy={busy}
          onCancel={() => setIssueOpen(false)}
          onSubmit={(issue, note) => handleIssue(currentStop, issue, note)}
        />
      )}

      <footer className="mt-10 text-center text-[10px] text-gray-600">
        Signed in as {operatorLabel}
      </footer>
    </>
  );
}

function pendingCount(stop: StopView): number {
  return stop.pickups.filter((p) => p.status === 'pending').length;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
    completed: 'border-green-500/30 bg-green-500/10 text-green-300',
    missed: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    issue: 'border-red-500/30 bg-red-500/10 text-red-300',
    skipped: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${map[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

function IssueModal({
  stop,
  busy,
  onCancel,
  onSubmit,
}: {
  stop: StopView;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (issue: PickupIssue, note: string) => void;
}) {
  const [issue, setIssue] = useState<PickupIssue>('contaminated');
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-neutral-900 p-4">
        <div className="text-sm font-semibold text-white">Flag an issue</div>
        <div className="mt-0.5 text-xs text-gray-400">
          {stop.street} · {pendingCount(stop)} pending bag(s)
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIssue('contaminated')}
            className={`rounded-lg border px-3 py-2 text-xs ${
              issue === 'contaminated'
                ? 'border-red-500 bg-red-500/15 text-white'
                : 'border-white/15 bg-white/5 text-gray-200'
            }`}
          >
            Contaminated
          </button>
          <button
            type="button"
            onClick={() => setIssue('other')}
            className={`rounded-lg border px-3 py-2 text-xs ${
              issue === 'other'
                ? 'border-white bg-white/10 text-white'
                : 'border-white/15 bg-white/5 text-gray-200'
            }`}
          >
            Other
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What did you see? (optional)"
          className="mt-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(issue, note.trim())}
            disabled={busy}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
          >
            {busy ? 'Flagging…' : 'Flag issue'}
          </button>
        </div>
      </div>
    </div>
  );
}
