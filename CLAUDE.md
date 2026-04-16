# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Pre-code.** The repo currently contains only `planning/` — no app code, no `package.json`, no config. `planning/Build Plan.txt` is the authoritative source for stack, phases, data model, and locked-in decisions. Read it before scaffolding anything. The two HTML files in `planning/` are design mockups (how the app should look and flow).

Two sibling planning files:
- `planning/Build Plan.txt` — ordered build phases 0–12, data model, points math, stubbed integrations table
- `planning/App Design - We Buy Clean Trash - April 16th.html` — UI mockups per role
- `planning/How It Works (April 16 2026).html` — product explainer

## Architecture (planned)

**Single Next.js app at the repo root** + sibling `functions/` directory for Cloud Functions. A future mobile app will live in a **separate repo** — no monorepo here.

```
src/app/               # Next.js 15 App Router, TS, Tailwind
src/lib/firebase/      # client + admin SDK init
src/lib/types/         # Firestore doc types
src/lib/logic/         # PURE functions: points, pricing, validation
src/middleware.ts      # role-based route gating
functions/             # Firebase Cloud Functions (own package.json + tsconfig)
```

`src/lib/logic` must stay pure and framework-free (no React, no Next imports) because Cloud Functions imports it. **All points math lives here**, not in Cloud Functions or API routes. `functions/tsconfig.json` uses an `include` path for `../src/lib/logic` + `../src/lib/types` and a `@shared/*` path alias so `functions/src/index.ts` can import shared code cleanly.

**Five roles** drive the entire app: `resident`, `operator`, `depot_worker`, `depot_manager`, `admin`. Routing uses role-prefixed paths (`/resident`, `/operator`, `/depot`, `/manager`, `/admin`) gated by `src/middleware.ts` reading the session cookie + Firebase custom claims.

**Auth model is asymmetric:** residents self-signup; operators/depot/manager/admin are **invite-only** — admin writes an `invites/{token}` doc, user accepts via emailed link, a Cloud Function sets the custom claim. Do not add a self-signup path for non-resident roles.

## Locked-in decisions (don't re-litigate)

- **Firebase project**: `we-buy-clean-trash` (already exists; Blaze plan required for Functions + external APIs)
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

| Integration | Pilot stub |
|---|---|
| Stripe (bag orders) | Mock checkout returns simulated success |
| Twilio SMS | `sendSMS()` → console.log + write to `smsLog` collection |
| Amazon/Walmart gift cards | Admin-fulfilled queue (`redemptions` collection) |
| "Pay Trash Bill" / "Donate" redemptions | Disabled stub buttons |

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

- `transactions` is an **immutable ledger** — every points change (signup_bonus, pickup, redemption) writes a new doc; don't mutate `users.pointsBalance` without a paired `transactions` write. Prefer Cloud Function triggers to keep them in sync.
- `bagProcessing` writes are the trigger that awards points and updates inventory. Processing flow (Phase 7): depot worker submits → Cloud Function computes points via `src/lib/logic` → writes `bagProcessing` + `transactions` + increments `users.pointsBalance` + updates `inventory` + calls `sendSMS()` stub. This chain runs server-side only.
- Bag order creation triggers a Cloud Function (`onBagOrderCreated`) that queues the next route for that zone to deliver.

## Build phases

Follow the ordered phases in `planning/Build Plan.txt` (Phase 0 → 12). Don't skip ahead — each phase assumes the previous one is in place (e.g. shared types/logic land in Phase 2 before any feature code in Phase 3+ imports from them).

## Commands

None yet — app not scaffolded. After Phase 0: standard `npm run dev` / `npm run build` / `npm run lint` from repo root for the Next.js app; `cd functions && npm run build` + `firebase deploy --only functions` for Cloud Functions. Add real commands here when Phase 0 lands.
