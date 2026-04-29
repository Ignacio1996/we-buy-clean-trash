import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { loadOperatorRoute } from '@/lib/auth/operatorAccess';
import type { PickupDoc } from '@/lib/types/pickup';
import type { BagDoc } from '@/lib/types/bag';
import type { AddressDoc, UserDoc } from '@/lib/types/user';
import { ScanConfirmClient } from './ScanConfirmClient';
import {
  OP_TOK,
  OpBackRow,
  OpEyebrow,
  OpPage,
} from '@/components/operator/Op';

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
  const declaredType = bag?.declaredType;

  return (
    <OpPage>
      <OpBackRow label="Back to route" href="/operator" />

      <header className="mb-6">
        <OpEyebrow>Pickup</OpEyebrow>
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
          {resident?.name ?? 'Resident'}
          {declaredType === 'separated' && (
            <span className="ml-2" style={{ color: OP_TOK.green }}>
              · separated
            </span>
          )}
          {declaredType === 'mixed' && <span className="ml-2">· mixed</span>}
        </div>
      </header>

      <ScanConfirmClient pickupId={pickupId} expectedCode={expectedCode} />
    </OpPage>
  );
}
