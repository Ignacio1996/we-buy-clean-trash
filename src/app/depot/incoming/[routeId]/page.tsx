import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import {
  DP_TOK,
  DpBackRow,
  DpEmpty,
  DpMasthead,
  DpProgressBar,
} from '@/components/depot/Dp';
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

  const pickupIds = route.orderedStops
    .map((s) => s.pickupId)
    .filter((id): id is string => id !== null);
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
  const progressPct =
    rows.length > 0 ? Math.round((processedCount / rows.length) * 100) : 0;

  const operatorLabel = route.operatorId
    ? ((await adminDb.collection('users').doc(route.operatorId).get()).data() as UserDoc | undefined)
        ?.name ?? 'Operator'
    : 'Operator';

  return (
    <section>
      <DpBackRow label="Incoming" href="/depot/incoming" />

      <DpMasthead
        eyebrow="Route detail"
        title={
          <>
            <em style={{ color: DP_TOK.green, fontStyle: 'italic' }}>
              {operatorLabel}
            </em>
            &rsquo;s haul.
          </>
        }
      >
        <div
          className="mt-2"
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 13,
            color: DP_TOK.inkSoft,
          }}
        >
          {processedCount}/{rows.length} bags processed
        </div>
        {rows.length > 0 && (
          <div className="mt-2">
            <DpProgressBar pct={progressPct} tone="green" />
          </div>
        )}
      </DpMasthead>

      {rows.length === 0 ? (
        <DpEmpty
          title="No completed pickups."
          body="This route closed without any bags collected."
        />
      ) : (
        <RouteBagsClient rows={rows} />
      )}
    </section>
  );
}
