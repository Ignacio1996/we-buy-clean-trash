import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { resolvePickupDays, type ZoneDoc } from '@/lib/types/zone';
import type { DepotDoc } from '@/lib/types/depot';
import type { ComplianceBatchDoc } from '@/lib/types/complianceBatch';
import { COMPLIANCE_NOTICE_LABELS } from '@/lib/types/complianceBatch';
import { MATERIAL_DISPLAY_NAMES, MATERIAL_IDS } from '@/lib/types/material';
import { PrintButton } from './PrintButton';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

interface PageProps {
  params: Promise<{ batchId: string }>;
}

interface ResidentLetter {
  id: string;
  name: string;
  street: string;
  unit: string | null;
  cityStateZip: string;
}

async function loadBatchContext(batchId: string) {
  const batchSnap = await adminDb.collection('complianceBatches').doc(batchId).get();
  if (!batchSnap.exists) return null;
  const batch = batchSnap.data() as ComplianceBatchDoc;

  const zoneSnap = await adminDb.collection('zones').doc(batch.zoneId).get();
  if (!zoneSnap.exists) return { batch, zone: null, depot: null, residents: [] };
  const zone = zoneSnap.data() as ZoneDoc;

  const [depotSnap, residentsSnap] = await Promise.all([
    adminDb.collection('depots').doc(zone.depotId).get(),
    adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .where('zoneId', '==', zone.id)
      .get(),
  ]);
  const depot = depotSnap.exists ? (depotSnap.data() as DepotDoc) : null;

  // Honor the immutable resident snapshot stored on the batch when present.
  // (Pre-gating batches won't have residentIds — fall back to all zone residents.)
  const snapshotIds = Array.isArray(batch.residentIds) ? new Set(batch.residentIds) : null;
  const residents = residentsSnap.docs
    .map((d) => d.data() as UserDoc)
    .filter((r) => (snapshotIds ? snapshotIds.has(r.uid) : true));
  const addressIds = residents
    .map((r) => r.addressId)
    .filter((id): id is string => !!id);
  const addressSnaps =
    addressIds.length > 0
      ? await adminDb.getAll(
          ...addressIds.map((id) => adminDb.collection('addresses').doc(id)),
        )
      : [];
  const addresses = new Map<string, AddressDoc>();
  addressSnaps.forEach((s) => {
    if (s.exists) addresses.set(s.id, s.data() as AddressDoc);
  });

  const letters: ResidentLetter[] = residents
    .map((r) => {
      const a = r.addressId ? addresses.get(r.addressId) : null;
      if (!a) return null;
      return {
        id: r.uid,
        name: r.name,
        street: a.street,
        unit: a.unit,
        cityStateZip: `${a.city}, ${a.state} ${a.postalCode}`,
      };
    })
    .filter((x): x is ResidentLetter => x !== null)
    .sort((a, b) => a.street.localeCompare(b.street));

  return { batch, zone, depot, residents: letters };
}

