'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialId,
} from '@/lib/types/material';

interface Props {
  depotId: string;
  inventory: Record<MaterialId, number>;
}

type Step = 'collapsed' | 'form' | 'submitting';

function todayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1); // default to tomorrow
  return d.toISOString().slice(0, 10);
}

export function ScheduleMillPickupForm({ depotId, inventory }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('collapsed');
  const [mill, setMill] = useState('');
  const [scheduledFor, setScheduledFor] = useState(todayIso());
  const [weights, setWeights] = useState<Record<MaterialId, string>>(() => {
    const init = {} as Record<MaterialId, string>;
    for (const id of MATERIAL_IDS) init[id] = '';
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const numericWeights = useMemo(() => {
    const out = {} as Record<MaterialId, number>;
    for (const id of MATERIAL_IDS) {
      const n = Number(weights[id]);
      out[id] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return out;
  }, [weights]);

  const totalWeight = useMemo(
    () => MATERIAL_IDS.reduce((sum, id) => sum + numericWeights[id], 0),
    [numericWeights],
  );

  const overLimits: MaterialId[] = useMemo(
    () => MATERIAL_IDS.filter((id) => numericWeights[id] > (inventory[id] ?? 0)),
    [numericWeights, inventory],
  );

  const canSubmit = mill.trim() && scheduledFor && totalWeight > 0 && overLimits.length === 0;

  function fillAll() {
    const next = {} as Record<MaterialId, string>;
    for (const id of MATERIAL_IDS) {
      next[id] = (inventory[id] ?? 0) > 0 ? String(inventory[id]) : '';
    }
    setWeights(next);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setStep('submitting');
    setError(null);
    try {
      const payload = {
        depotId,
        mill: mill.trim(),
        scheduledFor,
        weights: Object.fromEntries(
          MATERIAL_IDS.filter((id) => numericWeights[id] > 0).map((id) => [
            id,
            numericWeights[id],
          ]),
        ),
      };
      const res = await fetch('/api/mill-shipments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        materialId?: string;
      };
      if (!res.ok) {
        if (body.error === 'insufficient_inventory') {
          throw new Error(
            `Not enough ${body.materialId ? MATERIAL_DISPLAY_NAMES[body.materialId as MaterialId] : 'material'} in stock.`,
          );
        }
        throw new Error(body.error ?? 'submit_failed');
      }
      setStep('collapsed');
      setMill('');
      setWeights(() => {
        const init = {} as Record<MaterialId, string>;
        for (const id of MATERIAL_IDS) init[id] = '';
        return init;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('form');
    }
  }

  if (step === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setStep('form')}
        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
      >
        🚛 Schedule Mill Pickup
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Schedule mill pickup</h2>
        <button
          type="button"
          onClick={() => setStep('collapsed')}
          className="text-xs text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <label className="block text-xs">
        <span className="text-gray-400">Mill name</span>
        <input
          type="text"
          value={mill}
          onChange={(e) => setMill(e.target.value)}
          placeholder="e.g. Sonoco Paper Mill"
          className="mt-1 block w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-gray-600"
        />
      </label>

      <label className="block text-xs">
        <span className="text-gray-400">Scheduled pickup date</span>
        <input
          type="date"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="mt-1 block w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
        />
      </label>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">
            Loads (lbs)
          </span>
          <button
            type="button"
            onClick={fillAll}
            className="text-[11px] text-gray-400 underline hover:text-white"
          >
            Fill all from stock
          </button>
        </div>
        <div className="mt-2 divide-y divide-white/5">
          {MATERIAL_IDS.map((id) => {
            const onHand = inventory[id] ?? 0;
            const over = numericWeights[id] > onHand;
            return (
              <div key={id} className="flex items-center justify-between py-2">
                <div className="text-sm text-gray-200">
                  {MATERIAL_DISPLAY_NAMES[id]}
                  <span className="ml-2 text-[11px] text-gray-500">
                    {onHand.toFixed(1)} on hand
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    type="text"
                    value={weights[id]}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [id]: e.target.value.replace(/[^0-9.]/g, ''),
                      }))
                    }
                    placeholder="0.0"
                    className={`w-20 rounded border px-2 py-1 text-right text-sm ${
                      over
                        ? 'border-red-500/50 bg-red-500/10 text-red-200'
                        : 'border-white/15 bg-black/40 text-white'
                    }`}
                  />
                  <span className="text-[11px] text-gray-500">lbs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-400">
        Total: <span className="font-semibold text-white">{totalWeight.toFixed(1)} lbs</span>
      </div>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || step === 'submitting'}
        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {step === 'submitting' ? 'Scheduling…' : 'Schedule pickup'}
      </button>
    </div>
  );
}
