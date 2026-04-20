import { adminDb } from '@/lib/firebase/admin';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import { CalculatorForm } from './CalculatorForm';

async function loadMaterials(): Promise<Record<MaterialId, MaterialPricing>> {
  const snap = await adminDb.collection('materials').get();
  const result = {} as Record<MaterialId, MaterialPricing>;
  for (const id of MATERIAL_IDS) {
    const doc = snap.docs.find((d) => d.id === id)?.data();
    result[id] = {
      marketPrice: typeof doc?.marketPrice === 'number' ? doc.marketPrice : 0,
      customerPct: typeof doc?.customerPct === 'number' ? doc.customerPct : 0,
    };
  }
  return result;
}

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function CalculatorPage() {
  const materials = await loadMaterials();

  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">💰 What&rsquo;s it worth?</h1>
      <p className="mt-1 text-xs text-gray-400">
        Live yellow-sheet prices · you earn {(materials.aluminum.customerPct * 100).toFixed(0)}% of
        market.
      </p>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Accepted materials</div>
        <ul className="mt-2 space-y-2 text-sm">
          {MATERIAL_IDS.map((id) => (
            <li key={id} className="flex items-center justify-between">
              <span className="text-white">{MATERIAL_DISPLAY_NAMES[id]}</span>
              <span className="text-gray-400">
                {formatDollars(materials[id].marketPrice)} / lb · you get{' '}
                {formatDollars(materials[id].marketPrice * materials[id].customerPct)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <CalculatorForm materials={materials} />

      <p className="mt-4 text-[10px] text-gray-500">
        Separated bags earn 2× points. Contamination can reduce your payout by up to 90%.
      </p>
    </main>
  );
}
