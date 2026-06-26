'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';

interface ZoneOption {
  id: string;
  name: string;
}

const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

interface OptimizeResult {
  dayLabel: string;
  ordered: { id: string; name: string; order: number }[];
  skipped: { id: string; name: string }[];
  mocked: boolean;
  count: number;
}

/**
 * Trigger + modal for the compost route optimizer. Pick the day Tia drives and a
 * start/finish address; the optimizer sequences that day's sites by drive time
 * and writes each one's route order — which is what the operator's "On today"
 * list sorts by. Rendered as an overlay so opening it doesn't reflow the page.
 */
export function CompostRouteOptimizer({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<number>(1);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  // Esc to close — matches the rest of the admin modals.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        setOpen(false);
        setError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  async function run() {
    if (!startAddress.trim()) {
      setError('Enter a start address.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch('/api/compost-route-optimize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        day,
        startAddress: startAddress.trim(),
        endAddress: endAddress.trim() || undefined,
        zoneId: zoneId || undefined,
      }),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(friendlyError(typeof json.error === 'string' ? json.error : 'optimize_failed'));
      return;
    }
    setResult({
      dayLabel: json.dayLabel ?? COLLECTION_DAY_LABELS[day],
      ordered: Array.isArray(json.ordered) ? json.ordered : [],
      skipped: Array.isArray(json.skipped) ? json.skipped : [],
      mocked: Boolean(json.mocked),
      count: typeof json.count === 'number' ? json.count : 0,
    });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
      >
        <span aria-hidden>🛻</span> Optimize route order
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="optimize-route-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) close();
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-white/10 px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-lg">
                🛻
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="optimize-route-title" className="text-base font-semibold text-white">
                  Optimize route order
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Sequences a day&apos;s sites by drive time and saves each one&apos;s route order.
                  The driver&apos;s list then shows stops in this order.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Body (scrolls) */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Day to optimize
                  </span>
                  <div className="mt-1.5 grid grid-cols-7 gap-1">
                    {DAY_NUMBERS.map((d) => {
                      const on = day === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDay(d)}
                          className={`rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                            on
                              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100'
                              : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {COLLECTION_DAY_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Start address
                  </span>
                  <input
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    placeholder="Where the route starts (the shop)"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Finish address{' '}
                    <span className="font-normal normal-case text-gray-600">— optional</span>
                  </span>
                  <input
                    value={endAddress}
                    onChange={(e) => setEndAddress(e.target.value)}
                    placeholder="Defaults to the start address"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
                  />
                </label>

                {zones.length > 1 && (
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Zone{' '}
                      <span className="font-normal normal-case text-gray-600">— optional</span>
                    </span>
                    <select
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="">All zones</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-gray-500">
                  Re-running a day overwrites that day&apos;s order. A site that runs on more than
                  one day shares a single order across them.
                </p>

                {result && (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
                    {result.count === 0 ? (
                      <p className="text-gray-400">
                        No active sites scheduled on {result.dayLabel}. Nothing to order.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] text-emerald-300">
                            ✓
                          </span>
                          <p className="font-semibold text-emerald-300">
                            Ordered {result.count} stop{result.count === 1 ? '' : 's'} for{' '}
                            {result.dayLabel}
                            {result.mocked ? ' · mock ordering (no Maps key)' : ''}
                          </p>
                        </div>
                        <ol className="mt-3 space-y-1">
                          {result.ordered.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2.5 text-gray-300">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-gray-400">
                                {i + 1}
                              </span>
                              {s.name}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    {result.skipped.length > 0 && (
                      <p className="mt-3 border-t border-white/10 pt-2 text-amber-300">
                        Couldn&apos;t locate {result.skipped.length} site
                        {result.skipped.length === 1 ? '' : 's'} (no address match):{' '}
                        {result.skipped.map((s) => s.name).join(', ')}. Left in place.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              {error ? (
                <span className="text-xs text-red-400">{error}</span>
              ) : (
                <span className="text-[11px] text-gray-600">
                  {result ? 'Run again to re-sequence.' : 'Sites are ordered by drive time.'}
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  {result ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={busy}
                  className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? 'Optimizing…' : result ? 'Re-optimize' : 'Optimize'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'missing_start_address':
      return 'Enter a start address.';
    case 'start_geocode_failed':
      return 'Couldn’t locate the start address. Check the spelling.';
    case 'end_geocode_failed':
      return 'Couldn’t locate the finish address. Check the spelling.';
    case 'invalid_day':
      return 'Pick a valid day.';
    case 'forbidden':
      return 'You don’t have permission to do that.';
    default:
      return code;
  }
}
