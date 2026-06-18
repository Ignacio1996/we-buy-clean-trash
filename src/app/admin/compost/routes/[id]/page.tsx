import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';
import type { CompostRouteDoc } from '@/lib/types/compostRoute';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import { COMPOST_SKIP_REASON_LABELS } from '@/lib/types/binPickup';
import type { SiteCheckDoc } from '@/lib/types/siteCheck';
import { CART_STATUS_LABELS } from '@/lib/types/siteCheck';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import type { UserDoc } from '@/lib/types/user';
import { BIN_DISPLAY_NAMES } from '@/lib/logic/binWeightTable';
import { columbusDateLabel, columbusTimeLabel } from '@/lib/logic/columbusDate';
import { DeleteRunButton } from './DeleteRunButton';

const FULLNESS_PCT: Record<number, string> = {
  0: 'Empty',
  0.25: '¼',
  0.5: '½',
  0.75: '¾',
  1: 'Full',
};

const CONTAM_LABELS: Record<string, string> = {
  none: 'None',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
};

interface StopView {
  id: string;
  siteName: string;
  timeLabel: string | null;
  action: BinPickupDoc['action'];
  skipReason: string | null;
  binsLabel: string;
  totalWeightLbs: number;
  contamination: string;
  needsCleaning: boolean;
  damaged: boolean;
  driverNotes: string | null;
  photoUrl: string | null;
}

