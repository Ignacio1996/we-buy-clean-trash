import 'server-only';

export interface CheckoutSessionInput {
  orderId: string;
  amountDollars: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  stubSuccess: boolean;
}

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  // TODO(phase-post-pilot): replace with real Stripe SDK call.
  // Pilot: return a simulated-paid session that redirects straight to successUrl.
  return {
    sessionId: `stub_${input.orderId}`,
    checkoutUrl: input.successUrl,
    stubSuccess: true,
  };
}
