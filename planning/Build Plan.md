# We Buy Clean Trash — Step-by-Step Build Plan

_Created April 16, 2026 · Pilot v1.2_

---

## Decisions locked in

- **Stack**: Next.js 15 (App Router, TS) + Tailwind + Firebase (Auth, Firestore, Storage) + Vercel. **No Cloud Functions** — all server-side logic runs in Next.js API routes using the Firebase Admin SDK.
- **Structure**: single Next.js app at the repo root. One `package.json`, one tsconfig, one deploy target (Vercel). Mobile app (if built later) will live in a **separate repo** — not planned for here.
- **Auth**: Email/password + Google sign-in. Residents self-signup. Operators / depot workers / managers are invite-only (admin creates invite → email link)
- **AI scan**: Google Gemini 2.5 Flash (cheapest capable vision model)
- **Routing**: Google Maps Routes API with waypoint optimization
- **Maps target**: single-zone UI for pilot, multi-zone fields in data model
- **QR strategy**: app auto-generates printable QR sheets (Rollo thermal); each sticker has QR + printed number fallback
- **Driver-on-the-way alert**: tap-triggered by operator (no GPS geofence)
- **Scale**: manual weight entry
- **Compliance notices**: app generates PDF, admin clicks "Mark as mailed"
- **Firebase project**: `we-buy-clean-trash` (already created)
- **Vercel**: use default `*.vercel.app` for pilot

### Stubbed integrations (placeholder UI + thin interface, swap later)

| Integration | Pilot behavior |
|---|---|
| Stripe (bag orders) | Mock checkout button returns simulated success |
| Twilio SMS | `sendSMS()` logs to console + writes to `smsLog` Firestore collection |
| Amazon / Walmart gift cards | Admin sees redemption queue, sends codes manually |
| "Pay Trash Bill" redemption | Disabled stub button |
| "Donate to Nonprofit" redemption | Disabled stub button |

---

## Project layout

```
we-buy-clean-trash/
├── src/
│   ├── app/                          # Next.js 15 App Router
│   │   └── api/                      # server routes (use Admin SDK for privileged ops)
│   ├── lib/
│   │   ├── firebase/                 # client + admin SDK init
│   │   ├── logic/                    # PURE fns (points, pricing, validation)
│   │   └── types/                    # TS types for Firestore docs
│   └── middleware.ts
├── public/
├── firestore.rules
├── storage.rules
├── firebase.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── planning/
```

**Server-side trust boundary**: Firestore security rules lock down privileged writes (custom claims, `transactions` ledger, `users.pointsBalance`, `inventory`). The client never writes those directly — it POSTs to a Next.js API route, which uses the Firebase Admin SDK to perform the write atomically (transaction / batched write) after auth + validation. Pure files in `src/lib/logic` — no React, no Next imports — so they can be unit-tested in isolation.

---

## Data model (Firestore collections)

| Collection | Purpose |
|---|---|
| `users` | profile, role, zoneId, addressId, pointsBalance |
| `invites` | pending operator/depot/manager/admin invites |
| `zones` | zone name, depotId |
| `depots` | location, managerId, zoneIds |
| `addresses` | street, unit, geo, zoneId, residentId |
| `materials` | 7 commodities: marketPrice, customerPct |
| `bagOrders` | items, total, stripeStub, status, deliveryRouteId |
| `stickerSheets` | batch of 10, printedAt, residentId |
| `bags` | qrCode, printedNumber, stickerSheetId, residentId, declaredType, status |
| `pickups` | bagId, routeId, operatorId, photoUrl, completedAt, issue? |
| `routes` | date, zoneId, operatorId, orderedStops[], bagOrdersToDeliver[] |
| `bagProcessing` | bagId, weights{7}, separated, contaminationSeverity, pointsAwarded |
| `transactions` | ledger: signup_bonus, pickup, redemption (immutable) |
| `redemptions` | gift card requests — manual fulfillment queue |
| `inventory` | depotId × commodity → weight |
| `millShipments` | outgoing shipments |
| `contaminationFlags` | warnings/strikes per resident |
| `complianceNotices` | PDF generated + mark-as-mailed |
| `priceHistory` | historical yellow-sheet snapshots |
| `smsLog` | Twilio stub message log |

---

## Points math

