import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { DeliverClient } from './DeliverClient';
import { SSOpHeader, SSOpShell } from '@/components/operator/SSOp';

export const dynamic = 'force-dynamic';

export default async function DeliverPage({
  params,
}: {
  params: Promise<{ bagOrderId: string }>;
}) {
  const session = await requireRole('operator');
  const { bagOrderId } = await params;

  const orderSnap = await adminDb.collection('bagOrders').doc(bagOrderId).get();
  if (!orderSnap.exists) notFound();
  const order = orderSnap.data() as BagOrderDoc;
  if (order.status === 'delivered') redirect('/operator');
  if (!order.deliveryRouteId) redirect('/operator');

  const routeResult = await loadOperatorRoute(session, order.deliveryRouteId);
  if (!routeResult.ok) redirect('/operator');
  if (routeResult.context.route.status !== 'in_progress') redirect('/operator');

  const [addrSnap, userSnap] = await Promise.all([
    adminDb.collection('addresses').doc(order.addressId).get(),
    adminDb.collection('users').doc(order.residentId).get(),
  ]);
  const address = addrSnap.data() as AddressDoc | undefined;
  const resident = userSnap.data() as UserDoc | undefined;

  const street = address?.street ?? '—';
  const unitLine = address?.unit ? ` · Unit ${address.unit}` : '';

  return (
    <SSOpShell active="route" nav={false}>
      <SSOpHeader
        kicker="Delivery"
        title={
          <>
            Hand over
            <br />
            the bags.
          </>
        }
        sub={`${street}${unitLine} · ${resident?.name ?? 'Resident'} · ${order.quantity} sheet${order.quantity === 1 ? '' : 's'} · ${order.quantity * 10} bags`}
        back="Back to route"
        backHref="/operator"
      />

      <DeliverClient bagOrderId={bagOrderId} />
    </SSOpShell>
  );
}
