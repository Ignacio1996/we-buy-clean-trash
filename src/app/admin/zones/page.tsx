import { adminDb } from '@/lib/firebase/admin';
import { resolvePickupDays, type ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { ZonesClient } from './ZonesClient';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

async function loadData() {
  const [zonesSnap, depotsSnap, materials] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('depots').orderBy('name').get(),
    loadActiveMaterials(),
  ]);
  const zones = zonesSnap.docs.map((d) => {
    const data = d.data() as ZoneDoc & { pickupDayOfWeek?: number };
    const { createdAt: _c, pickupDayOfWeek: _legacy, ...rest } = data;
    return {
      ...rest,
      zipCodes: Array.isArray(rest.zipCodes) ? rest.zipCodes : [],
      pickupDaysOfWeek: resolvePickupDays(data),
    };
  });
  const depots = depotsSnap.docs.map((d) => {
    // Strip Firestore Timestamps — they don't serialize across the server/client
    // RSC boundary. The client only needs the static depot fields.
    const data = d.data() as DepotDoc & { updatedAt?: unknown };
    const { createdAt: _c, updatedAt: _u, ...rest } = data;
    return rest;
  });
  return {
    zones,
    depots,
    materials: materials.map((m) => ({ id: m.id, name: m.name, payoutMode: m.payoutMode })),
  };
}

export default async function AdminZonesPage() {
  const { zones, depots, materials } = await loadData();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Zones & depots</h1>
          <p className="mt-1 text-xs text-gray-500">
            Pilot runs single-zone, but the data model supports many.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>
      <ZonesClient zones={zones} depots={depots} materials={materials} />
    </div>
  );
}
