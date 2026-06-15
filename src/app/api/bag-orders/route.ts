import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  calculateBagOrderTotal,
} from '@/lib/logic/calculateBagOrderTotal';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

/**
 * Create a `pending` (unpaid) bag order. The browser then drives the Stripe
 * Checkout via @invertase/firestore-stripe-payments (see stripe-client.ts).
 * Route enqueue + welcome-credit consumption happen in confirmBagOrder.ts
 * once Stripe has actually paid (or immediately for $0 free-credit orders).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'resident') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = (json ?? {}) as Record<string, unknown>;
  const quantity = Number(raw.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: 'invalid_quantity' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(session.uid);
  const userSnap = await userRef.get();
  const user = userSnap.data();
  if (!user || !user.addressId) {
    return NextResponse.json({ error: 'user_missing_address' }, { status: 409 });
  }

  const zoneId = (user.zoneId as string | null) ?? null;
  const freeSheetCredits = user.freeSheetClaimed === true ? 0 : 1;
  // Admin-flagged test accounts skip Stripe — the client routes straight to the
  // success page, where confirmBagOrder (which re-reads this same flag) auto-
  // marks the order paid. Surfacing it here is just a UX hint; the authoritative
  // gate is server-side in confirmBagOrder.
  const isTest = user.isTest === true;

  const billedTotal = calculateBagOrderTotal({
    quantity,
    unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS,
    freeSheetCredits,
  });

  const orderRef = adminDb.collection('bagOrders').doc();
  const doc: BagOrderDoc = {
    id: orderRef.id,
    residentId: session.uid,
    zoneId,
    addressId: user.addressId as string,
    quantity: billedTotal.quantity,
    unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS,
    freeSheetCredits: billedTotal.freeSheetCredits,
    discount: billedTotal.discount,
    subtotal: billedTotal.subtotal,
    shipping: billedTotal.shipping,
    total: billedTotal.total,
    stripeSessionId: null,
    stripeStubSuccess: false,
    status: 'pending',
    deliveryRouteId: null,
    // serverTimestamp casts — Admin SDK fills these on write.
    createdAt: FieldValue.serverTimestamp() as unknown as BagOrderDoc['createdAt'],
    paidAt: null,
    deliveredAt: null,
  };

  await orderRef.set(doc);

  return NextResponse.json({
    ok: true,
    orderId: orderRef.id,
    quantity: billedTotal.quantity,
    billableQuantity: billedTotal.billableQuantity,
    freeSheetCredits: billedTotal.freeSheetCredits,
    discount: billedTotal.discount,
    subtotal: billedTotal.subtotal,
    shipping: billedTotal.shipping,
    total: billedTotal.total,
    freeShipping: billedTotal.freeShipping,
    isTest,
  });
}
