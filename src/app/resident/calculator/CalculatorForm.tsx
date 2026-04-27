'use client';

import { useMemo, useState } from 'react';
import { calculatePoints } from '@/lib/logic/calculatePoints';
import type { ActiveMaterial } from '@/lib/admin/loadActiveMaterials';
import type { MaterialId, MaterialPricing } from '@/lib/types/material';

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

const DEFAULT_DEMO_WEIGHTS: Record<string, number> = {
  aluminum: 1,
  cardboard: 5,
  pet: 0.5,
};

export function CalculatorForm({
  materials,
  multipliers,
}: {
  materials: ActiveMaterial[];
  multipliers?: Record<MaterialId, number>;
}) {
  const pricingMap = useMemo<Record<MaterialId, MaterialPricing>>(() => {
    const out: Record<string, MaterialPricing> = {};
    for (const m of materials) {
      out[m.id] = { marketPrice: m.marketPrice, customerPct: m.customerPct };
    }
    return out;
  }, [materials]);

  const [weights, setWeights] = useState<Record<MaterialId, number>>(() => {
    const init: Record<string, number> = {};
    for (const m of materials) init[m.id] = DEFAULT_DEMO_WEIGHTS[m.id] ?? 0;
    return init;
  });

  const good = useMemo(
    () =>
      calculatePoints({
        weights,
        materials: pricingMap,
        separated: true,
        contaminationSeverity: 'none',
        materialMultipliers: multipliers,
      }),
    [weights, pricingMap, multipliers],
  );
  const bad = useMemo(
    () =>
      calculatePoints({
        weights,
        materials: pricingMap,
        separated: false,
        contaminationSeverity: 'severe',
        materialMultipliers: multipliers,
      }),
    [weights, pricingMap, multipliers],
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
          {materials.map((m) => (
            <label key={m.id} className="flex flex-col gap-1 text-xs text-gray-300">
              {m.name}
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weights[m.id] ?? 0}
                  onChange={(e) => updateWeight(m.id, e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-2 py-1 pr-9 text-sm text-white"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-gray-500">
                  lbs
                </span>
              </div>
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
