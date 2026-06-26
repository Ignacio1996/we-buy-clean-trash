import Link from 'next/link';
import {
  Building2,
  Route,
  ClipboardList,
  SprayCan,
  BarChart3,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { adminDb } from '@/lib/firebase/admin';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { SiteCheckDoc } from '@/lib/types/siteCheck';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import {
  columbusDateKey,
  columbusDateLabel,
  columbusDayStart,
  columbusWeekStart,
  columbusWeekStartKey,
  weekdayFromDateKey,
} from '@/lib/logic/columbusDate';
import { dayRunId } from '@/lib/logic/compostDay';

interface CompostToday {
  weekdayLabel: string;
  dateLabel: string;
  runsThisWeek: number;
  weightThisWeek: number;
  scheduledToday: number;
  missed: { id: string; name: string }[];
  activeSites: number;
  cleaningSites: number;
}

async function loadToday(): Promise<CompostToday> {
  const now = new Date();
  const todayKey = columbusDateKey(now);
  const weekday = weekdayFromDateKey(todayKey);
  const weekStart = columbusWeekStart(now);

  // Pull the whole week of activity, then derive both the week totals and
  // today's "recorded" set (for the missed-sites check) from it.
  const [accountsSnap, pickupsSnap, checksSnap, cleaningSnap] = await Promise.all([
    adminDb.collection('commercialAccounts').where('active', '==', true).get(),
    adminDb.collection('binPickups').where('createdAt', '>=', weekStart).get(),
    adminDb.collection('siteChecks').where('createdAt', '>=', weekStart).get(),
    adminDb.collection('cleaningTickets').where('status', '==', 'open').get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => d.data() as CommercialAccountDoc);
  const pickups = pickupsSnap.docs.map((d) => d.data() as BinPickupDoc);
  const checks = checksSnap.docs.map((d) => d.data() as SiteCheckDoc);

  const recordedToday = new Set<string>();
  const runDaysThisWeek = new Set<string>();
  let weightThisWeek = 0;
  for (const p of pickups) {
    const date = p.createdAt?.toDate?.();
    if (!date) continue;
    const dk = columbusDateKey(date);
    runDaysThisWeek.add(dayRunId(p.operatorId, dk));
    weightThisWeek += typeof p.totalWeightLbs === 'number' ? p.totalWeightLbs : 0;
    if (dk === todayKey) recordedToday.add(p.commercialAccountId);
  }
  for (const c of checks) {
    const date = c.createdAt?.toDate?.();
    if (!date) continue;
    const dk = columbusDateKey(date);
    runDaysThisWeek.add(dayRunId(c.operatorId, dk));
    if (dk === todayKey) recordedToday.add(c.commercialAccountId);
  }

  const scheduled = accounts.filter(
    (a) =>
      a.status !== 'paused' &&
      Array.isArray(a.collectionDays) &&
      a.collectionDays.includes(weekday),
  );
  const missed = scheduled
    .filter((a) => !recordedToday.has(a.id))
    .map((a) => ({ id: a.id, name: a.businessName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cleaningSites = new Set(cleaningSnap.docs.map((d) => d.get('commercialAccountId'))).size;

  return {
    weekdayLabel: COLLECTION_DAY_LABELS[weekday],
    dateLabel: columbusDateLabel(now),
    runsThisWeek: runDaysThisWeek.size,
    weightThisWeek: Math.round(weightThisWeek),
    scheduledToday: scheduled.length,
    missed,
    activeSites: accounts.filter((a) => a.status !== 'paused').length,
    cleaningSites,
  };
}

interface WeekBar {
  key: string;
  label: string;
  weightLbs: number;
  isCurrent: boolean;
}

/**
 * Weight diverted (bin pickups only, matching "Weight this week") bucketed by
 * Columbus-local week for the last 4 weeks — oldest first, current week last and
 * partial. Buckets by each pickup's own week-start so a run is always counted in
 * the week it happened.
 */
async function loadWeeklyWeights(now: Date): Promise<WeekBar[]> {
  const [y, m, d] = columbusWeekStartKey(now).split('-').map(Number);
  // Mondays for the last 4 weeks (3 weeks ago … this week), oldest first.
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const monday = new Date(Date.UTC(y, m - 1, d - 7 * (3 - i), 12));
    return { key: columbusDateKey(monday), monday };
  });

  const windowStart = columbusDayStart(weeks[0].monday);
  const snap = await adminDb.collection('binPickups').where('createdAt', '>=', windowStart).get();

  const totals = new Map<string, number>();
  for (const doc of snap.docs) {
    const p = doc.data() as BinPickupDoc;
    const date = p.createdAt?.toDate?.();
    if (!date) continue;
    const wk = columbusWeekStartKey(date);
    const w = typeof p.totalWeightLbs === 'number' ? p.totalWeightLbs : 0;
    totals.set(wk, (totals.get(wk) ?? 0) + w);
  }

  const labelFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
  return weeks.map((wk, i) => ({
    key: wk.key,
    label: labelFmt.format(wk.monday),
    weightLbs: Math.round(totals.get(wk.key) ?? 0),
    isCurrent: i === weeks.length - 1,
  }));
}

const SECTIONS: { href: string; icon: LucideIcon; label: string; desc: string }[] = [
  {
    href: '/admin/compost/routes',
    icon: Route,
    label: 'Route runs',
    desc: "Each driver's day, built live from the stops they record.",
  },
  {
    href: '/admin/commercial-accounts',
    icon: Building2,
    label: 'Commercial sites',
    desc: 'The site directory — schedule, bins, route order, and QR bins.',
  },
  {
    href: '/admin/compost/pickups',
    icon: ClipboardList,
    label: 'Recorded pickups',
    desc: 'Every bin pickup and recycling check, newest first.',
  },
  {
    href: '/admin/compost/cleaning',
    icon: SprayCan,
    label: 'Cleaning queue',
    desc: 'Sites a driver flagged for cart cleaning.',
  },
  {
    href: '/admin/compost/reports',
    icon: BarChart3,
    label: 'Diversion reports',
    desc: 'Monthly weight diverted, by site and affiliation.',
  },
  {
    href: '/admin/compost/destinations',
    icon: MapPin,
    label: 'Drop-off destinations',
    desc: 'Composting facilities and their on-the-way alerts.',
  },
];

export default async function CompostHomePage() {
  const [today, weeklyWeights] = await Promise.all([loadToday(), loadWeeklyWeights(new Date())]);

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Compost · Tia
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Compost</h1>
        <p className="mt-1 text-xs text-gray-500">
          Tia&apos;s food-scrap collection — sites, route runs, and diversion reporting, kept
          separate from the recycling program. {today.dateLabel}.
        </p>
      </header>

      {/* Today at a glance */}
      <section className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Runs this week"
            value={String(today.runsThisWeek)}
            viewHref="/admin/compost/routes"
          />
          <StatCard
            label="Weight this week"
            value={`${today.weightThisWeek.toLocaleString()} lbs`}
          />
          <StatCard
            label={`Scheduled ${today.weekdayLabel}`}
            value={String(today.scheduledToday)}
          />
          <StatCard
            label="To clean"
            value={String(today.cleaningSites)}
            href="/admin/compost/cleaning"
            tone={today.cleaningSites > 0 ? 'amber' : 'default'}
          />
        </div>
      </section>

      {/* Weight diverted — last 4 weeks */}
      <WeeklyWeightChart weeks={weeklyWeights} />

      {today.missed.length > 0 && (
        <Link
          href="/admin/compost/routes"
          className="mb-6 block rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 transition-colors hover:bg-amber-500/15"
        >
          <div className="text-xs font-semibold text-amber-200">
            ⚠ {today.missed.length} site{today.missed.length === 1 ? '' : 's'} scheduled{' '}
            {today.weekdayLabel} not yet recorded
          </div>
          <div className="mt-1 text-[11px] text-amber-200/70">
            {today.missed.map((m) => m.name).join(', ')} — open Route runs to verify.
          </div>
        </Link>
      )}

      {/* Manage */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Manage</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => {
            const badge =
              s.href === '/admin/commercial-accounts'
                ? `${today.activeSites} active`
                : s.href === '/admin/compost/cleaning' && today.cleaningSites > 0
                  ? `${today.cleaningSites} open`
                  : null;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between gap-2">
                  <s.icon
                    className="h-5 w-5 text-emerald-300/80"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {badge && (
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-gray-400">
                      {badge}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold text-white group-hover:text-white">
                  {s.label}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">{s.desc}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Simple CSS bar chart of weekly diverted weight — no chart lib, server-rendered. */
function WeeklyWeightChart({ weeks }: { weeks: WeekBar[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.weightLbs));
  const total = weeks.reduce((sum, w) => sum + w.weightLbs, 0);

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Weight diverted — last 4 weeks
      </h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        {total === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No bin pickups recorded in the last 4 weeks.
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {weeks.map((w) => {
                // Cap at 88% so the value label above the bar always has headroom.
                const pct = (w.weightLbs / max) * 88;
                return (
                  <div
                    key={w.key}
                    className="flex flex-1 flex-col items-center justify-end"
                    style={{ height: '100%' }}
                  >
                    <div className="mb-1 text-[11px] font-semibold tabular-nums text-white">
                      {w.weightLbs.toLocaleString()}
                    </div>
                    <div
                      className={`w-full rounded-t-md ${
                        w.isCurrent ? 'bg-emerald-400' : 'bg-emerald-500/40'
                      }`}
                      style={{ height: `${w.weightLbs > 0 ? Math.max(pct, 2) : 0}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-3">
              {weeks.map((w) => (
                <div
                  key={w.key}
                  className={`flex-1 text-center text-[11px] ${
                    w.isCurrent ? 'font-semibold text-emerald-300' : 'text-gray-500'
                  }`}
                >
                  {w.isCurrent ? 'This wk' : w.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-gray-600">
        lbs of food scrap diverted per week (bin pickups). This week is still in progress.
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
  viewHref,
  tone = 'default',
}: {
  label: string;
  value: string;
  href?: string;
  /** Renders a small "View" link inside the card (kept separate so the card itself isn't a link). */
  viewHref?: string;
  tone?: 'default' | 'amber';
}) {
  const className = `rounded-xl border p-3 ${
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10'
      : 'border-emerald-500/20 bg-emerald-500/5'
  } ${href ? 'transition-colors hover:bg-white/10' : ''}`;
  const body = (
    <>
      <div
        className={`text-[10px] uppercase tracking-wide ${
          tone === 'amber' ? 'text-amber-300/80' : 'text-emerald-300/70'
        }`}
      >
        {label}
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <div className="text-lg font-semibold text-white">{value}</div>
        {viewHref && (
          <Link
            href={viewHref}
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            View
          </Link>
        )}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
