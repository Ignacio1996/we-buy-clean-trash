import { adminDb } from '@/lib/firebase/admin';
import type { ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import { ZonesClient } from './ZonesClient';

export const dynamic = 'force-dynamic';

async function loadData() {
  const [zonesSnap, depotsSnap] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('depots').orderBy('name').get(),
  ]);
  const zones = zonesSnap.docs.map((d) => {
    const { createdAt: _c, ...rest } = d.data() as ZoneDoc;
    return { ...rest, zipCodes: Array.isArray(rest.zipCodes) ? rest.zipCodes : [] };
  });
  const depots = depotsSnap.docs.map((d) => {
    const { createdAt: _c, ...rest } = d.data() as DepotDoc;
    return rest;
  });
  return { zones, depots };
}

export default async function AdminZonesPage() {
  const { zones, depots } = await loadData();
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Zones & depots</h1>
        <p className="mt-1 text-xs text-gray-500">
          Pilot runs single-zone, but the data model supports many.
        </p>
      </header>
      <ZonesClient zones={zones} depots={depots} />
    </div>
  );
}
