import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { findBagByCode } from '@/lib/pickups/lookup';
import { resolveContainerType, type BagDoc, type DeclaredBagType } from '@/lib/types/bag';
import type { PickupDoc } from '@/lib/types/pickup';
import type { AddressDoc, UserDoc } from '@/lib/types/user';

export interface ScanResolveResult {
  bagId: string;
  code: string;
  residentName: string;
  street: string;
  unitLine: string;
  cityLine: string;
  declaredType: DeclaredBagType | null;
  /** True when the bag already has a scheduled (pending) pickup. */
  hasPickup: boolean;
  /** True when this pickup would be created ad-hoc (resident never scheduled it). */
  adHoc: boolean;
  /** Ask the operator to declare separated/mixed when the bag has no declaration yet. */
  needsDeclaredType: boolean;
}

/**
 * Fallback scan resolver for operators. Given a scanned QR / typed printed number,
 * returns who the bag belongs to and whether a pickup is already scheduled — so the
 * operator can collect it even when the routing system never attached it to a route.
 * Does not write anything.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'operator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;
  const bagCode = typeof raw.bagCode === 'string' ? raw.bagCode.trim() : '';
  if (!bagCode) return NextResponse.json({ error: 'missing_code' }, { status: 400 });

  const bagSnap = await findBagByCode(bagCode);
  if (!bagSnap) return NextResponse.json({ error: 'bag_not_found' }, { status: 404 });
  const bag = bagSnap.data() as BagDoc;

  // Fallback flow is for residential bags only — bins have their own compost flow.
  if (resolveContainerType(bag) !== 'bag') {
    return NextResponse.json({ error: 'not_a_residential_bag' }, { status: 409 });
  }
  if (!bag.residentId) {
    return NextResponse.json({ error: 'bag_unassigned' }, { status: 409 });
  }
  if (bag.status === 'picked_up') {
    return NextResponse.json({ error: 'already_picked_up' }, { status: 409 });
  }
  if (bag.status === 'processed') {
    return NextResponse.json({ error: 'already_processed' }, { status: 409 });
  }

  // Existing pending pickup (may be on a route, another operator's route, or none).
  const pickupQuery = await adminDb
    .collection('pickups')
    .where('bagId', '==', bagSnap.id)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  const pickup = pickupQuery.empty ? null : (pickupQuery.docs[0].data() as PickupDoc);

  const [residentSnap] = await Promise.all([
    adminDb.collection('users').doc(bag.residentId).get(),
  ]);
  const resident = residentSnap.exists ? (residentSnap.data() as UserDoc) : null;

  const addressId = pickup?.addressId ?? (resident?.addressId as string | undefined) ?? null;
  const addressSnap = addressId
    ? await adminDb.collection('addresses').doc(addressId).get()
    : null;
  const address =
    addressSnap && addressSnap.exists ? (addressSnap.data() as AddressDoc) : null;

  const result: ScanResolveResult = {
    bagId: bagSnap.id,
    code: bag.qrCode || bag.printedNumber || bagSnap.id,
    residentName: resident?.name ?? 'Resident',
    street: address?.street ?? '—',
    unitLine: address?.unit ? `Unit ${address.unit}` : '',
    cityLine: address ? `${address.city}, ${address.state} ${address.postalCode}` : '',
    declaredType: (bag.declaredType as DeclaredBagType | null) ?? null,
    hasPickup: pickup !== null,
    adHoc: pickup === null,
    needsDeclaredType: !bag.declaredType,
  };
  return NextResponse.json(result);
}
