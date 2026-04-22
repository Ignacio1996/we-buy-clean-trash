import Link from 'next/link';
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

export const dynamic = 'force-dynamic';

const DEPOT_CAPACITY_LBS_PER_MATERIAL = 1500;

function barColor(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-400';
  return 'bg-white';
}

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
    <section className="mt-5 space-y-4">
      <div>
        <Link
          href="/manager"
          className="text-[11px] uppercase tracking-wide text-gray-500 hover:text-gray-300"
        >
          ← Depots
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-white">{depot.name}</h1>
        <div className="text-xs text-gray-500">
          {depot.street}, {depot.city}, {depot.state} {depot.postalCode}
        </div>
      </div>

      {critical.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-300">
          ⚠️ {critical.map((r) => MATERIAL_DISPLAY_NAMES[r.id]).join(', ')} near capacity —
          schedule a truck
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            Current stock (lbs)
          </div>
          <div className="text-xs text-gray-500">
            Total {totalLbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>{MATERIAL_DISPLAY_NAMES[row.id]}</span>
                <span className={row.weight > 0 ? 'text-white' : 'text-gray-500'}>
                  {row.weight.toFixed(1)} lbs
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${barColor(row.pct)}`}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ScheduleMillPickupForm depotId={depotId} inventory={inventoryByMaterial} />

      <ShipmentsList shipments={shipments} />
    </section>
  );
}
