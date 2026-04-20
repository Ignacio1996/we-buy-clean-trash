'use client';

import { useMemo, useState } from 'react';
import { calculatePoints } from '@/lib/logic/calculatePoints';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';

const DEFAULT_WEIGHTS: Record<MaterialId, number> = {
  aluminum: 1,
  tin_steel: 0,
  cardboard: 5,
  paper: 0,
  pet: 0.5,
  hdpe: 0,
  mixed_plastic: 0,
};

function formatDollars(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatPoints(n: number) {
  return n.toLocaleString('en-US');
}

export function CalculatorForm({ materials }: { materials: Record<MaterialId, MaterialPricing> }) {
  const [weights, setWeights] = useState<Record<MaterialId, number>>(DEFAULT_WEIGHTS);

  const good = useMemo(
    () => calculatePoints({ weights, materials, separated: true, contaminationSeverity: 'none' }),
    [weights, materials],
  );
  const bad = useMemo(
    () =>
      calculatePoints({ weights, materials, separated: false, contaminationSeverity: 'severe' }),
    [weights, materials],
  );

  function updateWeight(id: MaterialId, value: string) {
    const n = Number(value);
    setWeights((prev) => ({ ...prev, [id]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  }

  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Try it — enter lbs</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {MATERIAL_IDS.map((id) => (
            <label key={id} className="flex flex-col gap-1 text-xs text-gray-300">
              {MATERIAL_DISPLAY_NAMES[id]}
              <input
                type="number"
                min={0}
                step={0.1}
                value={weights[id]}
                onChange={(e) => updateWeight(id, e.target.value)}
                className="rounded border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-green-400">
          ✓ Clean &amp; separated
        </div>
        <div className="mt-1 text-2xl font-bold text-white">
          {formatDollars(good.payoutDollars)} · {formatPoints(good.pointsAwarded)} pts
        </div>
      </div>

      <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-400">
          ✗ Contaminated / not separated
        </div>
        <div className="mt-1 text-2xl font-bold text-white">
          {formatDollars(bad.payoutDollars)} · {formatPoints(bad.pointsAwarded)} pts
        </div>
      </div>
    </section>
  );
}
