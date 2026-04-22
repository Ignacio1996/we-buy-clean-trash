import { adminDb } from '@/lib/firebase/admin';
import type { ZoneDoc } from '@/lib/types/zone';
import type { ComplianceBatchDoc } from '@/lib/types/complianceBatch';
import { GuideLink } from '@/components/admin/GuideLink';
import { NewBatchForm } from './NewBatchForm';
import { BatchList } from './BatchList';

export const dynamic = 'force-dynamic';

async function loadData() {
  const [zonesSnap, batchesSnap] = await Promise.all([
    adminDb.collection('zones').orderBy('name').get(),
    adminDb
      .collection('complianceBatches')
      .orderBy('generatedAt', 'desc')
      .limit(50)
      .get(),
  ]);

  const zones = zonesSnap.docs.map((d) => {
    const z = d.data() as ZoneDoc;
    return { id: z.id, name: z.name };
  });

  const residentCounts = new Map<string, number>();
  await Promise.all(
    zones.map(async (z) => {
      const count = await adminDb
        .collection('users')
        .where('role', '==', 'resident')
        .where('zoneId', '==', z.id)
        .count()
        .get();
      residentCounts.set(z.id, count.data().count);
    }),
  );

  const batches = batchesSnap.docs.map((d) => {
    const b = d.data() as ComplianceBatchDoc;
    return {
      id: b.id,
      zoneId: b.zoneId,
      zoneName: b.zoneName,
      type: b.type,
      residentCount: b.residentCount,
      status: b.status,
      generatedAt: b.generatedAt?.toDate?.().toISOString() ?? null,
      mailedAt: b.mailedAt?.toDate?.().toISOString() ?? null,
      notes: b.notes,
    };
  });

  return {
    zones: zones.map((z) => ({ ...z, residentCount: residentCounts.get(z.id) ?? 0 })),
    batches,
  };
}

export default async function CompliancePage() {
  const { zones, batches } = await loadData();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Compliance notices</h1>
          <p className="mt-1 text-xs text-gray-500">
            Generate Initial Service and Semi-Annual notices per zone. Print + mail, then mark as
            mailed.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-9-admin-polish.html" />
      </header>

      <NewBatchForm zones={zones} />

      <BatchList batches={batches} />
    </div>
  );
}
