'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isMaterialId,
  type MaterialId,
  type MeasurementMode,
  type PayoutMode,
} from '@/lib/types/material';

export interface MaterialRow {
  id: MaterialId;
  name: string;
  marketPrice: number;
  customerPct: number;
  active: boolean;
  displayOrder: number;
  /** True for the canonical 7 — these can be hidden but not removed from history. */
  isSeed: boolean;
  payoutMode: PayoutMode;
  measurementMode: MeasurementMode;
}

interface DraftRow {
  id: MaterialId;
  name: string;
  marketPrice: string;
  customerPct: string;
  active: boolean;
  displayOrder: number;
  isSeed: boolean;
  isNew: boolean;
  payoutMode: PayoutMode;
  measurementMode: MeasurementMode;
}

function toDraft(row: MaterialRow): DraftRow {
  return {
    id: row.id,
    name: row.name,
    marketPrice: row.marketPrice.toFixed(2),
    customerPct: (row.customerPct * 100).toFixed(0),
    active: row.active,
    displayOrder: row.displayOrder,
    isSeed: row.isSeed,
    isNew: false,
    payoutMode: row.payoutMode,
    measurementMode: row.measurementMode,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function PricingForm({ initialRows }: { initialRows: MaterialRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>(() => initialRows.map(toDraft));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'saved' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-material composer state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('0.00');
  const [newPct, setNewPct] = useState('30');
  const [newPayoutMode, setNewPayoutMode] = useState<PayoutMode>('cash');
  const [newMeasurementMode, setNewMeasurementMode] = useState<MeasurementMode>('bag_weight');

  const ids = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  function update(id: MaterialId, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addMaterial() {
    setError(null);
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const id = slugify(trimmedName);
    if (!isMaterialId(id)) {
      setError('Name must produce a valid id (letters, numbers, underscores, 2–40 chars).');
      return;
    }
    if (ids.has(id)) {
      setError(`A material with id "${id}" already exists.`);
      return;
    }
    // Diversion-only materials never pay points; force pricing to zero so the
    // yellow sheet display stays honest and accidental data entry can't pay out.
    const isDiversion = newPayoutMode === 'diversion_only';
    const market = isDiversion ? 0 : Number(newPrice);
    const pct = isDiversion ? 0 : Number(newPct) / 100;
    if (!Number.isFinite(market) || market < 0) {
      setError('Market price must be a positive number.');
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
      setError('Customer payout % must be 0–100.');
      return;
    }
    const nextOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), -1) + 1;
    setRows((prev) => [
      ...prev,
      {
        id,
        name: trimmedName,
        marketPrice: market.toFixed(2),
        customerPct: (pct * 100).toFixed(0),
        active: true,
        displayOrder: nextOrder,
        isSeed: false,
        isNew: true,
        payoutMode: newPayoutMode,
        measurementMode: newMeasurementMode,
      },
    ]);
    setNewName('');
    setNewPrice('0.00');
    setNewPct('30');
    setNewPayoutMode('cash');
    setNewMeasurementMode('bag_weight');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const payload: Record<
      string,
      {
        marketPrice: number;
        customerPct: number;
        active: boolean;
        name?: string;
        payoutMode?: PayoutMode;
        measurementMode?: MeasurementMode;
      }
    > = {};
    for (const r of rows) {
      const isDiversion = r.payoutMode === 'diversion_only';
      const market = isDiversion ? 0 : Number(r.marketPrice);
      const pct = isDiversion ? 0 : Number(r.customerPct) / 100;
      if (!Number.isFinite(market) || market < 0) {
        setBusy(false);
        setError(`${r.name}: invalid market price`);
        return;
      }
      if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
        setBusy(false);
        setError(`${r.name}: payout % must be 0–100`);
        return;
      }
      payload[r.id] = {
        marketPrice: market,
        customerPct: pct,
        active: r.active,
        ...(r.isNew
          ? {
              name: r.name,
              payoutMode: r.payoutMode,
              measurementMode: r.measurementMode,
            }
          : {}),
      };
    }

    const res = await fetch('/api/admin/materials', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ materials: payload }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(typeof json.error === 'string' ? json.error : 'Save failed.');
      return;
    }
    setResult('saved');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Material</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Market $/lb</th>
              <th className="px-4 py-3 font-medium">Customer payout %</th>
              <th className="px-4 py-3 font-medium">Resident $/lb</th>
              <th className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => {
              const market = Number(r.marketPrice);
              const pct = Number(r.customerPct) / 100;
              const resident =
                Number.isFinite(market) && Number.isFinite(pct) ? market * pct : 0;
              const isDiversion = r.payoutMode === 'diversion_only';
              return (
                <tr key={r.id} className={r.active ? '' : 'opacity-60'}>
                  <td className="px-4 py-2 text-white">
                    <div>{r.name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">
                      {r.id}
                      {r.isNew && (
                        <span className="ml-2 rounded bg-green-500/20 px-1 text-green-300">
                          new
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`inline-flex w-max items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isDiversion
                            ? 'bg-blue-500/20 text-blue-200'
                            : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {isDiversion ? 'Diversion' : 'Cash'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {r.measurementMode === 'bin_fullness' ? 'bin fullness' : 'bag weight'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {isDiversion ? (
                      <span className="text-xs text-gray-500">—</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">$</span>
                        <input
                          required
                          inputMode="decimal"
                          value={r.marketPrice}
                          onChange={(e) => update(r.id, { marketPrice: e.target.value })}
                          className="w-24 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isDiversion ? (
                      <span className="text-xs text-gray-500">—</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          required
                          inputMode="decimal"
                          value={r.customerPct}
                          onChange={(e) => update(r.id, { customerPct: e.target.value })}
                          className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {isDiversion ? '—' : `$${resident.toFixed(3)}`}
                  </td>
                  <td className="px-4 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-gray-300">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => update(r.id, { active: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-black/40 text-green-500"
                      />
                      {r.active ? 'on' : 'hidden'}
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
          <label className="block text-xs">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              New material name
            </span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Compost, Textile, Electronics"
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Mode</span>
            <select
              value={newPayoutMode}
              onChange={(e) => setNewPayoutMode(e.target.value as PayoutMode)}
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="cash">Cash (pays points)</option>
              <option value="diversion_only">Diversion-only (no points)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Measurement</span>
            <select
              value={newMeasurementMode}
              onChange={(e) => setNewMeasurementMode(e.target.value as MeasurementMode)}
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="bag_weight">Bag weight (lbs at scale)</option>
              <option value="bin_fullness">Bin fullness (compost flow)</option>
            </select>
          </label>
        </div>
        {newPayoutMode === 'cash' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[140px_140px_auto]">
            <label className="block text-xs">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">$/lb</span>
              <input
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[11px] uppercase tracking-wide text-gray-500">Payout %</span>
              <input
                inputMode="decimal"
                value={newPct}
                onChange={(e) => setNewPct(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addMaterial}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
              >
                + Add to yellow sheet
              </button>
            </div>
          </div>
        )}
        {newPayoutMode === 'diversion_only' && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={addMaterial}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              + Add diversion-only material
            </button>
            <span className="text-[11px] text-gray-500">
              Weight is recorded for landfill-diversion reports; no points paid.
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save pricing'}
        </button>
        {result === 'saved' && (
          <span className="text-xs text-green-400">Saved · priceHistory snapshot written.</span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </form>
  );
}
