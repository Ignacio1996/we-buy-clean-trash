import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import type { MaterialId } from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';
import {
  DP_TOK,
  DpAlert,
  DpEyebrow,
  DpMasthead,
  DpPaper,
  DpProgressBar,
} from '@/components/depot/Dp';

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

function barTone(pct: number): 'ink' | 'amber' | 'rust' {
  if (pct >= 95) return 'rust';
  if (pct >= 80) return 'amber';
  return 'ink';
}

export default async function InventoryPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <DpAlert tone="rust">
        {depotRes.error === 'depot_not_found'
          ? 'No depot is assigned to your account yet.'
          : 'Your user record could not be loaded.'}
      </DpAlert>
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
  const visibleIds = new Set<string>([...acceptedSet, ...invMap.keys()]);
  const materialNameById = new Map(allMaterials.map((m) => [m.id, m] as const));
  const rows = [...visibleIds]
    .map((id) => {
      const weight = invMap.get(id) ?? 0;
      const pct = Math.min(
        100,
        Math.round((weight / DEPOT_CAPACITY_LBS_PER_MATERIAL) * 100),
      );
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
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="space-y-4">
      <DpMasthead
        eyebrow={depotRes.context.depot.name}
        title={
          <>
            Depot{' '}
            <em style={{ color: DP_TOK.green, fontStyle: 'italic' }}>inventory</em>.
          </>
        }
      />

      {critical.length > 0 && (
        <DpAlert tone="rust">
          ⚠️ {critical.map((r) => r.name).join(', ')} near capacity — schedule a
          truck.
        </DpAlert>
      )}

      <DpPaper>
        <DpEyebrow>Current stock (lbs)</DpEyebrow>
        <div className="mt-3 space-y-3.5">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="flex items-baseline justify-between">
                <span
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: DP_TOK.serif,
                    fontSize: 14,
                    color: DP_TOK.ink,
                  }}
                >
                  <span aria-hidden>{emojiFor(row.id)}</span>
                  {row.name}
                </span>
                <span
                  style={{
                    fontFamily: DP_TOK.serif,
                    fontSize: 14,
                    color: row.weight > 0 ? DP_TOK.ink : DP_TOK.inkFaint,
                    fontFeatureSettings: '"lnum","tnum"',
                  }}
                >
                  {row.weight.toFixed(1)} lbs
                </span>
              </div>
              <div className="mt-1.5">
                <DpProgressBar pct={row.pct} tone={barTone(row.pct)} />
              </div>
            </div>
          ))}
        </div>
      </DpPaper>

      <DpPaper>
        <DpEyebrow>Yellow sheet · {monthLabel}</DpEyebrow>
        <div className="mt-2.5">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex items-baseline justify-between py-1.5"
              style={{
                borderBottom:
                  i < rows.length - 1 ? `1px solid ${DP_TOK.lineSoft}` : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: DP_TOK.serif,
                  fontSize: 13.5,
                  color: DP_TOK.ink,
                }}
              >
                {row.name}
              </span>
              <span
                style={{
                  fontFamily: DP_TOK.serif,
                  fontSize: 13.5,
                  color: DP_TOK.green,
                  fontFeatureSettings: '"lnum","tnum"',
                }}
              >
                ${row.marketPrice.toFixed(2)}
                <span style={{ color: DP_TOK.inkFaint, marginLeft: 2 }}>/lb</span>
              </span>
            </div>
          ))}
        </div>
      </DpPaper>
    </section>
  );
}
