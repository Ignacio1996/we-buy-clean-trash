# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Built.** The app is implemented (Phases 0–12) — a single Next.js app at the repo root with `package.json`, `src/`, Firebase config, and a Vercel deploy target. `planning/Build Plan.md` remains the authoritative source for the original stack, phases, data model, and locked-in decisions. `planning/user-guides/` holds the per-role user guides (also served in-app at `/user-guides`); the HTML files in `planning/` are design mockups (how the app should look and flow).

Key planning files:

- `planning/Build Plan.md` — ordered build phases 0–12, data model, points math, stubbed integrations table
- `planning/app-designs.html` — UI mockups per role (the "App design doc")
- `planning/how-the-app-works.html` — product explainer

## Architecture (planned)

**Single Next.js app at the repo root. No Cloud Functions.** All server-side logic runs in Next.js API routes (`src/app/api/*`) using the Firebase Admin SDK. One `package.json`, one tsconfig, one deploy target (Vercel). A future mobile app will live in a **separate repo**.

```
src/app/               # Next.js 15 App Router, TS, Tailwind
src/app/api/           # server routes — privileged writes via Admin SDK
src/lib/firebase/      # client.ts (web SDK) + admin.ts (Admin SDK, server-only)
src/lib/types/         # Firestore doc types
src/lib/logic/         # PURE functions: points, pricing, validation
src/middleware.ts      # role-based route gating
```

`src/lib/logic` stays pure and framework-free (no React, no Next imports) — makes unit tests trivial and keeps the points math legible. **All points math lives here**, not inlined in API routes.

**Server-side trust boundary:** Firestore security rules deny client writes to `transactions`, `users.pointsBalance`, role-setting claims, `inventory`, and `bagProcessing`. Clients POST to an API route which verifies the ID token, runs validation, and performs writes atomically (Admin SDK transaction / batched write). Never import `src/lib/firebase/admin.ts` from a client component — it's server-only.

**Five roles** drive the entire app: `resident`, `operator`, `depot_worker`, `depot_manager`, `admin`. Routing uses role-prefixed paths (`/resident`, `/operator`, `/depot`, `/manager`, `/admin`) gated by `src/middleware.ts` reading the session cookie + Firebase custom claims.

**Auth model is asymmetric:** residents self-signup; operators/depot/manager/admin are **invite-only** — admin writes an `invites/{token}` doc via `/api/invites`, user accepts via emailed link, `/api/accept-invite` sets the custom claim with the Admin SDK. Do not add a self-signup path for non-resident roles.

## Locked-in decisions (don't re-litigate)

- **Firebase project**: `we-buy-clean-trash` (already exists; Blaze plan required for external API calls from backend)
- **Vercel**: default `*.vercel.app` for pilot
- **AI scan**: Google Gemini 2.5 Flash, server-side via `/api/scan`. Pre-signup scan is session-only (localStorage), no anonymous Firestore writes.
- **Admin Assistant**: in-app AI chat (admin-only) at `/admin/assistant`, served by `/api/admin/guide-chat` (verifies the `admin` claim, streams text). Google Gemini 2.5 Flash, grounded ONLY in the user guides — `scripts/build-guide-kb.ts` (`npm run build:guide-kb`) strips `planning/user-guides/*.html` into the committed `src/lib/ai/guide-kb.generated.ts` KB that's fed to Gemini as system context. Falls back to a demo-mode mock when `GEMINI_API_KEY` is unset.
- **Routing**: Google Maps Routes API `computeRoutes` with `optimizeWaypointOrder: true`, called from `/api/route-optimize`
- **QR**: app generates printable QR sheet PDFs for Rollo thermal printer; each sticker has a QR + printed-number fallback. Creating the sheet must atomically create `stickerSheets` + 10 `bags` records.
- **Scale**: manual weight entry (no Bluetooth/USB)
- **Driver-on-the-way**: operator tap-triggered, not GPS geofence
- **Compliance notices**: app generates PDF, admin clicks "Mark as mailed"
- **Multi-tenancy**: data model has multi-zone fields but UI is single-zone for pilot

## Stubbed-integration pattern

Several integrations are stubbed for the pilot. The rule: **build the typed interface first, wire a stub that logs + writes to Firestore, leave a clear TODO for the real swap.** Business logic must not import vendor SDKs directly — go through a thin adapter (e.g. `lib/payments/stripe.ts` exposes `createCheckoutSession()`; pilot returns a mock success, real impl swaps in later).

| Integration                             | Pilot status                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe (bag orders)                     | **Real**, via the "Run Payments with Stripe" Firebase Extension + `@invertase/firestore-stripe-payments` client SDK. See "Stripe wiring." |
| Twilio SMS                              | `sendSMS()` → console.log + write to `smsLog` collection                                                                                  |
| Amazon/Walmart gift cards               | Admin-fulfilled queue (`redemptions` collection)                                                                                          |
| "Pay Trash Bill" / "Donate" redemptions | Disabled stub buttons                                                                                                                     |

### Stripe wiring

Bag-order checkout deviates from the "all privileged writes via Admin SDK API routes" trust boundary by design — the Invertase extension is client-driven. Flow:

