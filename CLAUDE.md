# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Pre-code.** The repo currently contains only `planning/` — no app code, no `package.json`, no config. `planning/Build Plan.txt` is the authoritative source for stack, phases, data model, and locked-in decisions. Read it before scaffolding anything. The two HTML files in `planning/` are design mockups (how the app should look and flow).

Two sibling planning files:

- `planning/Build Plan.txt` — ordered build phases 0–12, data model, points math, stubbed integrations table
- `planning/App Design - We Buy Clean Trash - April 16th.html` — UI mockups per role
- `planning/How It Works (April 16 2026).html` — product explainer

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
- **Routing**: Google Maps Routes API `computeRoutes` with `optimizeWaypointOrder: true`, called from `/api/route-optimize`
- **QR**: app generates printable QR sheet PDFs for Rollo thermal printer; each sticker has a QR + printed-number fallback. Creating the sheet must atomically create `stickerSheets` + 10 `bags` records.
- **Scale**: manual weight entry (no Bluetooth/USB)
- **Driver-on-the-way**: operator tap-triggered, not GPS geofence
- **Compliance notices**: app generates PDF, admin clicks "Mark as mailed"
- **Multi-tenancy**: data model has multi-zone fields but UI is single-zone for pilot

## Stubbed-integration pattern

Several integrations are stubbed for the pilot. The rule: **build the typed interface first, wire a stub that logs + writes to Firestore, leave a clear TODO for the real swap.** Business logic must not import vendor SDKs directly — go through a thin adapter (e.g. `lib/payments/stripe.ts` exposes `createCheckoutSession()`; pilot returns a mock success, real impl swaps in later).

| Integration                             | Pilot stub                                               |
| --------------------------------------- | -------------------------------------------------------- |
| Stripe (bag orders)                     | Mock checkout returns simulated success                  |
| Twilio SMS                              | `sendSMS()` → console.log + write to `smsLog` collection |
| Amazon/Walmart gift cards               | Admin-fulfilled queue (`redemptions` collection)         |
| "Pay Trash Bill" / "Donate" redemptions | Disabled stub buttons                                    |

## Points math (single source of truth)

Lives in `src/lib/logic/calculatePoints`. Never inline this formula elsewhere.

```
pointsAwarded =
    Σ (weight_i × marketPrice_i × customerPct_i)
    × separatedMultiplier        // 2 if declared-separated, else 1
    × (1 − contaminationPenalty) // 0 / 0.3 / 0.6 / 0.9 (None / Minor / Major / Severe)
    × 10000                      // $ → points (100,000 pts = $10)
```

- Signup bonus: +10,000 pts (written as a `transactions` ledger entry, type `signup_bonus`)
- `materials` collection holds `marketPrice` + `customerPct` per commodity (7 total: aluminum, tin/steel, cardboard, paper, PET, HDPE, mixed plastic); admin edits these and snapshots to `priceHistory`
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
- `firebase deploy --only firestore:rules,storage` — push security rules

Vercel auto-deploys on push to main once the project is linked. Env vars live in `.env.local` (see `.env.local.example`) and must also be set in the Vercel dashboard for deploys.