```
pointsAwarded =
    Σ (weight_i × marketPrice_i × customerPct_i)
    × separatedMultiplier        // 2 if declared-separated, else 1
    × (1 − contaminationPenalty) // 0 / 0.3 / 0.6 / 0.9 (None / Minor / Major / Severe)
    × 10000                      // $ → points (100,000 pts = $10)
```

- Signup bonus: **+10,000 pts**
- Customer payout % per commodity is configurable in admin (default 30%)
- Contamination severity is set by the depot worker at processing time

---

## Bag order pricing

- Flat price per sheet of 10 bags
- **Free shipping** on orders ≥ $20
- **+$10 shipping** on orders < $20
- Bag order triggers the **next operator route** for that zone to deliver

---

## Build steps — ordered

### Phase 0 — Foundation (~half day)
1. `create-next-app` at repo root (App Router, TS, Tailwind, `src/` dir, ESLint). Add prettier
2. Create `src/lib/firebase/`, `src/lib/logic/`, `src/lib/types/` (empty for now). In `src/lib/firebase/` add `client.ts` (web SDK) and `admin.ts` (Admin SDK — server-only, uses `FIREBASE_ADMIN_SA` service account)
3. Firebase CLI: `firebase init` at repo root (Firestore, Storage, Emulators only — **skip Functions and Hosting**)
4. Env: `.env.local` with Firebase web config + placeholders for `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `FIREBASE_ADMIN_SA`
5. Vercel: link repo, set env vars, first deploy of the empty app

### Phase 1 — Auth & role routing (~1 day)
6. Firebase Auth: email/pass + Google provider enabled in console
7. Signup API route (`/api/signup`): client signs up with Firebase Auth SDK → POSTs ID token to `/api/signup` → server verifies, sets `role: 'resident'` custom claim via Admin SDK, creates `users` doc. Client refreshes token to pick up the claim
8. Middleware: `src/middleware.ts` reads session cookie, redirects by role prefix (`/resident`, `/operator`, `/depot`, `/manager`, `/admin`)
9. Invite flow: admin creates `invites/{token}` via `/api/invites` → emailed link → acceptance page POSTs to `/api/accept-invite` with token + ID token → server verifies token, sets the non-resident custom claim, creates `users` doc, marks invite consumed

### Phase 2 — Shared types + logic (~half day)
10. TS types for all Firestore docs in `src/lib/types`
11. Pure functions in `src/lib/logic` (no framework / React / Next imports — keeps them trivially unit-testable):
    - `calculatePoints({ weights, materials, separated, contaminationSeverity })`
    - `calculateBagOrderTotal({ quantity, unitPrice })` with $20 free-ship rule
    - `pointsToDollars(pts)`

### Phase 3 — Resident flow (~2 days)
12. **Public landing + pre-signup scan** (`/scan`): browser camera → `/api/scan` (Gemini 2.5 Flash vision) → show items + estimated earnings. Session-only (localStorage), no anonymous persistence.
13. **Signup**: email/Google → collect name, address → assign zone (reverse-geocode or admin-preset zip list) → POSTs to `/api/signup` which sets role claim and creates `users` + `addresses`
14. **Onboarding 3-step card** (Order bags → Schedule → Earn)
15. **Home dashboard**: points stat, next pickup card, Order More Bags (top), notification card, impact card, bottom nav
16. **Order Bags**: quantity stepper → total + shipping rule → Stripe placeholder button → POSTs to `/api/bag-orders` (creates `bagOrders` + enqueues to next route — see Phase 5). Stub interface: `lib/payments/stripe.ts` with `createCheckoutSession()` returning a mock success
17. **Scan QR** (`/scan-bag`): jsQR-based camera scan + manual number fallback → pick bag type → photo upload to Storage → creates `pickups` pending
18. **Payout calculator**: reads `materials` collection live; shows good vs. contaminated scenarios
19. **Recycling Guide**: static content in `content/guide.mdx`
20. **Rewards**: balance, history (from `transactions`), Amazon/Walmart → creates `redemptions` doc; Pay Trash Bill + Donate as disabled stubs
21. **Profile**: address, pickup day (read-only, admin-assigned), sign out

### Phase 4 — Admin core (~1 day)
22. Admin layout + KPI dashboard (counts, material totals, revenue)
23. Users & invites: list residents; create invites for operators/depots/managers
24. Zones & depots CRUD
25. Yellow-sheet pricing editor: 7 materials, market price + customer payout %, write to `materials` + `priceHistory`
26. Redemption queue: pending gift card requests, button "Mark fulfilled" (admin emails code out-of-band during pilot)

### Phase 5 — Routes (~1 day)
27. Route builder (admin): pick date + zone → pull residents with pending pickups + pending `bagOrders` → POST `/api/route-optimize` → Google Maps Routes API (`computeRoutes` with `optimizeWaypointOrder: true`) → save ordered `routes` doc assigned to an operator
28. `/api/bag-orders` server logic (the API route introduced in Phase 3 step 16): in one Admin SDK transaction, creates the `bagOrders` doc **and** enqueues it to the next pending route for that zone

### Phase 6 — Operator flow (~1 day)
29. Today's Route screen: stat row (stops/done/bags) + Current Stop card with big **COMPLETE** button + Skip / Not Out / Issue secondary buttons + Deliver bags card + next 2 stops preview
30. Scan & Confirm: QR scan + number fallback + sealed/contamination toggles + doorstep photo → updates `pickups`
31. Deliver bags + stickers: scan one sticker to confirm batch → marks `bagOrders` fulfilled, creates `stickerSheets` + `bags` records pre-issued to resident
32. Tap "Driver on the way" button on stop-start → triggers SMS stub
33. End-of-route summary → "Deliver to Depot" marks route complete

### Phase 7 — Depot flow (~1 day)
34. Incoming deliveries: list of completed routes arriving
35. Process Bag: scan QR → 7 weight fields (manual entry) → Contamination severity picker (None / Minor / Major / Severe → 0 / 30 / 60 / 90%) → Submit → POSTs to `/api/process-bag`, which (in one Admin SDK batched write / transaction): calls `calculatePoints` from `src/lib/logic`, writes `bagProcessing`, appends a `transactions` ledger entry, increments `users.pointsBalance`, updates `inventory`, and calls `sendSMS()` stub
36. Inventory page: per-commodity weight + mini bars + threshold alerts

### Phase 8 — Depot Manager (~half day)
37. Depots overview + detail + Schedule Mill Pickup (creates `millShipments`, decrements inventory)
38. Monthly report PDF export

### Phase 9 — Admin polish (~half day)
39. Zone performance table, contamination alerts (with 1st/2nd/3rd strike logic), operator leaderboard
40. Compliance notices: generate Initial Service + Semi-Annual PDFs, "Mark as mailed" button

### Phase 10 — QR generation (~half day)
41. `/api/qr-sheet`: generate PDF with 10 QR codes + printed numbers sized for Rollo thermal label stock. Create `stickerSheets` + `bags` records atomically

### Phase 11 — Security & deploy (~half day)
42. Firestore rules: per-role read access + **lock down all privileged writes** — `transactions`, `users.pointsBalance`, `users.role`-related fields, `inventory`, and `bagProcessing` are Admin-SDK-only (no client writes). Residents read/write only their own `users` + `addresses` + `bagOrders`; operators read assigned routes and write `pickups`; admin full access
43. Storage rules for photo uploads
44. Seed script: 7 materials, 1 zone, 1 depot, 1 admin (Nicolas), 1 test operator, 1 test depot worker, 5 test residents
45. Deploy: rules (`firebase deploy --only firestore:rules,storage`) + Vercel production

### Phase 12 — Pilot onboarding (ongoing)
46. Print QR stickers with Rollo, hand-deliver first bag batch, collect in-person feedback, iterate

---

## Suggested execution cadence

| Day | Phases |
|---|---|
| 1 | Phase 0–1 (foundation + auth) |
| 2 | Phase 2–3 (types/logic + Resident MVP) |
| 3 | Phase 4–5 (admin core + routes) |
| 4 | Phase 6–7 (Operator + Depot) |
| 5 | Phase 8–11 (manager, admin polish, QR, deploy) |
| 6+ | Pilot iteration |

---

## Pilot success metrics

- 📍 Single HOA / district close to Kirk
- 👥 ~100 residents for initial pilot
- 🎁 ~$1,000 budget for gift card rewards
- 📝 In-person feedback collection from pilot users
- 🔄 Iterate based on real usage data → train AI later
- 🏭 QR sticker label printer: Rollo wireless thermal (prints from phone/tablet)
