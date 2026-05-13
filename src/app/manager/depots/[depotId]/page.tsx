import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadManagedDepot } from '@/lib/auth/managerAccess';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialId,
} from '@/lib/types/material';
import type { InventoryDoc } from '@/lib/types/inventory';
import type { MillShipmentDoc } from '@/lib/types/millShipment';
import { ScheduleMillPickupForm } from './ScheduleMillPickupForm';
import { ShipmentsList } from './ShipmentsList';
import {
  SSMG,
  SSMgBar,
  SSMgEyebrow,
  SSMgHeader,
  SSMgShell,
} from '@/components/manager/SSMg';
import { ManagerLogout } from '@/components/manager/ManagerLogout';

export const dynamic = 'force-dynamic';

const DEPOT_CAPACITY_LBS_PER_MATERIAL = 1500;

interface PageProps {
  params: Promise<{ depotId: string }>;
}

export default async function DepotDetailPage({ params }: PageProps) {
  const { depotId } = await params;
  const session = await requireRole('depot_manager');
  const depot = await loadManagedDepot(session.uid, depotId);
  if (!depot) notFound();

  const [invSnap, shipmentSnap] = await Promise.all([
    adminDb.collection('inventory').where('depotId', '==', depotId).get(),
    adminDb
      .collection('millShipments')
      .where('depotId', '==', depotId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ]);

  const invMap = new Map<MaterialId, number>();
  invSnap.docs.forEach((d) => {
    const doc = d.data() as InventoryDoc;
    invMap.set(doc.materialId, doc.weight ?? 0);
  });

  const rows = MATERIAL_IDS.map((id) => {
    const weight = invMap.get(id) ?? 0;
    const pct = Math.min(100, Math.round((weight / DEPOT_CAPACITY_LBS_PER_MATERIAL) * 100));
    return { id, weight, pct };
  });
  rows.sort((a, b) => b.pct - a.pct);

  const critical = rows.filter((r) => r.pct >= 95);
  const totalLbs = rows.reduce((a, r) => a + r.weight, 0);

  const shipments = shipmentSnap.docs.map((d) => {
    const raw = d.data() as MillShipmentDoc;
    return {
      id: raw.id,
      mill: raw.mill,
      scheduledFor: raw.scheduledFor?.toDate().toISOString() ?? null,
      status: raw.status,
      weights: raw.weights,
    };
  });

  const inventoryByMaterial = Object.fromEntries(
    rows.map((r) => [r.id, r.weight]),
  ) as Record<MaterialId, number>;

  return (
    <SSMgShell active="depots">
      <SSMgHeader
        kicker={`Depot · ${depot.name.split('—')[0].trim()}`}
        title={
          <>
            {depot.name.split('—')[1]?.trim() || depot.name}.
          </>
        }
        sub={`${depot.street}, ${depot.city}, ${depot.state} ${depot.postalCode}`}
        back="All depots"
        backHref="/manager"
        right={<ManagerLogout />}
      />

      {/* Alert — peach */}
      {critical.length > 0 && (
        <div style={{ background: SSMG.peach, padding: '16px 20px' }}>
          <div
            style={{
              background: '#fff',
              border: `2px solid ${SSMG.brand}`,
              borderRadius: 16,
              padding: 16,
              boxShadow: `0 4px 0 ${SSMG.brand}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: SSMG.brand,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              !
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: SSMG.ink,
                  letterSpacing: -0.3,
                }}
              >
                {critical.map((r) => MATERIAL_DISPLAY_NAMES[r.id]).join(', ')} at {critical[0].pct}%.
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: SSMG.inkSoft,
                  marginTop: 2,
                }}
              >
                Schedule a mill truck within 48 hrs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock — sky */}
      <div style={{ background: SSMG.sky, padding: '22px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 14,
          }}
        >
          <SSMgEyebrow mb={0}>Current stock</SSMgEyebrow>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: SSMG.ink,
              fontFamily: SSMG.mono,
            }}
          >
            {totalLbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs total
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((m) => (
            <div key={m.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: SSMG.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {MATERIAL_DISPLAY_NAMES[m.id]}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: m.pct >= 95 ? SSMG.brand : SSMG.ink,
                    fontFamily: SSMG.mono,
                  }}
                >
                  {m.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs · {m.pct}%
                </span>
              </div>
              <SSMgBar pct={m.pct} />
            </div>
          ))}
        </div>
      </div>

      {/* Schedule form — white */}
      <div style={{ background: '#fff', padding: '20px 20px 8px' }}>
        <SSMgEyebrow>Mill pickup</SSMgEyebrow>
        <ScheduleMillPickupForm depotId={depotId} inventory={inventoryByMaterial} />
      </div>

      {/* Shipments — mint */}
      <div style={{ background: SSMG.mint, padding: '20px 20px 28px' }}>
        <SSMgEyebrow>Recent shipments</SSMgEyebrow>
        <ShipmentsList shipments={shipments} />
      </div>
    </SSMgShell>
  );
}
