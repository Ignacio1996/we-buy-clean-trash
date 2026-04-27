'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MaterialId } from '@/lib/types/material';

export interface CampaignRow {
  id: string;
  name: string;
  materialIds: MaterialId[];
  multiplier: number;
  startsAt: string;
  endsAt: string;
  /** Has the window already started? Server passes this in based on Date.now(). */
  isLive: boolean;
}

export interface CampaignMaterialOption {
  id: MaterialId;
  name: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayLocalISODate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d.toISOString().slice(0, 10);
}

export function CampaignsManager({
  campaigns,
  materialOptions,
}: {
  campaigns: CampaignRow[];
  materialOptions: CampaignMaterialOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [multiplier, setMultiplier] = useState('2');
  const [selectedIds, setSelectedIds] = useState<MaterialId[]>([]);
  const [startsAt, setStartsAt] = useState<string>(todayLocalISODate());
  const [endsAt, setEndsAt] = useState<string>(plusDaysISO(7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materialNameById = useMemo(
    () => new Map(materialOptions.map((m) => [m.id, m.name])),
    [materialOptions],
  );

  function toggle(id: MaterialId) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError('Give the campaign a name (e.g. "Aluminum 2× week").');
      return;
    }
    const m = Number(multiplier);
    if (!Number.isFinite(m) || m <= 0) {
      setError('Multiplier must be greater than 0.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Pick at least one material.');
      return;
    }
    if (!startsAt || !endsAt) {
      setError('Pick a start and end date.');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('End date must be after start.');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/admin/pricing-campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        materialIds: selectedIds,
        multiplier: m,
        startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Create failed.');
      return;
    }
    setName('');
    setMultiplier('2');
    setSelectedIds([]);
    setStartsAt(todayLocalISODate());
    setEndsAt(plusDaysISO(7));
    router.refresh();
  }

  async function endNow(id: string) {
    if (!confirm('End this campaign now?')) return;
    setBusy(true);
    const res = await fetch(`/api/admin/pricing-campaigns?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'End failed.');
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
      <header>
        <h2 className="text-sm font-semibold text-white">Pricing campaigns</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Time-bounded multipliers for selected materials (e.g. &ldquo;Aluminum 2× this week&rdquo;).
          Apply globally to every resident&rsquo;s pickup.
        </p>
      </header>

      <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-white/15 bg-black/20 p-4 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Campaign name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aluminum 2× week"
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Multiplier</span>
          <input
            inputMode="decimal"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Starts</span>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Ends</span>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
        <div className="sm:col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Materials ({selectedIds.length}/{materialOptions.length})
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {materialOptions.map((m) => {
              const on = selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    on
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                      : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Start campaign'}
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">
          Active &amp; upcoming
        </div>
        {campaigns.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">No campaigns scheduled.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/5">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">
                    {c.name}{' '}
                    <span className="text-amber-300">×{c.multiplier}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)} ·{' '}
                    {c.materialIds
                      .map((id) => materialNameById.get(id) ?? id)
                      .join(', ')}
                  </div>
                </div>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    c.isLive
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                      : 'border-white/10 bg-white/5 text-gray-400'
                  }`}
                >
                  {c.isLive ? 'Live' : 'Scheduled'}
                </span>
                <button
                  type="button"
                  onClick={() => endNow(c.id)}
                  disabled={busy}
                  className="rounded border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  End now
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
