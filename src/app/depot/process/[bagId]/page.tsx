import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import type { BagDoc } from '@/lib/types/bag';
import type { PickupDoc } from '@/lib/types/pickup';
import type { RouteDoc } from '@/lib/types/route';
import type { UserDoc } from '@/lib/types/user';
import {
  MATERIAL_IDS,
  type MaterialDoc,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import { ProcessBagForm, type ProcessBagFormProps } from './ProcessBagForm';

export const dynamic = 'force-dynamic';

export default async function ProcessBagPage({
  params,
}: {
  params: Promise<{ bagId: string }>;
}) {
  const session = await requireRole('depot_worker');
  const { bagId } = await params;

  const depotRes = await loadDepotContext(session.uid);
  if (!depotRes.ok) notFound();

  const bagSnap = await adminDb.collection('bags').doc(bagId).get();
  if (!bagSnap.exists) notFound();
  const bag = bagSnap.data() as BagDoc;

  if (bag.status === 'processed') {
    return (
      <section className="mt-6 space-y-4">
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
          <div className="text-3xl">✅</div>
          <div className="mt-1 text-sm font-semibold text-white">
            Bag #{bag.printedNumber} already processed
          </div>
        </div>
        <Link
          href="/depot/incoming"
          className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-gray-200"
        >
          Back to incoming
        </Link>
      </section>
    );
  }

  if (bag.status !== 'picked_up') {
    notFound();
  }

  // Find the pickup that carries this bag on a completed route in the depot's zones.
  const pickupSnap = await adminDb
    .collection('pickups')
    .where('bagId', '==', bag.id)
    .where('status', '==', 'completed')
    .limit(1)
    .get();
  if (pickupSnap.empty) notFound();
  const pickup = pickupSnap.docs[0].data() as PickupDoc;
  if (!pickup.routeId) notFound();

  const routeSnap = await adminDb.collection('routes').doc(pickup.routeId).get();
  if (!routeSnap.exists) notFound();
  const route = routeSnap.data() as RouteDoc;
  if (!depotRes.context.depot.zoneIds.includes(route.zoneId)) notFound();

  if (!bag.residentId) notFound();
  const [residentSnap, materialSnaps] = await Promise.all([
    adminDb.collection('users').doc(bag.residentId).get(),
    adminDb.getAll(...MATERIAL_IDS.map((id) => adminDb.collection('materials').doc(id))),
  ]);
  if (!residentSnap.exists) notFound();
  const resident = residentSnap.data() as UserDoc;

  const materials = {} as Record<MaterialId, MaterialPricing>;
  materialSnaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const doc = snap.data() as MaterialDoc;
    materials[MATERIAL_IDS[i]] = {
      marketPrice: doc.marketPrice,
      customerPct: doc.customerPct,
    };
  });
  for (const id of MATERIAL_IDS) {
    if (!materials[id]) notFound();
  }

  const props: ProcessBagFormProps = {
    bagId: bag.id,
    printedNumber: bag.printedNumber,
    residentName: resident.name,
    declaredType: bag.declaredType,
    separated: bag.declaredType === 'separated',
    materials,
    returnHref: `/depot/incoming/${route.id}`,
  };

  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
            Process bag
          </div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">
            #{bag.printedNumber}
          </h1>
        </div>
        <Link
          href={`/depot/incoming/${route.id}`}
          className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
        >
          ← Back
        </Link>
      </div>
      <ProcessBagForm {...props} />
    </section>
  );
}