export default async function BatchPrintPage({ params }: PageProps) {
  await requireRole('admin');
  const { batchId } = await params;
  const ctx = await loadBatchContext(batchId);
  if (!ctx) notFound();
  const { batch, zone, depot, residents } = ctx;

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const pickupDays = zone ? resolvePickupDays(zone) : [];
  const pickupDay =
    pickupDays.length === 0 ? null : pickupDays.map((d) => DAY_NAMES[d]).join(' & ');

  return (
    <div className="mx-auto max-w-[8.5in] bg-white px-0 py-8 text-black print:py-0">
      <div className="mx-6 mb-6 flex items-center justify-between border-b border-gray-300 pb-3 print:hidden">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Compliance notice batch · {batch.id.slice(0, 8)}
          </div>
          <div className="text-sm font-semibold">
            {COMPLIANCE_NOTICE_LABELS[batch.type]} — {batch.zoneName} · {residents.length} letter
            {residents.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <a
            href="/admin/compliance"
            className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100"
          >
            Close
          </a>
        </div>
      </div>

      {residents.length === 0 ? (
        <div className="mx-6 rounded border border-gray-300 p-6 text-sm text-gray-600 print:hidden">
          No residents with addresses in this zone — nothing to print.
        </div>
      ) : (
        residents.map((r, i) => (
          <Letter
            key={r.id}
            resident={r}
            zone={zone}
            depot={depot}
            type={batch.type}
            today={today}
            pickupDay={pickupDay}
            pageBreak={i < residents.length - 1}
          />
        ))
      )}
    </div>
  );
}

function Letter({
  resident,
  zone,
  depot,
  type,
  today,
  pickupDay,
  pageBreak,
}: {
  resident: ResidentLetter;
  zone: ZoneDoc | null;
  depot: DepotDoc | null;
  type: 'initial_service' | 'semi_annual';
  today: string;
  pickupDay: string | null;
  pageBreak: boolean;
}) {
  return (
    <article
      className={`mx-auto w-[7.5in] px-0 text-[11.5pt] leading-relaxed ${
        pageBreak ? 'print:break-after-page' : ''
      } py-10`}
    >
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            We Buy Clean Trash
          </div>
          <div className="text-[10pt] text-gray-600">
            {depot ? `${depot.street}, ${depot.city}, ${depot.state} ${depot.postalCode}` : ''}
          </div>
        </div>
        <div className="text-right text-[10pt] text-gray-600">{today}</div>
      </header>

      <address className="mt-10 not-italic">
        <div>{resident.name}</div>
        <div>
          {resident.street}
          {resident.unit ? ` #${resident.unit}` : ''}
        </div>
        <div>{resident.cityStateZip}</div>
      </address>

      <h1 className="mt-10 text-[14pt] font-semibold">
        {type === 'initial_service'
          ? 'Notice of New Residential Recycling Service'
          : 'Semi-Annual Recycling Service Update'}
      </h1>

      {type === 'initial_service' ? (
        <>
          <p className="mt-4">Dear {resident.name.split(' ')[0] || 'Resident'},</p>
          <p className="mt-3">
            This notice confirms that recycling service for your address is now provided by{' '}
            <strong>We Buy Clean Trash</strong>. Service includes weekly collection, on-site
            processing, and cash-equivalent rewards for properly sorted material.
          </p>
          <Details zone={zone} pickupDay={pickupDay} depot={depot} />
          <p className="mt-4">
            No action is required. To activate rewards and order recycling bags, visit
            webuyclean.trash/signup and enter the address printed above.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4">Dear {resident.name.split(' ')[0] || 'Resident'},</p>
          <p className="mt-3">
            This is the semi-annual service update for your address, as required by local
            regulations. Your recycling service, provided by{' '}
            <strong>We Buy Clean Trash</strong>, is active.
          </p>
          <Details zone={zone} pickupDay={pickupDay} depot={depot} />
          <p className="mt-4">
            If your contact information has changed, or if you would like to stop service, reply
            to this notice or contact the number below.
          </p>
        </>
      )}

      <p className="mt-6">
        Questions? Email <strong>hello@webuyclean.trash</strong> or call the operations desk.
      </p>
      <p className="mt-8">Sincerely,</p>
      <p>The We Buy Clean Trash team</p>

      <footer className="mt-10 border-t border-gray-300 pt-3 text-[9pt] text-gray-500">
        This notice is provided to comply with local residential-service notification
        requirements. Retain for your records.
      </footer>
    </article>
  );
}

function Details({
  zone,
  pickupDay,
  depot,
}: {
  zone: ZoneDoc | null;
  pickupDay: string | null;
  depot: DepotDoc | null;
}) {
  return (
    <div className="mt-4 rounded border border-gray-300 p-4 text-[10.5pt]">
      <div className="font-semibold">Service details</div>
      <dl className="mt-2 grid grid-cols-[140px_1fr] gap-y-1">
        <dt className="text-gray-600">{pickupDay && pickupDay.includes('&') ? 'Pickup days' : 'Pickup day'}</dt>
        <dd>{pickupDay ?? 'TBD — check app'}</dd>
        <dt className="text-gray-600">Zone</dt>
        <dd>{zone?.name ?? '—'}</dd>
        <dt className="text-gray-600">Processing facility</dt>
        <dd>
          {depot ? `${depot.name} · ${depot.city}, ${depot.state}` : 'TBD'}
        </dd>
        <dt className="text-gray-600">Accepted materials</dt>
        <dd>{MATERIAL_IDS.map((id) => MATERIAL_DISPLAY_NAMES[id]).join(', ')}</dd>
        <dt className="text-gray-600">Not accepted</dt>
        <dd>Food waste, glass, yard waste, hazardous materials, electronics</dd>
        <dt className="text-gray-600">Holidays</dt>
        <dd>Service shifts one business day for federal holidays.</dd>
      </dl>
    </div>
  );
}
