import Link from 'next/link';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import {
  MATERIAL_IDS,
  MATERIAL_DISPLAY_NAMES,
  type ContaminationSeverity,
  type MaterialId,
} from '@/lib/types/material';
import { GuideLink } from '@/components/admin/GuideLink';
import {
  loadContaminationAlerts,
  loadOperatorLeaderboard,
  loadZonePerformance,
  type ContaminationAlert,
  type OperatorLeaderboardRow,
  type ZonePerformanceRow,
} from '@/lib/admin/dashboard';

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
  const [kpis, zones, alerts, leaderboard] = await Promise.all([
    loadKpis(),
    loadZonePerformance(),
    loadContaminationAlerts(),
    loadOperatorLeaderboard(),
  ]);
  const monthLabel = currentMonthLabel();

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-xs text-gray-500">Live counts across all zones · {monthLabel}</p>
        </div>
        <GuideLink href="/user-guides/phase-9-admin-polish.html" />
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

      <ZonePerformanceSection rows={zones} />

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContaminationAlertsSection alerts={alerts} />
        <OperatorLeaderboardSection rows={leaderboard} />
      </div>

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

function ZonePerformanceSection({ rows }: { rows: ZonePerformanceRow[] }) {
  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Zone performance</h2>
          <p className="mt-0.5 text-xs text-gray-500">This month · residents, bags, revenue</p>
        </div>
        <Link href="/admin/zones" className="text-[11px] text-gray-400 hover:text-white">
          Manage →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-gray-500">No zones configured yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="pb-2 pr-3 font-medium">Zone</th>
                <th className="pb-2 pr-3 font-medium">Residents</th>
                <th className="pb-2 pr-3 font-medium">Bags</th>
                <th className="pb-2 pr-3 font-medium">Weight</th>
                <th className="pb-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {rows.map((r) => (
                <tr key={r.zoneId}>
                  <td className="py-2 pr-3 font-medium text-white">{r.zoneName}</td>
                  <td className="py-2 pr-3">{r.residents.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-3">{r.bags.toLocaleString('en-US')}</td>
                  <td className="py-2 pr-3">{formatLbs(r.weightLbs)}</td>
                  <td className="py-2 font-semibold text-white">
                    {formatDollars(r.revenueCents / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const SEVERITY_LABEL: Record<ContaminationSeverity, string> = {
  none: 'Clean',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
};

function strikeLabel(count: number): string {
  if (count >= 3) return `${count}${ordinalSuffix(count)} strike`;
  if (count === 2) return '2nd strike';
  return '1st warning';
}

function strikeBadge(count: number): { label: string; cls: string } {
  if (count >= 3) {
    return {
      label: 'ACTION',
      cls: 'bg-red-500/15 text-red-300 border-red-500/30',
    };
  }
  if (count === 2) {
    return {
      label: 'STRIKE',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    };
  }
  return {
    label: 'WARNED',
    cls: 'bg-white/10 text-gray-300 border-white/10',
  };
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function ContaminationAlertsSection({ alerts }: { alerts: ContaminationAlert[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold text-white">Contamination alerts</h2>
      <p className="mt-0.5 text-xs text-gray-500">Rolling 6-month window</p>
      {alerts.length === 0 ? (
        <p className="mt-4 text-xs text-gray-500">
          No flagged residents — last 6 months are clean.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {alerts.map((a) => {
            const badge = strikeBadge(a.strikeCount);
            return (
              <li key={a.residentId} className="flex items-center gap-3 py-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                    a.strikeCount >= 3
                      ? 'bg-red-500/15 text-red-300'
                      : a.strikeCount === 2
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-white/10 text-gray-300'
                  }`}
                >
                  ⚠️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-white">
                    {a.residentName} — {strikeLabel(a.strikeCount)}
                  </div>
                  <div className="truncate text-[11px] text-gray-500">
                    {a.zoneName ?? 'No zone'} · Last: {SEVERITY_LABEL[a.lastSeverity]} ·{' '}
                    {a.lastAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

function OperatorLeaderboardSection({ rows }: { rows: OperatorLeaderboardRow[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold text-white">Operator leaderboard</h2>
      <p className="mt-0.5 text-xs text-gray-500">This month · completed pickups</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-gray-500">No operator activity this month yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5">
          {rows.map((r, i) => (
            <li key={r.operatorId} className="flex items-center gap-3 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">
                {MEDALS[i] ?? '•'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">{r.operatorName}</div>
                <div className="truncate text-[11px] text-gray-500">
                  {r.completed} pickup{r.completed === 1 ? '' : 's'} ·{' '}
                  {r.issues === 0
                    ? '0 issues'
                    : `${r.issues} issue${r.issues === 1 ? '' : 's'}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
