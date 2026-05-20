import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { confirmBagOrder } from '@/lib/payments/confirmBagOrder';

export const runtime = 'nodejs';

/**
 * Reconcile a `pending` bag order against the Stripe Checkout session synced
 * by the firestore-stripe-payments extension. The success page calls this on
 * load; if the webhook hasn't synced yet, the page polls this endpoint until
 * the order flips to `queued`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'resident') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const outcome = await confirmBagOrder(id, session.uid);
  const status =
    outcome === 'forbidden' ? 403 : outcome === 'not_found' ? 404 : 200;
  return NextResponse.json({ outcome }, { status });
}