export default async function CompostRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const routeSnap = await adminDb.collection('compostRoutes').doc(id).get();
  if (!routeSnap.exists) notFound();
  const route = routeSnap.data() as CompostRouteDoc;

  const [pickupsSnap, checksSnap] = await Promise.all([
    adminDb.collection('binPickups').where('routeId', '==', id).get(),
    adminDb.collection('siteChecks').where('routeId', '==', id).get(),
  ]);
  const pickups = pickupsSnap.docs
    .map((d) => d.data() as BinPickupDoc)
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  const checks = checksSnap.docs
    .map((d) => d.data() as SiteCheckDoc)
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

  // Resolve site + operator names in batches.
  const siteIds = [
    ...new Set([
      ...pickups.map((p) => p.commercialAccountId),
      ...checks.map((c) => c.commercialAccountId),
    ]),
  ];
  const siteNames = new Map<string, string>();
  if (siteIds.length > 0) {
    const siteSnaps = await adminDb.getAll(
      ...siteIds.map((sid) => adminDb.collection('commercialAccounts').doc(sid)),
    );
    for (const s of siteSnaps) {
      if (s.exists) siteNames.set(s.id, (s.data() as CommercialAccountDoc).businessName);
    }
  }
  const operatorSnap = await adminDb.collection('users').doc(route.operatorId).get();
  const operatorName = operatorSnap.exists
    ? (operatorSnap.data() as UserDoc).name ||
      (operatorSnap.data() as UserDoc).email ||
      route.operatorId
    : route.operatorId;

  const startedAt = route.startedAt?.toDate?.() ?? null;
  const endedAt = route.endedAt?.toDate?.() ?? null;
  const dateLabel = startedAt ? columbusDateLabel(startedAt) : route.date;

  const stops: StopView[] = pickups.map((p) => ({
    id: p.id,
    siteName: siteNames.get(p.commercialAccountId) ?? p.commercialAccountId,
    timeLabel: p.createdAt?.toDate ? columbusTimeLabel(p.createdAt.toDate()) : null,
    action: p.action,
    skipReason: p.skipReason ? (COMPOST_SKIP_REASON_LABELS[p.skipReason] ?? p.skipReason) : null,
    binsLabel:
      p.bins.length > 0
        ? p.bins
            .map((b) => `${BIN_DISPLAY_NAMES[b.binSize]} · ${FULLNESS_PCT[b.fullness] ?? b.fullness}`)
            .join(', ')
        : '—',
    totalWeightLbs: p.totalWeightLbs,
    contamination: CONTAM_LABELS[p.contaminationSeverity] ?? p.contaminationSeverity,
    needsCleaning: p.needsCleaning,
    damaged: p.damaged,
    driverNotes: p.driverNotes,
    photoUrl: p.photoUrl,
  }));

  const checkViews = checks.map((c) => ({
    id: c.id,
    siteName: siteNames.get(c.commercialAccountId) ?? c.commercialAccountId,
    timeLabel: c.createdAt?.toDate ? columbusTimeLabel(c.createdAt.toDate()) : null,
    cartStatus: CART_STATUS_LABELS[c.cartStatus] ?? c.cartStatus,
    skipped: c.cartStatus === 'skipped',
    contamination: CONTAM_LABELS[c.contaminationSeverity] ?? c.contaminationSeverity,
    overflow: c.overflow,
    driverNotes: c.driverNotes,
    photoUrl: c.photoUrl,
  }));

  const s = route.summary;

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/admin/compost/routes"
          className="text-[11px] text-gray-500 hover:text-gray-300"
        >
          ← All runs
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{dateLabel}</h1>
            <p className="mt-1 text-xs text-gray-500">
              {operatorName} · {startedAt ? columbusTimeLabel(startedAt) : '—'}
              {endedAt ? ` – ${columbusTimeLabel(endedAt)}` : ''} ·{' '}
              {route.status === 'completed' ? 'Completed' : 'In progress'}
            </p>
          </div>
          <DeleteRunButton routeId={route.id} stops={stops.length} />
        </div>

        {s && (
          <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
            <Stat label="Stops" value={String(s.stops)} />
            <Stat label="Skipped" value={String(s.skipped)} />
            <Stat label="Carts swapped" value={String(s.cartsSwapped)} />
            <Stat label="Weight" value={`${s.totalWeightLbs.toLocaleString()} lbs`} />
            <Stat label="To clean" value={String(s.needsCleaning)} />
            <Stat label="Damaged" value={String(s.damaged)} />
          </div>
        )}
      </header>

      {stops.length === 0 && checkViews.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          No stops recorded on this run.
        </div>
      ) : (
        <div className="space-y-2">
          {stops.map((stop) => (
            <div
              key={stop.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{stop.siteName}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">{stop.timeLabel ?? '—'}</div>
                </div>
                {stop.action === 'skipped' ? (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                    Skipped{stop.skipReason ? ` · ${stop.skipReason}` : ''}
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Collected · {stop.totalWeightLbs.toLocaleString()} lbs
                  </span>
                )}
              </div>

              {stop.action !== 'skipped' && (
                <div className="mt-2 text-[12px] text-gray-300">
                  <span className="text-gray-500">Bins:</span> {stop.binsLabel}
                  <span className="ml-3 text-gray-500">Contamination:</span> {stop.contamination}
                </div>
              )}

              {(stop.needsCleaning || stop.damaged) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stop.needsCleaning && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      🧼 Needs cleaning
                    </span>
                  )}
                  {stop.damaged && (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      🛠️ Damaged
                    </span>
                  )}
                </div>
              )}

              {stop.driverNotes && (
                <div className="mt-2 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-gray-400">
                  {stop.driverNotes}
                </div>
              )}

              {stop.photoUrl && (
                <a
                  href={stop.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[11px] text-blue-300 underline hover:text-blue-200"
                >
                  View photo
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {checkViews.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-300/70">
            Recycling checks
          </h2>
          <div className="space-y-2">
            {checkViews.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{c.siteName}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">{c.timeLabel ?? '—'}</div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.skipped
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    {c.cartStatus}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-gray-300">
                  <span className="text-gray-500">Contamination:</span> {c.contamination}
                  {c.overflow && <span className="ml-3 text-amber-300">🗑️ Overflowing</span>}
                </div>
                {c.driverNotes && (
                  <div className="mt-2 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-gray-400">
                    {c.driverNotes}
                  </div>
                )}
                {c.photoUrl && (
                  <a
                    href={c.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[11px] text-blue-300 underline hover:text-blue-200"
                  >
                    View photo
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-gray-200">{value}</div>
    </div>
  );
}
