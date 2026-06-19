import Link from 'next/link';
import { DeletePickupRowButton } from './DeletePickupRowButton';
import { adminDb } from '@/lib/firebase/admin';
import type { BinPickupDoc, BinPickupAction } from '@/lib/types/binPickup';
import { COMPOST_SKIP_REASON_LABELS } from '@/lib/types/binPickup';
import type { SiteCheckDoc } from '@/lib/types/siteCheck';
import { CART_STATUS_LABELS } from '@/lib/types/siteCheck';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import type { UserDoc } from '@/lib/types/user';
import { MATERIAL_DISPLAY_NAMES } from '@/lib/types/material';
import { columbusDateKey, columbusDateLabel, columbusTimeLabel } from '@/lib/logic/columbusDate';

interface StopRow {
  kind: 'bin' | 'check';
  id: string;
  createdAt: Date | null;
  dateLabel: string;
  dateKey: string;
  timeLabel: string;
  siteName: string;
  operatorName: string;
  routeId: string | null;
  summary: string;
  weightLbs: number;
}

const BIN_ACTION_LABELS: Record<BinPickupAction, string> = {
  swapped: 'Bins swapped',
  loaded: 'Bins loaded',
  skipped: 'Skipped',
};

function binSummary(p: BinPickupDoc): string {
  if (p.action === 'skipped') {
    const reason = p.skipReason ? COMPOST_SKIP_REASON_LABELS[p.skipReason] : null;
    return reason ? `Skipped · ${reason}` : 'Skipped';
  }
  const material = MATERIAL_DISPLAY_NAMES[p.materialId] ?? p.materialId;
  const parts = [
    BIN_ACTION_LABELS[p.action] ?? p.action,
    `${p.bins.length} bin${p.bins.length === 1 ? '' : 's'}`,
    `${p.totalWeightLbs.toLocaleString()} lbs ${material}`,
  ];
  if (p.contaminationSeverity && p.contaminationSeverity !== 'none') {
    parts.push(`${p.contaminationSeverity} contamination`);
  }
  if (p.damaged) parts.push('damaged');
  if (p.needsCleaning) parts.push('to clean');
  return parts.join(' · ');
}

function checkSummary(c: SiteCheckDoc): string {
  const parts = [`Cart check · ${CART_STATUS_LABELS[c.cartStatus] ?? c.cartStatus}`];
  if (c.overflow) parts.push('overflow');
  if (c.contaminationSeverity && c.contaminationSeverity !== 'none') {
    parts.push(`${c.contaminationSeverity} contamination`);
  }
  return parts.join(' · ');
}

async function loadStops(): Promise<StopRow[]> {
  const [pickupSnap, checkSnap] = await Promise.all([
    adminDb.collection('binPickups').orderBy('createdAt', 'desc').limit(200).get(),
    adminDb.collection('siteChecks').orderBy('createdAt', 'desc').limit(200).get(),
  ]);
  const pickups = pickupSnap.docs.map((d) => d.data() as BinPickupDoc);
  const checks = checkSnap.docs.map((d) => d.data() as SiteCheckDoc);

  // Batch-resolve site + operator names so the table reads in plain English.
  const accountIds = [
    ...new Set([
      ...pickups.map((p) => p.commercialAccountId),
      ...checks.map((c) => c.commercialAccountId),
    ]),
  ];
  const operatorIds = [
    ...new Set([...pickups.map((p) => p.operatorId), ...checks.map((c) => c.operatorId)]),
  ];

  const siteNames = new Map<string, string>();
  if (accountIds.length > 0) {
    const snaps = await adminDb.getAll(
      ...accountIds.map((id) => adminDb.collection('commercialAccounts').doc(id)),
    );
    for (const s of snaps) {
      if (s.exists) siteNames.set(s.id, (s.data() as CommercialAccountDoc).businessName || s.id);
    }
  }

  const operatorNames = new Map<string, string>();
  if (operatorIds.length > 0) {
    const snaps = await adminDb.getAll(
      ...operatorIds.map((id) => adminDb.collection('users').doc(id)),
    );
    for (const s of snaps) {
      if (s.exists) {
        const u = s.data() as UserDoc;
        operatorNames.set(s.id, u.name || u.email || s.id);
      }
    }
  }

  const rows: StopRow[] = [];
  for (const p of pickups) {
    const at = p.createdAt?.toDate?.() ?? null;
    rows.push({
      kind: 'bin',
      id: p.id,
      createdAt: at,
      dateLabel: at ? columbusDateLabel(at) : '—',
      dateKey: at ? columbusDateKey(at) : '',
      timeLabel: at ? columbusTimeLabel(at) : '—',
      siteName: siteNames.get(p.commercialAccountId) ?? p.commercialAccountId,
      operatorName: operatorNames.get(p.operatorId) ?? p.operatorId,
      routeId: p.routeId,
      summary: binSummary(p),
      weightLbs: p.totalWeightLbs,
    });
  }
  for (const c of checks) {
    const at = c.createdAt?.toDate?.() ?? null;
    rows.push({
      kind: 'check',
      id: c.id,
      createdAt: at,
      dateLabel: at ? columbusDateLabel(at) : '—',
      dateKey: at ? columbusDateKey(at) : '',
      timeLabel: at ? columbusTimeLabel(at) : '—',
      siteName: siteNames.get(c.commercialAccountId) ?? c.commercialAccountId,
      operatorName: operatorNames.get(c.operatorId) ?? c.operatorId,
      routeId: c.routeId,
      summary: checkSummary(c),
      weightLbs: 0,
    });
  }

  rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return rows;
}

export default async function CompostPickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const todayOnly = filter === 'today';
  const todayKey = columbusDateKey(new Date());
  const allStops = await loadStops();
  const stops = todayOnly ? allStops.filter((s) => s.dateKey === todayKey) : allStops;

  const today = allStops.filter((s) => s.dateKey === todayKey);
  const todayWeight = today.reduce((sum, s) => sum + s.weightLbs, 0);

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Compost · Tia
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Recorded pickups</h1>
        <p className="mt-1 text-xs text-gray-500">
          Every individual stop the driver recorded — bin pickups and cart checks, newest first.
          Delete a row to clear a stray or test submission. Deleting a bin pickup reverses the
          weight it added to diversion totals.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/70">Today</div>
            <div className="mt-0.5 text-sm text-white">
              <span className="font-semibold">{today.length}</span> stop
              {today.length === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold">{todayWeight.toLocaleString()}</span> lbs
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/admin/compost/pickups"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                todayOnly
                  ? 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              }`}
            >
              All
            </Link>
            <Link
              href="/admin/compost/pickups?filter=today"
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                todayOnly
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
              }`}
            >
              Today
            </Link>
          </div>
        </div>
      </header>

      {stops.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          {todayOnly
            ? 'No stops recorded today yet.'
            : 'No pickups recorded yet. A stop appears here once an operator records a bin pickup or cart check.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Site</th>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">What was recorded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stops.map((s) => (
                <tr key={`${s.kind}-${s.id}`} className="align-top transition-colors hover:bg-white/5">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-medium text-white">{s.dateLabel}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">{s.timeLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{s.siteName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-300">{s.operatorName}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {s.summary}
                    {s.routeId && (
                      <Link
                        href={`/admin/compost/routes/${s.routeId}`}
                        className="ml-2 text-[11px] font-semibold text-blue-300 underline hover:text-blue-200"
                      >
                        run
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <DeletePickupRowButton kind={s.kind} id={s.id} weightLbs={s.weightLbs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
