import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import { RouteBagsClient, type RouteBagRow } from './RouteBagsClient';

export const dynamic = 'force-dynamic';

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const session = await requireRole('depot_worker');
  const { routeId } = await params;

  const depotRes = await loadDepotContext(session.uid);
  if (!depotRes.ok) notFound();

  const routeSnap = await adminDb.collection('routes').doc(routeId).get();
  if (!routeSnap.exists) notFound();
  const route = routeSnap.data() as RouteDoc;

  if (!depotRes.context.depot.zoneIds.includes(route.zoneId)) notFound();
  if (route.status !== 'completed') notFound();

  const pickupIds = route.orderedStops.map((s) => s.pickupId);
  const pickupSnaps = pickupIds.length
    ? await adminDb.getAll(...pickupIds.map((id) => adminDb.collection('pickups').doc(id)))
    : [];
  const completedPickups = pickupSnaps
    .filter((s) => s.exists)
    .map((s) => s.data() as PickupDoc)
    .filter((p) => p.status === 'completed');

  const bagIds = completedPickups.map((p) => p.bagId);
  const residentIds = Array.from(new Set(completedPickups.map((p) => p.residentId)));

  const [bagSnaps, residentSnaps] = await Promise.all([
    bagIds.length
      ? adminDb.getAll(...bagIds.map((id) => adminDb.collection('bags').doc(id)))
      : Promise.resolve([]),
    residentIds.length
      ? adminDb.getAll(...residentIds.map((id) => adminDb.collection('users').doc(id)))
      : Promise.resolve([]),
  ]);

  const residentMap = new Map<string, UserDoc>();
  residentSnaps.forEach((s) => {
    if (s.exists) residentMap.set(s.id, s.data() as UserDoc);
  });
  const bagMap = new Map<string, BagDoc>();
  bagSnaps.forEach((s) => {
    if (s.exists) bagMap.set(s.id, s.data() as BagDoc);
  });

  const rows: RouteBagRow[] = completedPickups
    .map((p): RouteBagRow | null => {
      const bag = bagMap.get(p.bagId);
      if (!bag) return null;
      const resident = residentMap.get(p.residentId);
      return {
        bagId: bag.id,
        printedNumber: bag.printedNumber,
        qrCode: bag.qrCode,
        residentName: resident?.name ?? 'Resident',
        declaredType: bag.declaredType,
        status: bag.status,
      };
    })
    .filter((r): r is RouteBagRow => r !== null)
    .sort((a, b) => a.printedNumber.localeCompare(b.printedNumber));

  const processedCount = rows.filter((r) => r.status === 'processed').length;

  const operatorLabel = route.operatorId
    ? ((await adminDb.collection('users').doc(route.operatorId).get()).data() as UserDoc | undefined)
        ?.name ?? 'Operator'
    : 'Operator';

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
            Route detail
          </div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">{operatorLabel}</h1>
          <div className="mt-0.5 text-xs text-gray-400">
            {processedCount}/{rows.length} bags processed
          </div>
        </div>
        <Link
          href="/depot/incoming"
          className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
        >
          ← Back
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
          This route has no completed pickups.
        </div>
      ) : (
        <RouteBagsClient rows={rows} />
      )}
    </section>
  );
}
