import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

/**
 * Outcome of attempting to reconcile a `pending` bag order with the Stripe
 * Checkout result synced by the firestore-stripe-payments extension.
 *
 *   confirmed       — order is (now or was already) `queued`/later; render success
 *   pending_payment — total > 0 and no successful Stripe session synced yet
 *   forbidden       — caller isn't the order's resident
 *   not_found       — orderId doesn't exist
 */
export type ConfirmOutcome = 'confirmed' | 'pending_payment' | 'forbidden' | 'not_found';

const CUSTOMERS_COLLECTION = process.env.STRIPE_CUSTOMERS_COLLECTION || 'customers';

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

/**
 * Verify Stripe payment via the extension-synced `customers/{uid}/checkout_sessions`
 * collection, then atomically:
 *   - flip the bag order from `pending` → `queued`
 *   - enqueue it onto the next pending delivery route in its zone
 *   - consume the welcome-credit (set users.freeSheetClaimed = true)
 *
 * Idempotent: re-running on a `queued`/later order is a no-op.
 *
 * Pilot note: welcome-credit eligibility is computed at order-create time but
 * consumed here. Two concurrent unpaid orders could both be priced with the
 * credit, and only the first to confirm will actually flip freeSheetClaimed.
 * Acceptable for the single-resident pilot — revisit if multiple concurrent
 * orders become a real scenario.
 */
export async function confirmBagOrder(orderId: string, uid: string): Promise<ConfirmOutcome> {
  const orderRef = adminDb.collection('bagOrders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return 'not_found';
  const order = snap.data() as BagOrderDoc;
  if (order.residentId !== uid) return 'forbidden';
  // Already reconciled (queued, out_for_delivery, delivered, or cancelled) —
  // nothing to do. Cancelled orders also short-circuit; the success page
  // shouldn't be reached for those, but treat defensively.
  if (order.status !== 'pending') return 'confirmed';

  // Payment gate. Free orders skip Stripe; otherwise we look for a synced
  // payment record. The firestore-stripe-payments extension does NOT update
  // the checkout_sessions doc on completion — it writes a fresh doc to
  // customers/{uid}/payments/{paymentIntentId} when checkout.session.completed
  // fires. The PaymentIntent has its own metadata (separate from the session's)
  // so we can't match on metadata.orderId here. Instead we:
  //   1. Find the checkout_sessions doc by metadata.orderId → grab its sessionId.
  //   2. Find a successful payment in `payments` whose amount (in cents) matches
  //      the order total and which was created after the order. This is
  //      acceptable for the single-resident pilot — concurrent same-total
  //      orders could theoretically pick the wrong payment, but residents
  //      check out one order at a time.
  // Test accounts (admin-flagged on the user doc, server-side) bypass Stripe
  // entirely: their orders are auto-confirmed as paid with no real charge. This
  // is the single gate for the bypass — read only from the trusted user doc,
  // never from any client-supplied value. Declared here so the credit-consume
  // step below reuses the same ref.
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const isTestAccount = userSnap.get('isTest') === true;

  let paid = order.total === 0 || isTestAccount;
  let sessionId: string | null = null;
  if (!paid) {
    const sessSnap = await adminDb
      .collection(CUSTOMERS_COLLECTION)
      .doc(uid)
      .collection('checkout_sessions')
      .where('metadata.orderId', '==', orderId)
      .get();
    for (const d of sessSnap.docs) {
      const sid = d.get('sessionId') as string | undefined;
      if (sid) {
        sessionId = sid;
        break;
      }
    }

    const expectedAmountCents = Math.round(order.total * 100);
    const orderCreatedSec = order.createdAt?.seconds ?? 0;
    const paymentsSnap = await adminDb
      .collection(CUSTOMERS_COLLECTION)
      .doc(uid)
      .collection('payments')
      .where('status', '==', 'succeeded')
      .get();
    for (const d of paymentsSnap.docs) {
      const amount = d.get('amount') as number | undefined;
      // The extension stores Stripe's PaymentIntent `created` (unix seconds).
      const created = d.get('created') as number | undefined;
      if (
        amount === expectedAmountCents &&
        (created === undefined || created >= orderCreatedSec - 5)
      ) {
        paid = true;
        break;
      }
    }
  }
  if (!paid) return 'pending_payment';

  // Route resolution must happen outside the transaction (queries aren't
  // permitted inside). Re-checked inside the tx for status before enqueue.
  const zoneId = order.zoneId;
  const routeRef = zoneId ? await findNextPendingRouteRef(zoneId) : null;

  await adminDb.runTransaction(async (tx) => {
    // All reads first.
    const fresh = await tx.get(orderRef);
    if (fresh.get('status') !== 'pending') return; // raced; another confirm won

    let enqueueable = false;
    if (routeRef) {
      const r = await tx.get(routeRef);
      const st = r.get('status');
      enqueueable = st === 'draft' || st === 'assigned';
    }

    let claimCredit = false;
    if ((order.freeSheetCredits ?? 0) > 0) {
      const u = await tx.get(userRef);
      if (u.get('freeSheetClaimed') !== true) claimCredit = true;
    }

    // Writes.
    tx.update(orderRef, {
      status: 'queued',
      paidAt: FieldValue.serverTimestamp(),
      stripeSessionId: sessionId,
      stripeStubSuccess: false,
      deliveryRouteId: routeRef && enqueueable ? routeRef.id : null,
    });
    if (routeRef && enqueueable) {
      tx.update(routeRef, { bagOrdersToDeliver: FieldValue.arrayUnion(orderId) });
    }
    if (claimCredit) {
      tx.update(userRef, {
        freeSheetClaimed: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return 'confirmed';
}
