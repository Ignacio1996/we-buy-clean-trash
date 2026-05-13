import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc, DeclaredBagType } from '@/lib/types/bag';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { ScanConfirmClient } from './ScanConfirmClient';
import { SSOpHeader, SSOpShell } from '@/components/operator/SSOp';

export const dynamic = 'force-dynamic';

export default async function ScanConfirmPage({
  params,
}: {
  params: Promise<{ pickupId: string }>;
}) {
  const session = await requireRole('operator');
  const { pickupId } = await params;

  const pickupSnap = await adminDb.collection('pickups').doc(pickupId).get();
  if (!pickupSnap.exists) notFound();
  const pickup = pickupSnap.data() as PickupDoc;
  if (pickup.status !== 'pending' || !pickup.routeId) redirect('/operator');

  const routeResult = await loadOperatorRoute(session, pickup.routeId);
  if (!routeResult.ok) redirect('/operator');
  if (routeResult.context.route.status !== 'in_progress') redirect('/operator');

  const [bagSnap, addressSnap, residentSnap] = await Promise.all([
    adminDb.collection('bags').doc(pickup.bagId).get(),
    adminDb.collection('addresses').doc(pickup.addressId).get(),
    adminDb.collection('users').doc(pickup.residentId).get(),
  ]);
  const bag = bagSnap.data() as BagDoc | undefined;
  const address = addressSnap.data() as AddressDoc | undefined;
  const resident = residentSnap.data() as UserDoc | undefined;

  const expectedCode = bag?.qrCode ?? bag?.printedNumber ?? '';
  const declaredType = (bag?.declaredType as DeclaredBagType | null) ?? null;

  const street = address?.street ?? '—';
  const unitLine = address?.unit ? ` · Unit ${address.unit}` : '';
  const residentName = resident?.name ?? 'Resident';

  return (
    <SSOpShell active="route" nav={false}>
      <SSOpHeader
        kicker="Stop pickup"
        title={
          <>
            Scan
            <br />
            the bag.
          </>
        }
        sub={`${street}${unitLine} · ${residentName}`}
        back="Back to route"
        backHref="/operator"
      />

      <ScanConfirmClient
        pickupId={pickupId}
        expectedCode={expectedCode}
        declaredType={declaredType}
      />
    </SSOpShell>
  );
}
