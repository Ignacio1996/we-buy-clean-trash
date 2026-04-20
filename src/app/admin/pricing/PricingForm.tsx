'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MaterialId, MaterialPricing } from '@/lib/types/material';

interface Row {
  id: MaterialId;
  name: string;
}

type FormState = Record<MaterialId, { marketPrice: string; customerPct: string }>;

function toFormState(
  materials: Record<MaterialId, MaterialPricing>,
  rows: Row[],
): FormState {
  const out = {} as FormState;
  rows.forEach((r) => {
    const m = materials[r.id];
    out[r.id] = {
      marketPrice: m.marketPrice.toFixed(2),
      customerPct: (m.customerPct * 100).toFixed(0),
    };
  });
  return out;
}

export function PricingForm({
  materials,
  rows,
}: {
  materials: Record<MaterialId, MaterialPricing>;
  rows: Row[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(materials, rows));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'saved' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const payload: Record<string, MaterialPricing> = {};
    for (const r of rows) {
      const marketPrice = Number(form[r.id].marketPrice);
      const customerPct = Number(form[r.id].customerPct) / 100;
      if (!Number.isFinite(marketPrice) || marketPrice < 0) {
        setBusy(false);
        setError(`${r.name}: invalid market price`);
        return;
      }
      if (!Number.isFinite(customerPct) || customerPct < 0 || customerPct > 1) {
        setBusy(false);
        setError(`${r.name}: payout % must be 0–100`);
        return;
      }
      payload[r.id] = { marketPrice, customerPct };
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
              <th className="px-4 py-3 font-medium">Market $/lb</th>
              <th className="px-4 py-3 font-medium">Customer payout %</th>
              <th className="px-4 py-3 font-medium">Resident $/lb</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => {
              const entry = form[r.id];
              const market = Number(entry.marketPrice);
              const pct = Number(entry.customerPct) / 100;
              const resident =
                Number.isFinite(market) && Number.isFinite(pct) ? market * pct : 0;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-white">{r.name}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">$</span>
                      <input
                        required
                        inputMode="decimal"
                        value={entry.marketPrice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [r.id]: { ...f[r.id], marketPrice: e.target.value },
                          }))
                        }
                        className="w-24 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-white/30 focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        required
                        inputMode="decimal"
                        value={entry.customerPct}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [r.id]: { ...f[r.id], customerPct: e.target.value },
                          }))
                        }
                        className="w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-white/30 focus:outline-none"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-400">${resident.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
