import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { DeliverClient } from './DeliverClient';
import {
  OP_TOK,
  OpBackRow,
  OpEyebrow,
  OpPage,
} from '@/components/operator/Op';

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

  return (
    <OpPage>
      <OpBackRow label="Back to route" href="/operator" />

      <header className="mb-6">
        <OpEyebrow>Delivery</OpEyebrow>
        <h1
          className="mt-1.5"
          style={{
            fontFamily: OP_TOK.serif,
            fontSize: 26,
            color: OP_TOK.ink,
            letterSpacing: -0.5,
            lineHeight: 1.15,
            fontWeight: 400,
          }}
        >
          {address?.street ?? '—'}
          {address?.unit ? (
            <span style={{ color: OP_TOK.inkSoft, fontStyle: 'italic' }}>
              , Unit {address.unit}
            </span>
          ) : null}
        </h1>
        <div
          className="mt-1.5 italic"
          style={{ fontFamily: OP_TOK.serif, fontSize: 12, color: OP_TOK.inkSoft }}
        >
          {resident?.name ?? 'Resident'} · {order.quantity} sheet
          {order.quantity === 1 ? '' : 's'} · {order.quantity * 10} bags
        </div>
      </header>

      <DeliverClient bagOrderId={bagOrderId} />
    </OpPage>
  );
}
