import Link from 'next/link';
import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc } from '@/lib/types/user';
import { CompleteRouteButton } from './CompleteRouteButton';

export const dynamic = 'force-dynamic';

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

async function loadRouteForSummary(operatorUid: string) {
  const snap = await adminDb
    .collection('routes')
    .where('operatorId', '==', operatorUid)
    .where('date', '>=', startOfToday())
    .get();
  if (snap.empty) return null;
  // When the operator gets a second route the same day (after finishing the
  // first), there are multiple matches. Prefer the active one — that's the one
  // they need to close out — over a completed route from earlier today.
  const priority: Record<RouteDoc['status'], number> = {
    in_progress: 0,
    assigned: 1,
    completed: 2,
    draft: 3,
  };
  const routes = snap.docs.map((d) => d.data() as RouteDoc);
  routes.sort((a, b) => {
    const p = priority[a.status] - priority[b.status];
    if (p !== 0) return p;
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
  return routes[0];
}

export default async function OperatorSummaryPage() {
  const session = await requireRole('operator');
  const route = await loadRouteForSummary(session.uid);

  if (!route) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
        <Link href="/operator" className="text-xs text-gray-400 underline">
          ← Back
        </Link>
        <p className="mt-6 text-sm text-gray-400">No route to summarize.</p>
      </main>
    );
  }

  const pickupIds = route.orderedStops
    .map((s) => s.pickupId)
    .filter((id): id is string => id !== null);
  const [pickupSnaps, bagOrderSnaps] = await Promise.all([
    pickupIds.length
      ? adminDb.getAll(...pickupIds.map((id) => adminDb.collection('pickups').doc(id)))
      : Promise.resolve([]),
    route.bagOrdersToDeliver.length
      ? adminDb.getAll(
          ...route.bagOrdersToDeliver.map((id) => adminDb.collection('bagOrders').doc(id)),
        )
      : Promise.resolve([]),
  ]);
  const pickups = pickupSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as PickupDoc);
  const bagOrders = bagOrderSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as BagOrderDoc);

  const completed = pickups.filter((p) => p.status === 'completed').length;
  const missed = pickups.filter((p) => p.status === 'missed').length;
  const issues = pickups.filter((p) => p.status === 'issue');
  const bagsDelivered = bagOrders.filter((o) => o.status === 'delivered').length;
  const stopsTotal = new Set(pickups.map((p) => p.addressId)).size;

  // Look up addresses for issues to render human labels.
  const addressIds = [...new Set(issues.map((i) => i.addressId))];
  const addressSnaps = addressIds.length
    ? await adminDb.getAll(...addressIds.map((id) => adminDb.collection('addresses').doc(id)))
    : [];
  const addressMap = new Map<string, AddressDoc>();
  addressSnaps.forEach((s) => {
    if (s.exists) addressMap.set(s.id, s.data() as AddressDoc);
  });

  const alreadyDone = route.status === 'completed';

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <Link href="/operator" className="text-xs text-gray-400 underline">
        ← Back to route
      </Link>
      <header className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">End of route</div>
        <h1 className="mt-1 text-lg font-semibold text-white">
          Route {alreadyDone ? 'summary' : 'complete 🎉'}
        </h1>
      </header>

      {pickups.length > 0 && (
        <section className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Stops" value={String(stopsTotal)} />
          <Stat label="Bags" value={String(completed)} />
          <Stat label="Missed" value={String(missed)} tone={missed > 0 ? 'warn' : 'default'} />
          <Stat
            label="Issues"
            value={String(issues.length)}
            tone={issues.length > 0 ? 'danger' : 'default'}
          />
        </section>
      )}

      {route.bagOrdersToDeliver.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Deliveries</div>
          <div className="mt-1 text-white">
            {bagsDelivered} of {route.bagOrdersToDeliver.length} bag order
            {route.bagOrdersToDeliver.length === 1 ? '' : 's'} fulfilled
          </div>
        </section>
      )}

      {issues.length > 0 && (
        <section className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-red-300">Issues flagged</div>
          <ul className="mt-2 space-y-2">
            {issues.map((p) => {
              const a = addressMap.get(p.addressId);
              return (
                <li key={p.id} className="text-xs">
                  <div className="text-white">
                    {a ? `${a.street}${a.unit ? ` · Unit ${a.unit}` : ''}` : p.addressId}
                  </div>
                  <div className="text-red-200/80">
                    {p.issue ?? 'other'}
                    {p.issueNote ? ` — ${p.issueNote}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!alreadyDone ? (
        <CompleteRouteButton routeId={route.id} hasPickups={pickups.length > 0} />
      ) : (
        <p className="mt-6 text-center text-xs text-gray-500">
          Route was closed on{' '}
          {route.completedAt
            ? route.completedAt.toDate().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '—'}
          .
        </p>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const accent =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-white/10 bg-white/5 text-white';
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${accent}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}
