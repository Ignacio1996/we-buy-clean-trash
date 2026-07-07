import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS, resolveOperativeBins } from '@/lib/types/commercialAccount';
import type { BagDoc } from '@/lib/types/bag';
import { resolveContainerType, containerBinSize } from '@/lib/types/bag';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import {
  SSOP,
  SSOpBadge,
  SSOpCard,
  SSOpEyebrow,
  SSOpHeader,
  SSOpShell,
} from '@/components/operator/SSOp';
import { BinPickupForm, type BinView, type MaterialChoice } from './BinPickupForm';
import { RecyclingCheckForm } from './RecyclingCheckForm';
import { WeighedPickupForm } from './WeighedPickupForm';

export default async function CompostSiteStopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('operator');
  const { id } = await params;

  const accountSnap = await adminDb.collection('commercialAccounts').doc(id).get();
  if (!accountSnap.exists || accountSnap.get('active') === false) notFound();
  const account = accountSnap.data() as CommercialAccountDoc;

  const [binsSnap, allMaterials] = await Promise.all([
    adminDb
      .collection('bags')
      .where('commercialAccountId', '==', id)
      .where('reusable', '==', true)
      .get(),
    loadActiveMaterials(),
  ]);

  const bins: BinView[] = binsSnap.docs
    .map((d) => {
      const bag = d.data() as BagDoc;
      const containerType = resolveContainerType(bag);
      const binSize = containerBinSize(containerType);
      if (!binSize) return null;
      return {
        bagId: bag.id,
        printedNumber: bag.printedNumber,
        qrCode: bag.qrCode,
        binSize,
      };
    })
    .filter((b): b is BinView => b !== null)
    .sort((a, b) => a.printedNumber.localeCompare(b.printedNumber));

  const materialChoices: MaterialChoice[] = allMaterials
    .filter((m) => account.materialIds.includes(m.id) && m.measurementMode === 'bin_fullness')
    .map((m) => ({ id: m.id, name: m.name }));

  // Weighed sites capture a measured net weight, so any of the account's
  // materials apply (not just bin_fullness ones).
  const weighedMaterials: MaterialChoice[] = allMaterials
    .filter((m) => account.materialIds.includes(m.id))
    .map((m) => ({ id: m.id, name: m.name }));

  const isRecyclingCheck = account.siteType === 'recycling_check';
  const isWeighed = account.siteType === 'recycling_weighed';
  const addressLine = `${account.street}${account.unit ? `, ${account.unit}` : ''}, ${account.city}, ${account.state} ${account.postalCode}`;
  const scheduleLine =
    account.collectionDays.map((d) => COLLECTION_DAY_LABELS[d]).filter(Boolean).join(', ') || '—';

  return (
    <SSOpShell active="compost" nav={false}>
      <SSOpHeader
        kicker="Commercial stop"
        title={account.businessName}
        sub={addressLine}
        back="Back to compost"
        backHref="/operator/compost"
        headerBg={isRecyclingCheck || isWeighed ? SSOP.sky : SSOP.mint}
      />

      <div style={{ background: SSOP.bg, padding: '18px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SSOpCard>
          <SSOpEyebrow mb={10}>Site details</SSOpEyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {account.affiliationId && (
              <SSOpBadge bg={SSOP.amber} fg="#fff">
                {account.affiliationId}
              </SSOpBadge>
            )}
            <SSOpBadge bg="#fff">{scheduleLine}</SSOpBadge>
            <SSOpBadge bg="#fff">{account.pickupsPerWeek}× / week</SSOpBadge>
            {isRecyclingCheck && (
              <SSOpBadge bg={SSOP.sky}>Recycling check</SSOpBadge>
            )}
            {isWeighed && (
              <SSOpBadge bg={SSOP.sky}>Weighed recycling</SSOpBadge>
            )}
          </div>
          {account.contactName && (
            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: SSOP.inkSoft }}>
              Contact: {account.contactName}
              {account.contactPhone ? ` · ${account.contactPhone}` : ''}
            </div>
          )}
        </SSOpCard>

        {account.driverNotes && (
          <SSOpCard color={SSOP.yellow}>
            <SSOpEyebrow mb={6}>Driver notes</SSOpEyebrow>
            <div style={{ fontSize: 14, fontWeight: 800, color: SSOP.ink, lineHeight: 1.4 }}>
              {account.driverNotes}
            </div>
          </SSOpCard>
        )}

        {isRecyclingCheck ? (
          <RecyclingCheckForm accountId={account.id} />
        ) : isWeighed ? (
          <WeighedPickupForm accountId={account.id} materials={weighedMaterials} bins={bins} />
        ) : (
          <BinPickupForm
            accountId={account.id}
            defaultBinSize={account.defaultBinSize}
            bins={bins}
            materials={materialChoices}
            seedBinCount={resolveOperativeBins(account)}
          />
        )}
      </div>
    </SSOpShell>
  );
}
