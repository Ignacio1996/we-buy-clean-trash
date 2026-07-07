import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { SiteCheckDoc } from '@/lib/types/siteCheck';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import type { AppLedgerRow } from '@/lib/logic/reconcileCompost';
import {
  columbusDateKey,
  columbusDayStart,
  columbusWeekStartKey,
  weekdayFromDateKey,
} from '@/lib/logic/columbusDate';
import { ReconcileClient } from './ReconcileClient';

/** Enumerate "YYYY-MM-DD" keys from `from` to `to` inclusive (parsed at noon UTC for stable calendar days). */
function dateKeysInRange(from: string, to: string): string[] {
  const keys: string[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return keys;
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    keys.push(new Date(t).toISOString().slice(0, 10));
    if (keys.length > 62) break; // guard: cap at ~2 months
  }
  return keys;
}

/** UTC instant of the start of the Columbus day for a "YYYY-MM-DD" key. */
function dayStartFromKey(dayKey: string): Date {
  return columbusDayStart(new Date(`${dayKey}T12:00:00Z`));
}

function defaultRange(now: Date): { from: string; to: string } {
  // Previous complete week: Monday..Sunday before this week's Monday.
  const thisMonday = columbusWeekStartKey(now);
  const monMs = new Date(`${thisMonday}T12:00:00Z`).getTime();
  const from = new Date(monMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(monMs - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

interface Agg {
  binCount: number;
  fullnessSum: number;
  fullnessCount: number;
  weightLbs: number;
  pickups: number;
  skipped: boolean;
  hasCheck: boolean;
}

async function loadLedger(from: string, to: string): Promise<AppLedgerRow[]> {
  const rangeStart = dayStartFromKey(from);
  // Exclusive upper bound = start of the day AFTER `to`.
  const toPlus = new Date(new Date(`${to}T12:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const rangeEnd = dayStartFromKey(toPlus);

  const [pickupsSnap, checksSnap, accountsSnap] = await Promise.all([
    adminDb
      .collection('binPickups')
      .where('createdAt', '>=', rangeStart)
      .where('createdAt', '<', rangeEnd)
      .get(),
    adminDb
      .collection('siteChecks')
      .where('createdAt', '>=', rangeStart)
      .where('createdAt', '<', rangeEnd)
      .get(),
    adminDb.collection('commercialAccounts').where('active', '==', true).get(),
  ]);

  const cells = new Map<string, Agg>(); // key = siteId|dateKey
  const cellFor = (siteId: string, dateKey: string): Agg => {
    const key = `${siteId}|${dateKey}`;
    let c = cells.get(key);
    if (!c) {
      c = {
        binCount: 0,
        fullnessSum: 0,
        fullnessCount: 0,
        weightLbs: 0,
        pickups: 0,
        skipped: false,
        hasCheck: false,
      };
      cells.set(key, c);
    }
    return c;
  };

  for (const d of pickupsSnap.docs) {
    const p = d.data() as BinPickupDoc;
    const date = p.createdAt?.toDate?.();
    if (!date || typeof p.commercialAccountId !== 'string') continue;
    const c = cellFor(p.commercialAccountId, columbusDateKey(date));
    c.pickups += 1;
    c.weightLbs += p.totalWeightLbs ?? 0;
    if (p.action === 'skipped') c.skipped = true;
    for (const b of Array.isArray(p.bins) ? p.bins : []) {
      c.binCount += 1;
      if (typeof b.fullness === 'number') {
        c.fullnessSum += b.fullness;
        c.fullnessCount += 1;
      }
    }
  }
  for (const d of checksSnap.docs) {
    const c = d.data() as SiteCheckDoc;
    const date = c.createdAt?.toDate?.();
    if (!date || typeof c.commercialAccountId !== 'string') continue;
    cellFor(c.commercialAccountId, columbusDateKey(date)).hasCheck = true;
  }

  const accounts = accountsSnap.docs.map((d) => d.data() as CommercialAccountDoc);
  const dateKeys = dateKeysInRange(from, to);

  const rows: AppLedgerRow[] = [];
  for (const a of accounts) {
    for (const dateKey of dateKeys) {
      const agg = cells.get(`${a.id}|${dateKey}`);
      const recorded = !!agg && (agg.pickups > 0 || agg.hasCheck);
      const weekday = weekdayFromDateKey(dateKey);
      const scheduled =
        a.status !== 'paused' &&
        Array.isArray(a.collectionDays) &&
        a.collectionDays.includes(weekday);
      if (!recorded && !scheduled) continue;
      rows.push({
        siteId: a.id,
        siteName: a.businessName,
        dateKey,
        recorded,
        scheduledMissing: scheduled && !recorded,
        pickups: agg?.pickups ?? 0,
        binCount: agg?.binCount ?? 0,
        fullnessAvg:
          agg && agg.fullnessCount > 0 ? agg.fullnessSum / agg.fullnessCount : null,
        weightLbs: Math.round(agg?.weightLbs ?? 0),
        skipped: agg?.skipped ?? false,
      });
    }
  }
  return rows;
}

export default async function CompostReconcilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromParam, to: toParam } = await searchParams;
  const now = new Date();
  const def = defaultRange(now);
  const isKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = isKey(fromParam) ? fromParam : def.from;
  const to = isKey(toParam) && toParam >= from ? toParam : def.to >= from ? def.to : from;

  const ledger = await loadLedger(from, to);
  const todayKey = columbusDateKey(now);

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Compost · Tia
            </span>
          </div>
          <Link
            href="/admin/compost/routes"
            className="text-[11px] font-semibold text-blue-300 underline hover:text-blue-200"
          >
            ← Route runs
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Weekly reconciliation</h1>
        <p className="mt-1 max-w-2xl text-xs text-gray-500">
          Cross-check what the app recorded against the operations sheet. Pick a week, paste the
          sheet, and the app flags bin-count and fullness differences plus anything recorded on only
          one side — the weekly check that catches input slips like the Reynoldsburg 5-vs-4.
        </p>
      </header>

      <ReconcileClient
        ledger={ledger}
        from={from}
        to={to}
        defaultYear={Number(from.slice(0, 4))}
        todayKey={todayKey}
      />
    </div>
  );
}
