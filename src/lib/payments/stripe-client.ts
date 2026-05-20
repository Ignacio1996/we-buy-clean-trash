'use client';

import {
  createCheckoutSession,
  getStripePayments,
  type LineItemParams,
} from '@invertase/firestore-stripe-payments';
import { auth, firebaseApp } from '@/lib/firebase/client';

const PRODUCTS_COLLECTION =
  process.env.NEXT_PUBLIC_STRIPE_PRODUCTS_COLLECTION || 'products';
const CUSTOMERS_COLLECTION =
  process.env.NEXT_PUBLIC_STRIPE_CUSTOMERS_COLLECTION || 'customers';

// The Invertase SDK only needs config (collection names) — its work is to
// write a doc to customers/{uid}/checkout_sessions and watch it. Construct
// once at module load and reuse across calls.
const payments = getStripePayments(firebaseApp, {
  productsCollection: PRODUCTS_COLLECTION,
  customersCollection: CUSTOMERS_COLLECTION,
});

export interface StartBagCheckoutInput {
  orderId: string;
  /** Sheets actually charged (quantity minus welcome credits). > 0. */
  billableQuantity: number;
  /** Whether to add the shipping line item — false when free shipping applies. */
  includeShipping: boolean;
}

/**
 * Build line items + create a Stripe Checkout Session via the Invertase
 * extension, then redirect the browser. Throws if Stripe env config or
 * Firebase Auth client state is missing.
 *
 * The reverse path: Stripe webhook → extension writes the session's
 * payment_status. /resident/order-bags/success?order=… calls confirmBagOrder
 * which finds the synced session by metadata.orderId and flips the order to
 * queued. See src/lib/payments/confirmBagOrder.ts.
 */
export async function startBagCheckout({
  orderId,
  billableQuantity,
  includeShipping,
}: StartBagCheckoutInput): Promise<void> {
  const sheetPrice = process.env.NEXT_PUBLIC_STRIPE_BAG_SHEET_PRICE_ID;
  const shippingPrice = process.env.NEXT_PUBLIC_STRIPE_SHIPPING_PRICE_ID;
  if (!sheetPrice) throw new Error('stripe_not_configured');
  if (includeShipping && !shippingPrice) throw new Error('stripe_not_configured');

  // The extension's onCreate trigger fires as the signed-in user; the doc
  // write itself is auth'd by Firestore rules (customers/{uid}). Wait for
  // the JS SDK to restore auth state on first load so currentUser isn't null.
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('not_signed_in');

  const line_items: LineItemParams[] = [];
  if (billableQuantity > 0) {
    line_items.push({ price: sheetPrice, quantity: billableQuantity });
  }
  if (includeShipping && shippingPrice) {
    line_items.push({ price: shippingPrice, quantity: 1 });
  }
  if (line_items.length === 0) throw new Error('empty_cart');

  const origin = window.location.origin;
  const session = await createCheckoutSession(payments, {
    mode: 'payment',
    line_items,
    success_url: `${origin}/resident/order-bags/success?order=${orderId}`,
    cancel_url: `${origin}/resident/order-bags`,
    client_reference_id: orderId,
    metadata: { orderId },
  });

  // session.url is populated by the extension's Cloud Function once Stripe
  // returns; createCheckoutSession() awaits that snapshot.
  window.location.assign(session.url);
}
