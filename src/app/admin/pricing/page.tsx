import { adminDb } from '@/lib/firebase/admin';
import {
  SEED_MATERIAL_IDS,
  SEED_MATERIAL_DISPLAY_NAMES,
  isMeasurementMode,
  isPayoutMode,
  type MaterialId,
} from '@/lib/types/material';
import type { PricingCampaignDoc } from '@/lib/types/pricingCampaign';
import { PricingForm, type MaterialRow } from './PricingForm';
import {
  CampaignsManager,
  type CampaignRow,
  type CampaignMaterialOption,
} from './CampaignsManager';
import { GuideLink } from '@/components/admin/GuideLink';

export const dynamic = 'force-dynamic';

async function loadMaterials(): Promise<MaterialRow[]> {
  const snap = await adminDb.collection('materials').get();
  const fromDb = new Map<MaterialId, MaterialRow>();
  snap.docs.forEach((d, idx) => {
    const data = d.data();
    fromDb.set(d.id, {
      id: d.id,
      name:
        typeof data.name === 'string' && data.name.trim()
          ? data.name
          : (SEED_MATERIAL_DISPLAY_NAMES[d.id] ?? d.id),
      marketPrice: typeof data.marketPrice === 'number' ? data.marketPrice : 0,
      customerPct: typeof data.customerPct === 'number' ? data.customerPct : 0.3,
      active: data.active === undefined ? true : Boolean(data.active),
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : idx,
      isSeed: (SEED_MATERIAL_IDS as readonly string[]).includes(d.id),
      payoutMode: isPayoutMode(data.payoutMode) ? data.payoutMode : 'cash',
      measurementMode: isMeasurementMode(data.measurementMode)
        ? data.measurementMode
        : 'bag_weight',
    });
  });

  SEED_MATERIAL_IDS.forEach((id, i) => {
    if (fromDb.has(id)) return;
    fromDb.set(id, {
      id,
      name: SEED_MATERIAL_DISPLAY_NAMES[id]!,
      marketPrice: 0,
      customerPct: 0.3,
      active: true,
      displayOrder: i,
      isSeed: true,
      payoutMode: 'cash',
      measurementMode: 'bag_weight',
    });
  });

  return [...fromDb.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

async function loadCampaigns(now: Date): Promise<CampaignRow[]> {
  const snap = await adminDb
    .collection('pricingCampaigns')
    .orderBy('startsAt', 'desc')
    .limit(20)
    .get();
  const rows: CampaignRow[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as PricingCampaignDoc;
    if (!data.active) continue;
    const startsAt = data.startsAt?.toDate?.();
    const endsAt = data.endsAt?.toDate?.();
    if (!startsAt || !endsAt) continue;
    if (endsAt < now) continue;
    rows.push({
      id: data.id,
      name: data.name,
      materialIds: data.materialIds,
      multiplier: data.multiplier,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      isLive: startsAt <= now && endsAt >= now,
    });
  }
  return rows;
}

export default async function AdminPricingPage() {
  const now = new Date();
  const [rows, campaigns] = await Promise.all([loadMaterials(), loadCampaigns(now)]);
  const materialOptions: CampaignMaterialOption[] = rows
    .filter((r) => r.active && r.payoutMode === 'cash')
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Yellow sheet — commodity pricing</h1>
          <p className="mt-1 text-xs text-gray-500">
            Each save snapshots a <code>priceHistory</code> entry so old rates stay auditable.
            Add, hide, or rename materials below.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>
      <PricingForm initialRows={rows} />
      <CampaignsManager campaigns={campaigns} materialOptions={materialOptions} />
    </div>
  );
}
