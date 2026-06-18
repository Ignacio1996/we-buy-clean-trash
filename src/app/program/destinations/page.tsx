import { adminDb } from '@/lib/firebase/admin';
import type { CompostDestinationDoc } from '@/lib/types/compostDestination';
import type { ZoneDoc } from '@/lib/types/zone';
import { DestinationsClient, type DestinationView } from './DestinationsClient';

async function loadData() {
  const [destSnap, zonesSnap] = await Promise.all([
    adminDb.collection('compostDestinations').get(),
    adminDb.collection('zones').orderBy('name').get(),
  ]);

  const destinations: DestinationView[] = destSnap.docs
    .map((d) => {
      const data = d.data() as CompostDestinationDoc;
      return {
        id: data.id,
        name: data.name,
        zoneId: data.zoneId,
        contactName: data.contactName ?? null,
        contactPhone: data.contactPhone ?? null,
        smsEnabled: data.smsEnabled === true,
        active: data.active !== false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const zones = zonesSnap.docs.map((d) => {
    const z = d.data() as ZoneDoc;
    return { id: z.id, name: z.name };
  });

  return { destinations, zones };
}

export default async function ProgramDestinationsPage() {
  const { destinations, zones } = await loadData();
  return (
    <div>
      <header className="mb-6">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          Compost Clubhouse
        </span>
        <h1 className="mt-2 text-2xl font-semibold text-white">Drop-off destinations</h1>
        <p className="mt-1 text-xs text-gray-500">
          Composting facilities the route delivers to. Turn on &ldquo;text on the way&rdquo; for a
          facility to have it auto-notified when the operator finishes the route and heads over.
        </p>
      </header>
      <DestinationsClient destinations={destinations} zones={zones} />
    </div>
  );
}
