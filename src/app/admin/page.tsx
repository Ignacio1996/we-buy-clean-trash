import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  MATERIAL_IDS,
  MATERIAL_DISPLAY_NAMES,
  type MaterialId,
} from '@/lib/types/material';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

function startOfMonthTimestamp(): Timestamp {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return Timestamp.fromDate(start);
}

function currentMonthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

async function loadKpis() {
  const monthStart = startOfMonthTimestamp();

  const [residentsSnap, bagsThisMonthSnap, inventorySnap, ordersThisMonthSnap] = await Promise.all([
    adminDb.collection('users').where('role', '==', 'resident').count().get(),
    adminDb.collection('bags').where('createdAt', '>=', monthStart).count().get(),
    adminDb.collection('inventory').get(),
    adminDb.collection('bagOrders').where('createdAt', '>=', monthStart).get(),
  ]);

  const inventoryByMaterial: Record<MaterialId, number> = Object.fromEntries(
    MATERIAL_IDS.map((id) => [id, 0]),
  ) as Record<MaterialId, number>;
  inventorySnap.docs.forEach((d) => {
    const materialId = d.get('materialId') as MaterialId | undefined;
    const weight = typeof d.get('weight') === 'number' ? (d.get('weight') as number) : 0;
    if (materialId && materialId in inventoryByMaterial) {
      inventoryByMaterial[materialId] += weight;
    }
  });
  const totalWeight = Object.values(inventoryByMaterial).reduce((a, b) => a + b, 0);

  let revenue = 0;
  ordersThisMonthSnap.docs.forEach((d) => {
    const status = d.get('status');
    if (status === 'cancelled') return;
    const total = typeof d.get('total') === 'number' ? (d.get('total') as number) : 0;
    revenue += total;
  });

  return {
    residentCount: residentsSnap.data().count,
    bagsThisMonth: bagsThisMonthSnap.data().count,
    inventoryByMaterial,
    totalWeight,
    revenue,
  };
}

function formatLbs(lbs: number): string {
  if (lbs >= 2000) return `${(lbs / 2000).toFixed(1)}t`;
  return `${Math.round(lbs).toLocaleString('en-US')} lbs`;
}

function formatDollars(d: number): string {
  return d.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default async function AdminDashboard() {
  const kpis = await loadKpis();
  const monthLabel = currentMonthLabel();

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-xs text-gray-500">Live counts across all zones · {monthLabel}</p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active residents" value={kpis.residentCount.toLocaleString('en-US')} />
        <KpiCard
          label="Bags issued this month"
          value={kpis.bagsThisMonth.toLocaleString('en-US')}
        />
        <KpiCard label="Material in stock" value={formatLbs(kpis.totalWeight)} />
        <KpiCard label={`Revenue · ${monthLabel}`} value={formatDollars(kpis.revenue)} />
      </section>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-white">Inventory by material</h2>
        <p className="mt-0.5 text-xs text-gray-500">Across all depots</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MATERIAL_IDS.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2"
            >
              <span className="text-xs text-gray-300">{MATERIAL_DISPLAY_NAMES[id]}</span>
              <span className="text-xs font-semibold text-white">
                {formatLbs(kpis.inventoryByMaterial[id])}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-[11px] text-gray-500">
        Zone-performance table, contamination alerts, and operator leaderboard land in Phase 9.
      </p>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
