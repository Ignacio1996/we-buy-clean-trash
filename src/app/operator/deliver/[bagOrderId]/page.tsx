import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { DeliverClient } from './DeliverClient';

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
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <Link href="/operator" className="text-xs text-gray-400 underline">
        ← Back to route
      </Link>
      <header className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Delivery</div>
        <h1 className="mt-1 text-lg font-semibold text-white">
          {address?.street ?? '—'}
          {address?.unit ? ` · Unit ${address.unit}` : ''}
        </h1>
        <div className="text-xs text-gray-400">
          {resident?.name ?? 'Resident'} · {order.quantity} sheet
          {order.quantity === 1 ? '' : 's'} (10 bags each)
        </div>
      </header>
      <DeliverClient bagOrderId={bagOrderId} />
    </main>
  );
}
