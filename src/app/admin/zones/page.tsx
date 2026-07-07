import { adminDb } from '@/lib/firebase/admin';
import { resolvePickupDays, type ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { ZonesClient } from './ZonesClient';
import { GuideLink } from '@/components/admin/GuideLink';

async function loadData() {
  const [zonesSnap, depotsSnap, coverageSnap, materials] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb.collection('depots').orderBy('name').get(),
    adminDb.collection('coverageRequests').orderBy('lastRequestedAt', 'desc').limit(200).get(),
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

  // Coverage requests for ZIPs not yet covered by any zone — the demand list.
  const coveredZips = new Set(zones.flatMap((z) => z.zipCodes));
  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const coverageRequests = coverageSnap.docs
    .map((d) => {
      const data = d.data() as {
        zip?: string;
        lookups?: number;
        signups?: number;
        lastRequestedAt?: { toDate?: () => Date };
      };
      return {
        zip: typeof data.zip === 'string' ? data.zip : d.id,
        lookups: typeof data.lookups === 'number' ? data.lookups : 0,
        signups: typeof data.signups === 'number' ? data.signups : 0,
        lastRequestedLabel: data.lastRequestedAt?.toDate
          ? dateFmt.format(data.lastRequestedAt.toDate())
          : '—',
      };
    })
    .filter((r) => !coveredZips.has(r.zip))
    .sort((a, b) => b.signups - a.signups || b.lookups - a.lookups);

  return {
    zones,
    depots,
    coverageRequests,
    materials: materials.map((m) => ({ id: m.id, name: m.name, payoutMode: m.payoutMode })),
  };
}

export default async function AdminZonesPage() {
  const { zones, depots, coverageRequests, materials } = await loadData();
  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Zones & depots</h1>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            A <span className="text-gray-300">depot</span> is a physical drop-off / processing
            site where material goes. A <span className="text-gray-300">zone</span> is a service
            territory — a list of ZIP codes — that feeds one depot. Add a ZIP to a zone and
            residents there can sign up and get auto-assigned.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>
      <ZonesClient
        zones={zones}
        depots={depots}
        materials={materials}
        coverageRequests={coverageRequests}
      />
    </div>
  );
}
