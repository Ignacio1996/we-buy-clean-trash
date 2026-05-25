import Link from 'next/link';
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
import { SS, SSPillLink } from '@/components/resident/ss/SS';
import { ProcessBagForm, type ProcessBagFormProps } from './ProcessBagForm';

export const dynamic = 'force-dynamic';

function BackRow({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
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
        {label}
      </span>
    </Link>
  );
}

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
      <section
        style={{
          background: '#fff',
          padding: '14px 20px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <BackRow label="Queue" href="/depot/incoming" />
        <div
          style={{
            background: SS.mint,
            border: `2px solid ${SS.ink}`,
            borderRadius: 18,
            padding: '28px 18px',
            textAlign: 'center',
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: SS.green,
              color: '#fff',
              border: `3px solid ${SS.ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              fontWeight: 900,
              fontSize: 26,
              boxShadow: `0 4px 0 ${SS.ink}`,
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: -0.5,
              color: SS.ink,
            }}
          >
            Bag #{bag.printedNumber} already processed.
          </div>
        </div>
        <SSPillLink href="/depot/incoming" variant="primary">
          Back to queue
        </SSPillLink>
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
      <section
        style={{
          background: '#fff',
          padding: '14px 20px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <BackRow label="Queue" href="/depot/incoming" />
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          This depot has no accepted materials configured. Ask an admin to enable
          materials on Zones & Depots before processing.
        </div>
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
      {/* Back row */}
      <div style={{ background: '#fff', padding: '14px 20px 0' }}>
        <BackRow label="Route" href={`/depot/incoming/${route.id}`} />
      </div>

      {/* Yellow page header */}
      <div
        style={{
          background: SS.yellow,
          padding: '20px 20px 18px',
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
          Process bag
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.4,
            lineHeight: 1,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          #{bag.printedNumber}
        </div>
      </div>

      <div style={{ background: '#fff', padding: '16px 20px 28px' }}>
        <ProcessBagForm {...props} />
      </div>
    </section>
  );
}
