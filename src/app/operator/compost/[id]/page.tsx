import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import type { BagDoc } from '@/lib/types/bag';
import { resolveContainerType, containerBinSize } from '@/lib/types/bag';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import { BinPickupForm, type BinView, type MaterialChoice } from './BinPickupForm';

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

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Commercial stop</div>
        <h1 className="mt-0.5 text-lg font-semibold text-white">{account.businessName}</h1>
        <div className="mt-0.5 text-xs text-gray-400">
          {account.street}
          {account.unit ? `, ${account.unit}` : ''}, {account.city}, {account.state}{' '}
          {account.postalCode}
        </div>
        {account.contactName && (
          <div className="mt-0.5 text-[11px] text-gray-500">
            Contact: {account.contactName}
            {account.contactPhone ? ` · ${account.contactPhone}` : ''}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-400">
          {account.affiliationId && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              {account.affiliationId}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            {account.collectionDays.map((d) => COLLECTION_DAY_LABELS[d]).filter(Boolean).join(', ') ||
              '—'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            {account.pickupsPerWeek}× / week
          </span>
        </div>
      </header>

      {account.driverNotes && (
        <section className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <div className="text-[9px] uppercase tracking-wide text-amber-300/80">Driver notes</div>
          <div className="mt-0.5">{account.driverNotes}</div>
        </section>
      )}

      <BinPickupForm
        accountId={account.id}
        defaultBinSize={account.defaultBinSize}
        bins={bins}
        materials={materialChoices}
      />
    </main>
  );
}
