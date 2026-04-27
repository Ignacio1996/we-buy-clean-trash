import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import type { MaterialId } from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';

export const dynamic = 'force-dynamic';

// Pilot-era heuristic: 1,500 lbs per material before we nag to schedule a truck.
// Admin can revisit once we have real depot capacity data post-pilot.
const DEPOT_CAPACITY_LBS_PER_MATERIAL = 1500;

const MATERIAL_EMOJI: Record<string, string> = {
  aluminum: '🥫',
  tin_steel: '🥫',
  cardboard: '📦',
  paper: '📄',
  pet: '🧴',
  hdpe: '🧴',
  mixed_plastic: '🛍️',
  compost: '🌱',
  textile: '👕',
  electronics: '🔌',
};

function emojiFor(id: MaterialId): string {
  return MATERIAL_EMOJI[id] ?? '♻️';
}

function barColor(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-400';
  return 'bg-white';
}

export default async function InventoryPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <section className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
        {depotRes.error === 'depot_not_found'
          ? 'No depot is assigned to your account yet.'
          : 'Your user record could not be loaded.'}
      </section>
    );
  }
  const depotId = depotRes.context.depot.id;

  const [invSnap, allMaterials] = await Promise.all([
    adminDb.collection('inventory').where('depotId', '==', depotId).get(),
    loadActiveMaterials(),
  ]);

  const invMap = new Map<MaterialId, number>();
  invSnap.docs.forEach((d) => {
    const doc = d.data() as InventoryDoc;
    invMap.set(doc.materialId, doc.weight ?? 0);
  });

  const acceptedSet = new Set(
    resolveAcceptedMaterials(
      depotRes.context.depot,
      allMaterials.map((m) => m.id),
    ),
  );
  // Show every material the depot accepts plus any historical inventory entries
  // (so legacy stock from a now-inactive material still surfaces).
  const visibleIds = new Set<string>([...acceptedSet, ...invMap.keys()]);
  const materialNameById = new Map(allMaterials.map((m) => [m.id, m] as const));
  const rows = [...visibleIds]
    .map((id) => {
      const weight = invMap.get(id) ?? 0;
      const pct = Math.min(100, Math.round((weight / DEPOT_CAPACITY_LBS_PER_MATERIAL) * 100));
      const m = materialNameById.get(id);
      return {
        id,
        name: m?.name ?? id,
        weight,
        pct,
        marketPrice: m?.marketPrice ?? 0,
        order: m?.displayOrder ?? 1000,
      };
    })
    .sort((a, b) => a.order - b.order);

  const critical = rows.filter((r) => r.pct >= 95);

  return (
    <section className="mt-5 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
          {depotRes.context.depot.name}
        </div>
        <h1 className="mt-0.5 text-lg font-semibold text-white">Depot inventory</h1>
      </div>

      {critical.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-300">
          ⚠️ {critical.map((r) => r.name).join(', ')} near capacity — schedule a truck
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Current stock (lbs)</div>
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>
                  <span className="mr-1">{emojiFor(row.id)}</span>
                  {row.name}
                </span>
                <span className={row.weight > 0 ? 'text-white' : 'text-gray-500'}>
                  {row.weight.toFixed(1)} lbs
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${barColor(row.pct)}`}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">
          Yellow sheet (this month)
        </div>
        <div className="mt-3 space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.id} className="flex justify-between">
              <span className="text-gray-300">{row.name}</span>
              <span className="text-white">${row.marketPrice.toFixed(2)}/lb</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
