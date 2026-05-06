import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadDepotContext } from '@/lib/auth/depotAccess';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { buildMaterialMultipliers } from '@/lib/types/pricingCampaign';
import type { BagDoc } from '@/lib/types/bag';
import type { PickupDoc } from '@/lib/types/pickup';
import type { RouteDoc } from '@/lib/types/route';
import type { UserDoc } from '@/lib/types/user';
import type { MaterialId, MaterialPricing } from '@/lib/types/material';
import { resolveAcceptedMaterials } from '@/lib/types/depot';
import {
  DP_TOK,
  DpAlert,
  DpBackRow,
  DpMasthead,
  DpPrimaryButton,
} from '@/components/depot/Dp';
import { IconCheck } from '@/components/icons/EcoIcons';
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
      <section className="space-y-5">
        <DpBackRow label="Incoming" href="/depot/incoming" />
        <div
          className="px-5 py-7 text-center"
          style={{
            background: DP_TOK.greenSoft,
            border: `1px solid rgba(45,90,61,0.3)`,
            borderRadius: 14,
          }}
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: DP_TOK.green }}
          >
            <IconCheck size={20} color={DP_TOK.paper} stroke={2.5} />
          </div>
          <div
            style={{
              fontFamily: DP_TOK.serif,
              fontSize: 18,
              color: DP_TOK.ink,
              letterSpacing: -0.3,
            }}
          >
            Bag #{bag.printedNumber} already processed.
          </div>
        </div>
        <DpPrimaryButton href="/depot/incoming">Back to incoming</DpPrimaryButton>
      </section>
    );
  }

  if (bag.status !== 'picked_up') {
    notFound();
  }

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
  const [residentSnap, allMaterials, activeCampaigns] = await Promise.all([
    adminDb.collection('users').doc(bag.residentId).get(),
    loadActiveMaterials(),
    loadActiveCampaigns(),
  ]);
  if (!residentSnap.exists) notFound();
  const resident = residentSnap.data() as UserDoc;

  const allMaterialIds = allMaterials.map((m) => m.id);
  const accepted = new Set(
    resolveAcceptedMaterials(depotRes.context.depot, allMaterialIds),
  );
  const visibleMaterials = allMaterials.filter((m) => accepted.has(m.id));
  if (visibleMaterials.length === 0) {
    return (
      <section className="space-y-5">
        <DpBackRow label="Incoming" href="/depot/incoming" />
        <DpAlert tone="rust">
          This depot has no accepted materials configured. Ask an admin to enable
          materials on Zones &amp; Depots before processing.
        </DpAlert>
      </section>
    );
  }

  const materials: Record<MaterialId, MaterialPricing> = {};
  for (const m of visibleMaterials) {
    materials[m.id] = { marketPrice: m.marketPrice, customerPct: m.customerPct };
  }

  const liveCampaigns = activeCampaigns.filter((c) => c.startsAt <= new Date());
  const materialMultipliers = buildMaterialMultipliers(liveCampaigns);

  const props: ProcessBagFormProps = {
    bagId: bag.id,
    printedNumber: bag.printedNumber,
    residentName: resident.name,
    declaredType: bag.declaredType,
    separated: bag.declaredType === 'separated',
    materials,
    materialList: visibleMaterials.map((m) => ({ id: m.id, name: m.name })),
    materialMultipliers,
    activeCampaignNotices: liveCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      multiplier: c.multiplier,
      materialNames: c.materialIds
        .map((id) => visibleMaterials.find((m) => m.id === id)?.name ?? id),
    })),
    returnHref: `/depot/incoming/${route.id}`,
  };

  return (
    <section>
      <DpBackRow label={`Route — ${route.id.slice(0, 6)}`} href={`/depot/incoming/${route.id}`} />
      <DpMasthead
        eyebrow="Process bag"
        title={
          <>
            Bag{' '}
            <em
              style={{
                color: DP_TOK.green,
                fontStyle: 'italic',
                fontFamily: DP_TOK.mono,
              }}
            >
              #{bag.printedNumber}
            </em>
          </>
        }
      />
      <ProcessBagForm {...props} />
    </section>
  );
}
