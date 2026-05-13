import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  calculateBagOrderTotal,
} from '@/lib/logic/calculateBagOrderTotal';
import { createCheckoutSession } from '@/lib/payments/stripe';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

export const runtime = 'nodejs';

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

async function findNextPendingRouteRef(zoneId: string) {
  const snap = await adminDb
    .collection('routes')
    .where('zoneId', '==', zoneId)
    .where('status', 'in', ['draft', 'assigned'])
    .where('date', '>=', startOfToday())
    .orderBy('date', 'asc')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].ref;
}

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
  // Queries can't run inside a transaction; resolve the target route first.
  const routeRef = zoneId ? await findNextPendingRouteRef(zoneId) : null;
  const orderRef = adminDb.collection('bagOrders').doc();
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/resident/order-bags/success?order=${orderRef.id}`;

  // The free-sheet credit + the flag flip both happen inside the transaction so
  // a concurrent second order can't claim the welcome bag twice. We re-read the
  // user inside the tx and trust the in-tx value.
  let appliedCredits = 0;
  let billedTotal: ReturnType<typeof calculateBagOrderTotal> | null = null;
  let checkoutSessionId: string | null = null;
  let checkoutStubSuccess = false;

  await adminDb.runTransaction(async (tx) => {
    // All reads first.
    const freshUserSnap = await tx.get(userRef);
    const freshUser = freshUserSnap.data() ?? {};
    const eligibleForFreeSheet = freshUser.freeSheetClaimed !== true;
    appliedCredits = eligibleForFreeSheet && quantity >= 1 ? 1 : 0;

    let enqueueable = false;
    if (routeRef) {
      const freshRoute = await tx.get(routeRef);
      const status = freshRoute.get('status');
      enqueueable = status === 'draft' || status === 'assigned';
    }

    billedTotal = calculateBagOrderTotal({
      quantity,
      unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS,
      freeSheetCredits: appliedCredits,
    });

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
      stripeStubSuccess: billedTotal.total === 0,
      status: 'queued',
      deliveryRouteId: enqueueable && routeRef ? routeRef.id : null,
      // Timestamps replaced by serverTimestamp() below — cast to satisfy TS.
      createdAt: FieldValue.serverTimestamp() as unknown as BagOrderDoc['createdAt'],
      deliveredAt: null,
    };

    tx.set(orderRef, doc);
    if (routeRef && enqueueable) {
      tx.update(routeRef, { bagOrdersToDeliver: FieldValue.arrayUnion(orderRef.id) });
    }
    if (appliedCredits > 0) {
      tx.update(userRef, {
        freeSheetClaimed: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    checkoutStubSuccess = billedTotal.total === 0;
  });

  // After the transaction, billedTotal is non-null.
  const finalTotal = billedTotal!;

  // Free orders skip Stripe entirely — there's nothing to charge.
  let checkoutUrl = successUrl;
  if (finalTotal.total > 0) {
    const checkout = await createCheckoutSession({
      orderId: orderRef.id,
      amountDollars: finalTotal.total,
      description: `${finalTotal.billableQuantity} sheet${finalTotal.billableQuantity === 1 ? '' : 's'} of We Buy Clean Trash bags`,
      successUrl,
      cancelUrl: `${origin}/resident/order-bags`,
    });
    checkoutUrl = checkout.checkoutUrl;
    checkoutSessionId = checkout.sessionId;
    checkoutStubSuccess = checkout.stubSuccess;
    await orderRef.update({
      stripeSessionId: checkoutSessionId,
      stripeStubSuccess: checkoutStubSuccess,
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: orderRef.id,
    freeSheetCredits: finalTotal.freeSheetCredits,
    discount: finalTotal.discount,
    subtotal: finalTotal.subtotal,
    shipping: finalTotal.shipping,
    total: finalTotal.total,
    freeShipping: finalTotal.freeShipping,
    checkoutUrl,
    stubSuccess: checkoutStubSuccess,
  });
}
