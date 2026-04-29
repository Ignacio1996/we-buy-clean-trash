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
    <section className="space-y-3">
      <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow mb-2">Try it — enter lbs</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {materials.map((m) => (
            <label
              key={m.id}
              className="flex flex-col gap-1 text-[12px]"
              style={{ color: '#5A6358' }}
            >
              <span style={{ fontFamily: 'var(--eco-serif)', fontSize: 13, color: '#1F2A22' }}>
                {m.name}
              </span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weights[m.id] ?? 0}
                  onChange={(e) => updateWeight(m.id, e.target.value)}
                  className="w-full rounded-[10px] border border-[#D9D2C2] bg-[#FBF7EE] px-3 py-2 pr-10 text-[15px] text-[#1F2A22] placeholder:text-[#8A8A7A] focus:border-[#2D5A3D] focus:outline-none"
                  style={{ fontFamily: 'var(--eco-serif)' }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 uppercase"
                  style={{
                    fontSize: 10,
                    color: '#8A8A7A',
                    letterSpacing: 1.2,
                  }}
                >
                  lbs
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div
        className="rounded-[14px] border p-4 text-center"
        style={{
          background: '#E8EFE6',
          borderColor: 'rgba(45,90,61,0.3)',
        }}
      >
        <div className="eco-eyebrow" style={{ color: '#2D5A3D' }}>
          Clean &amp; separated
        </div>
        <div
          className="mt-1.5"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 28,
            fontWeight: 400,
            color: '#1F2A22',
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          {formatDollars(good.payoutDollars)}
        </div>
        <div
          className="mt-1 italic"
          style={{ fontFamily: 'var(--eco-serif)', fontSize: 13, color: '#2D5A3D' }}
        >
          {formatPoints(good.pointsAwarded)} points
        </div>
      </div>

      <div
        className="rounded-[14px] border p-4 text-center"
        style={{
          background: '#F0DCC8',
          borderColor: 'rgba(154,75,38,0.3)',
        }}
      >
        <div className="eco-eyebrow" style={{ color: '#9A4B26' }}>
          Contaminated · not separated
        </div>
        <div
          className="mt-1.5"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 28,
            fontWeight: 400,
            color: '#1F2A22',
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          {formatDollars(bad.payoutDollars)}
        </div>
        <div
          className="mt-1 italic"
          style={{ fontFamily: 'var(--eco-serif)', fontSize: 13, color: '#9A4B26' }}
        >
          {formatPoints(bad.pointsAwarded)} points
        </div>
      </div>
    </section>
  );
}
