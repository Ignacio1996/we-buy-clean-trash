import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { RouteDoc } from '@/lib/types/route';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { UserDoc } from '@/lib/types/user';
import { SS } from '@/components/resident/ss/SS';
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
      {/* Back row */}
      <div style={{ background: '#fff', padding: '14px 20px 0' }}>
        <Link
          href="/depot/incoming"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            color: SS.ink,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900 }}>←</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: SS.inkSoft,
            }}
          >
            Queue
          </span>
        </Link>
      </div>

      {/* Yellow hero — route + progress */}
      <div
        style={{
          background: SS.yellow,
          padding: '20px 20px 22px',
          marginTop: 14,
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
          Route · {operatorLabel}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 1,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          {processedCount} / {rows.length}
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
          bags processed
        </div>
        {rows.length > 0 && (
          <div
            style={{
              marginTop: 14,
              height: 8,
              borderRadius: 999,
              background: '#fff',
              border: `2px solid ${SS.ink}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: SS.brand,
              }}
            />
          </div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '18px 20px 28px' }}>
        {rows.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: `2px dashed ${SS.ink}`,
              borderRadius: 16,
              padding: '28px 18px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: -0.4,
                color: SS.ink,
              }}
            >
              No completed pickups.
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: SS.inkSoft,
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              This route closed without any bags collected.
            </div>
          </div>
        ) : (
          <RouteBagsClient rows={rows} />
        )}
      </div>
    </section>
  );
}