1. `POST /api/bag-orders` (server) creates the `bagOrders` doc as `status: 'pending'`. No route enqueue, no welcome-credit consumption yet.
2. `OrderBagsForm` calls `startBagCheckout()` (`src/lib/payments/stripe-client.ts`), which uses `@invertase/firestore-stripe-payments` to write `customers/{uid}/checkout_sessions`. The extension's Cloud Function calls Stripe and fills in `url`; the browser redirects to Stripe-hosted checkout.
3. Stripe `success_url` → `/resident/order-bags/success?order=…` → `confirmBagOrder()` (`src/lib/payments/confirmBagOrder.ts`, server-only, Admin SDK) verifies the synced session's `payment_status === 'paid'` (matched by `metadata.orderId`), then in one transaction flips the order to `queued`, enqueues onto the next pending route, and consumes the welcome credit. Idempotent.
4. If the Stripe webhook hasn't synced yet at success-page load, the page shows a "Confirming payment…" state with a client poller hitting `POST /api/bag-orders/[id]/confirm` until the order reconciles.

`firestore.rules` includes the extension's required paths (`customers/{uid}/checkout_sessions|payments|subscriptions`, `products/{id}/prices`) — must be deployed for the extension to function under this repo's central rules.

Env vars: `NEXT_PUBLIC_STRIPE_BAG_SHEET_PRICE_ID`, `NEXT_PUBLIC_STRIPE_SHIPPING_PRICE_ID` (Stripe Price IDs synced into Firestore by the extension; must match `BAG_SHEET_UNIT_PRICE_DOLLARS` and `SHIPPING_FEE`). $0 orders (welcome credit fully covers cart) skip Stripe and go straight to confirm.

## Points math (single source of truth)

Lives in `src/lib/logic/calculatePoints`. Never inline this formula elsewhere.

```
pointsAwarded =
    Σ (weight_i × marketPrice_i × customerPct_i)
    × separatedMultiplier        // 2 if declared-separated, else 1
    × (1 − contaminationPenalty) // 0 / 0.3 / 0.6 / 0.9 (None / Minor / Major / Severe)
    × 100                        // $ → points (1,000 pts = $10)
```

- At 100 pts = $1, **1,000 pts = $10** (the gift-card redemption threshold). `POINTS_PER_DOLLAR = 100` is the single constant — never hardcode the rate.
- Signup bonus: +10 pts (= $0.10; written as a `transactions` ledger entry, type `signup_bonus`). `SIGNUP_BONUS_POINTS` in `calculatePoints` is the single source — the signup route, welcome email, and signup-bonus modal all import it.
- `materials` collection holds `marketPrice` + `customerPct` per commodity (7 cash commodities: aluminum, tin/steel, cardboard, paper, PET, HDPE, mixed plastic); admin edits these and snapshots to `priceHistory`. Materials with `payoutMode: 'diversion_only'` (e.g. commingled, food scrap/compost) log weight for diversion reporting but award 0 points regardless of price.
- Admin can run per-material **campaign multipliers** (e.g. ×2 aluminum); each multiplier is applied to that material's dollar contribution *before* the separated/contamination math.
- Contamination severity set by depot worker at processing time

## Data model conventions

Full collection list is in `planning/Build Plan.txt` "Data model" section. Key invariants:

- `transactions` is an **immutable ledger** — every points change (signup_bonus, pickup, redemption) writes a new doc; `users.pointsBalance` is always paired with a `transactions` write in the same Admin SDK transaction. Never mutate `pointsBalance` on its own.
- `bagProcessing` writes award points and update inventory. Processing flow (Phase 7): depot worker submits form → `POST /api/process-bag` → verifies auth (`depot_worker` claim) → calls `calculatePoints` from `src/lib/logic` → in one Admin SDK transaction writes `bagProcessing` + appends `transactions` + increments `users.pointsBalance` + updates `inventory` → calls `sendSMS()` stub. All server-side.
- Bag order creation (`POST /api/bag-orders`) creates the `bagOrders` doc **and** enqueues it onto the next pending route for that zone in the same transaction — no separate trigger.

## Build phases

Follow the ordered phases in `planning/Build Plan.txt` (Phase 0 → 12). Don't skip ahead — each phase assumes the previous one is in place (e.g. shared types/logic land in Phase 2 before any feature code in Phase 3+ imports from them).

## Commands

- `npm run dev` — start Next.js dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — serve production build locally
- `npm run lint` — ESLint (Next + TS + Prettier-compatible)
- `npm run format` / `npm run format:check` — Prettier write / check
- `firebase emulators:start` — local Auth + Firestore + Storage emulators (ports 9099/8080/9199, UI on 4000)
- `firebase deploy --only firestore:rules,firestore:indexes,storage` — push rules + composite indexes
- `npm run seed:materials` — seed the 7 commodity docs
- `npm run seed:pilot` — idempotent pilot seed (zone, depot, admin, operator, depot worker, 5 residents)
- `npm run dev:issue-bags -- <email>` — hand-issue a 10-bag sheet to a resident (dev only)
- `npm run build:guide-kb` — regenerate the admin Assistant knowledge base (`src/lib/ai/guide-kb.generated.ts`) from `planning/user-guides/*.html`; re-run after editing the guides

Vercel auto-deploys on push to main once the project is linked. Env vars live in `.env.local` (see `.env.local.example`) and must also be set in the Vercel dashboard for deploys.

## Feature guides

Whenever a new feature is added (for residents, operators, depot workers, depot managers, or admins), ask the user if they want a guide written for it. Guides live in `planning/user-guides/`. Don't create the guide unless the user confirms.

## App design doc

Whenever a new screen or design change is introduced (new page, new mockup, significant UI rework of an existing screen), ask the user if they want it reflected in `planning/app-designs.html` — either as a new screen card in the appropriate role panel or as a changelog entry at the bottom. Don't modify the design doc unless the user confirms.
