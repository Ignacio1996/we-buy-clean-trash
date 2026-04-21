import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { ScanConfirmClient } from './ScanConfirmClient';

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

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <Link href="/operator" className="text-xs text-gray-400 underline">
        ← Back to route
      </Link>
      <header className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Pickup</div>
        <h1 className="mt-1 text-lg font-semibold text-white">
          {address?.street ?? '—'}
          {address?.unit ? ` · Unit ${address.unit}` : ''}
        </h1>
        <div className="text-xs text-gray-400">
          {resident?.name ?? 'Resident'}
          {bag?.declaredType === 'separated'
            ? ' · ⭐ Separated'
            : bag?.declaredType === 'mixed'
              ? ' · 🔀 Mixed'
              : ''}
        </div>
      </header>
      <ScanConfirmClient pickupId={pickupId} expectedCode={expectedCode} />
    </main>
  );
}
