import { adminDb } from '@/lib/firebase/admin';
import {
  MATERIAL_IDS,
  MATERIAL_DISPLAY_NAMES,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import { PricingForm } from './PricingForm';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

async function loadMaterials(): Promise<Record<MaterialId, MaterialPricing>> {
  const snaps = await Promise.all(
    MATERIAL_IDS.map((id) => adminDb.collection('materials').doc(id).get()),
  );
  const out = {} as Record<MaterialId, MaterialPricing>;
  MATERIAL_IDS.forEach((id, i) => {
    const d = snaps[i].data();
    out[id] = {
      marketPrice: typeof d?.marketPrice === 'number' ? d.marketPrice : 0,
      customerPct: typeof d?.customerPct === 'number' ? d.customerPct : 0.3,
    };
  });
  return out;
}

export default async function AdminPricingPage() {
  const materials = await loadMaterials();
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Yellow sheet — commodity pricing</h1>
          <p className="mt-1 text-xs text-gray-500">
            Each save snapshots a <code>priceHistory</code> entry so old rates stay auditable.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>
      <PricingForm
        materials={materials}
        rows={MATERIAL_IDS.map((id) => ({ id, name: MATERIAL_DISPLAY_NAMES[id] }))}
      />
    </div>
  );
}
