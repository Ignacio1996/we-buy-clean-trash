import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import type { ZoneDoc } from '@/lib/types/zone';
import type { BagDoc } from '@/lib/types/bag';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { GuideLink } from '@/components/admin/GuideLink';
import { CommercialAccountsClient, type CommercialAccountView } from './CommercialAccountsClient';
import { CompostRouteOptimizer } from './CompostRouteOptimizer';

async function loadData() {
  const [accountsSnap, zonesSnap, materials] = await Promise.all([
    adminDb.collection('commercialAccounts').orderBy('businessName').get(),
    adminDb.collection('zones').orderBy('name').get(),
    loadActiveMaterials(),
  ]);

  const accounts = accountsSnap.docs.map((d) => {
    const data = d.data() as CommercialAccountDoc & {
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    const { createdAt: _c, updatedAt: _u, firstMonthOfData: _f, ...rest } = data;
    return rest as CommercialAccountView;
  });

  // Bin counts per account — one query, then bucket.
  const binCounts = new Map<string, number>();
  if (accounts.length > 0) {
    const binsSnap = await adminDb
      .collection('bags')
      .where('reusable', '==', true)
      .get();
    binsSnap.docs.forEach((d) => {
      const bag = d.data() as BagDoc;
      const accId = bag.commercialAccountId;
      if (typeof accId === 'string') {
        binCounts.set(accId, (binCounts.get(accId) ?? 0) + 1);
      }
    });
  }

  const zones = zonesSnap.docs.map((d) => {
    const data = d.data() as ZoneDoc;
    return { id: data.id, name: data.name };
  });

  return {
    accounts: accounts.map((a) => ({ ...a, binCount: binCounts.get(a.id) ?? 0 })),
    zones,
    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      measurementMode: m.measurementMode,
    })),
  };
}

export default async function AdminCommercialAccountsPage() {
  const { accounts, zones, materials } = await loadData();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Commercial accounts</h1>
          <p className="mt-1 text-xs text-gray-500">
            Sites whose pickups are operator-driven (compost, bulk collection). Drivers scan bins
            and record fullness on-site instead of weighing at a depot.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CompostRouteOptimizer zones={zones} />
          <GuideLink href="/user-guides/compost-admin-commercial-accounts.html" />
        </div>
      </header>
      <CommercialAccountsClient accounts={accounts} zones={zones} materials={materials} />
    </div>
  );
}
