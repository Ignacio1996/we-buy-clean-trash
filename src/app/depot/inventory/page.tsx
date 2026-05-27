import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import type { MaterialId } from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';
import { SS } from '@/components/resident/ss/SS';

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
  if (pct >= 95) return SS.brand;
  if (pct >= 80) return '#E89B2A';
  return SS.ink;
}

export default async function InventoryPage() {
  const session = await requireRole('depot_worker');
  const depotRes = await loadDepotContext(session.uid);

  if (!depotRes.ok) {
    return (
      <section style={{ padding: 20 }}>
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {depotRes.error === 'depot_not_found'
            ? 'No depot is assigned to your account yet.'
            : 'Your user record could not be loaded.'}
        </div>
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
  const totalStock = rows.reduce((acc, r) => acc + r.weight, 0);
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section>
      {/* Yellow hero — total stock */}
      <div
        style={{
          background: SS.yellow,
          padding: '24px 20px 22px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
          }}
        >
          {depotRes.context.depot.name} · ready for mill
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: -1.6,
            lineHeight: 0.95,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          {totalStock.toLocaleString('en-US', { maximumFractionDigits: 0 })} lbs
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.75,
            marginTop: 4,
          }}
        >
          across {rows.length} {rows.length === 1 ? 'commodity' : 'commodities'}
        </div>
      </div>

      {/* Critical alert */}
      {critical.length > 0 && (
        <div style={{ background: '#fff', padding: '14px 20px 0' }}>
          <div
            style={{
              background: SS.brand,
              color: '#fff',
              border: `2px solid ${SS.ink}`,
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: `0 4px 0 ${SS.ink}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 20 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  opacity: 0.9,
                }}
              >
                Near capacity
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: -0.3,
                  lineHeight: 1.2,
                  marginTop: 2,
                }}
              >
                {critical.map((r) => r.name).join(', ')} — schedule a truck.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div style={{ background: '#fff', padding: '14px 20px 0' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 12,
          }}
        >
          Current stock
        </div>
        {rows.map((row) => (
          <div key={row.id} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: -0.2,
                  color: SS.ink,
                }}
              >
                <span aria-hidden>{emojiFor(row.id)}</span>
                {row.name}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: row.weight > 0 ? SS.ink : SS.inkSoft,
                  fontFeatureSettings: '"lnum","tnum"',
                }}
              >
                {row.weight.toFixed(1)} lbs
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: '#fff',
                border: `2px solid ${SS.ink}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${row.pct}%`,
                  height: '100%',
                  background: barColor(row.pct),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Yellow sheet pricing */}
      <div style={{ background: SS.sky, padding: '22px 20px', marginTop: 14 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 10,
          }}
        >
          Yellow sheet · {monthLabel}
        </div>
        <div
          style={{
            background: SS.yellow,
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '10px 14px',
                borderBottom:
                  i < rows.length - 1 ? `1.5px solid ${SS.ink}` : 'none',
                fontSize: 13,
                fontWeight: 900,
                color: SS.ink,
              }}
            >
              <span>{row.name}</span>
              <span style={{ fontFeatureSettings: '"lnum","tnum"' }}>
                ${row.marketPrice.toFixed(2)}
                <span style={{ opacity: 0.55, marginLeft: 2 }}>/ lb</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
