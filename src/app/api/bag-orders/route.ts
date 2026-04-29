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

  const userSnap = await adminDb.collection('users').doc(session.uid).get();
  const user = userSnap.data();
  if (!user || !user.addressId) {
    return NextResponse.json({ error: 'user_missing_address' }, { status: 409 });
  }

  const total = calculateBagOrderTotal({ quantity, unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS });
  const orderRef = adminDb.collection('bagOrders').doc();
  const origin = new URL(request.url).origin;

  const checkout = await createCheckoutSession({
    orderId: orderRef.id,
    amountDollars: total.total,
    description: `${quantity} sheet${quantity === 1 ? '' : 's'} of We Buy Clean Trash bags`,
    successUrl: `${origin}/resident/order-bags/success?order=${orderRef.id}`,
    cancelUrl: `${origin}/resident/order-bags`,
  });

  const zoneId = (user.zoneId as string | null) ?? null;
  // Queries can't run inside a transaction; resolve the target route first.
  const routeRef = zoneId ? await findNextPendingRouteRef(zoneId) : null;

  const doc: BagOrderDoc = {
    id: orderRef.id,
    residentId: session.uid,
    zoneId,
    addressId: user.addressId as string,
    quantity: total.quantity,
    unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS,
    subtotal: total.subtotal,
    shipping: total.shipping,
    total: total.total,
    stripeSessionId: checkout.sessionId,
    stripeStubSuccess: checkout.stubSuccess,
    status: 'queued',
    deliveryRouteId: routeRef?.id ?? null,
    // Timestamps replaced by serverTimestamp() below — cast to any here to satisfy TS.
    createdAt: FieldValue.serverTimestamp() as unknown as BagOrderDoc['createdAt'],
    deliveredAt: null,
  };

  await adminDb.runTransaction(async (tx) => {
    // Firestore transactions require all reads before any writes — re-read the
    // route first to confirm it's still enqueueable, then perform writes.
    let enqueueable = false;
    if (routeRef) {
      const freshRoute = await tx.get(routeRef);
      const status = freshRoute.get('status');
      enqueueable = status === 'draft' || status === 'assigned';
    }

    if (routeRef && !enqueueable) {
      doc.deliveryRouteId = null;
    }
    tx.set(orderRef, doc);
    if (routeRef && enqueueable) {
      tx.update(routeRef, { bagOrdersToDeliver: FieldValue.arrayUnion(orderRef.id) });
    }
  });

  return NextResponse.json({
    ok: true,
    orderId: orderRef.id,
    subtotal: total.subtotal,
    shipping: total.shipping,
    total: total.total,
    freeShipping: total.freeShipping,
    checkoutUrl: checkout.checkoutUrl,
    stubSuccess: checkout.stubSuccess,
  });
}
