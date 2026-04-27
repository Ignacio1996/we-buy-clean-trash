# Compost Integration · Phase B — Compost-specific intake

**Date:** 2026-04-27
**Status:** Phase B shipped. Phase C planned.
**Builds on:** [Phase A](./Compost%20Integration%20-%20Phase%20A.md)

## What this phase unlocks

Tia's drivers can stop using Linktree + Google Sheets. They open the operator
app, see today's commercial sites in their zone, scan/select a site, enter
fullness per bin, and submit. The server runs the bin-weight lookup and writes
a diversion record + inventory update.

Phase A laid the primitives (modes, bin table, commingled handling, dynamic
material chips). Phase B turns them into a working flow.

## What shipped (Phase B)

### 1. Reusable bin containers
`BagDoc` extended with two optional fields:
- `containerType: 'bag' | 'bin_32' | 'bin_48' | 'bin_64'` — defaults to
  `'bag'` for legacy docs via `resolveContainerType`.
- `reusable: boolean` — bins stay active across pickups (no status flip
  to `processed`); single-use bags retire on process as before.
- `commercialAccountId: string | null` — set on bins, mutually exclusive
  with `residentId`.

Helpers: `isBinContainer`, `containerBinSize` (maps `bin_32` → `BinSize '32'`).

### 2. Commercial account model
New `commercialAccountDoc` collection. Mirrors Compost Clubhouse's "Directory"
sheet:
- `businessName`, `contactName`, `contactPhone`, `contactEmail`
- Address (`street`, `unit`, `city`, `state`, `postalCode`, `geo`)
- `zoneId` — site lives in one zone (drives operator filtering)
- `defaultBinSize` — used when provisioning new bins
- `pickupsPerWeek` (1–7), `collectionDays: number[]` — ISO weekday 1–7
- `affiliationId: string | null` — free-form tag (e.g. `compost_clubhouse`,
  `city_of_columbus`). Drives report filtering in Phase C.
- `materialIds: MaterialId[]` — what's picked up here (typically
  `['food_scrap']`)
- `active: boolean` — soft-delete flag
- `driverNotes` — gate codes, bin location, etc.

Sites are admin-onboarded only. No public signup.

### 3. Admin: `/admin/commercial-accounts`
Full CRUD page. Add a site, edit fields, archive (soft-delete preserves
history). Each card shows zone, default bin, schedule, materials, driver
notes, and a bin counter. **"Provision bins"** mints N bins of a chosen
size in one transaction — each bin gets a `BIN-NNNN` QR code, becomes a
reusable BagDoc, and is attached to the account. Up to 50 per request.

Side-nav now has 🏢 Commercial sites between "Bag stickers" and "Pricing."

### 4. `accountType` on the user model
- `accountType: 'resident' | 'commercial_site'` — optional, defaults to
  `'resident'` for legacy users via `resolveAccountType`.
- `commercialAccountId: string | null` — links a portal-enabled commercial
  user to their site.

Sites can exist without a UserDoc (drivers do everything). The accountType
field only matters when the site has been granted portal access.

### 5. Resident UI gates for commercial accounts
- `BottomNav` now takes an `items` prop. Layout picks
  `CONSUMER_ITEMS` vs `COMMERCIAL_ITEMS` based on `accountType`.
  Commercial portals see only Home + Profile.
- `/resident/calculator`, `/resident/order-bags`, `/resident/scan-bag`
  all call `requireConsumerResident()` — commercial users are bounced
  back to `/resident`.
- `/resident` branches: commercial users see `<CommercialResidentHome />`
  (site directory card + 30-day diversion total + recent pickups list)
  instead of the points/orders dashboard.

### 6. Operator-only intake flow
**`/operator/compost`** — lists active commercial sites in the operator's
zone. "TODAY" badge on sites whose `collectionDays` includes the current
ISO weekday. Sorted by today-first, then alphabetically.

**`/operator/compost/[id]`** — site stop screen:
- Site header with address, contact, affiliation tag, schedule, driver notes
- Material picker (filtered to `bin_fullness` materials accepted by the site)
- One row per provisioned bin (or a manual-entry row if none provisioned)
- Per-row fullness picker (5 buckets: 0/25/50/75/100%) — large touch targets
- Estimated lbs per bin from `BIN_WEIGHT_TABLE`, with `(estimated)` flag
  on the interpolated 48-gal intermediates
- Total weight panel + contamination severity + notes
- Submit → green "Record pickup" CTA

**`POST /api/process-bin-pickup`** — server:
- Validates account, material accepted, bin sizes match provisioned bins
- Computes weights via `binFullnessToWeightLbs`
- Atomically writes `binPickups` doc + increments
  `inventory[commercial_${zoneId}_${materialId}]` (separate namespace from
  depot inventory)
- Tags inventory with `scope: 'commercial'` so reports can split
  residential vs commercial diversion
- Optional photo upload via existing `uploadPhoto` helper

Driver banner on `/operator` shows **🥬 Compost route — N sites in zone**
when commercial sites exist for the operator's zone.

## Files touched

```
src/lib/types/bag.ts                              + ContainerType, helpers, optional fields
src/lib/types/user.ts                             + AccountType, helpers, optional fields
src/lib/types/commercialAccount.ts                NEW
src/lib/types/binPickup.ts                        NEW
src/components/admin/AdminNav.tsx                 + Commercial sites link
src/app/admin/commercial-accounts/page.tsx        NEW
src/app/admin/commercial-accounts/Commercial…     NEW (client)
src/app/api/admin/commercial-accounts/route.ts    NEW (POST)
src/app/api/admin/commercial-accounts/[id]/...    NEW (PATCH, DELETE)
src/app/api/admin/commercial-accounts/[id]/bins   NEW (POST mint bins)
src/app/api/process-bin-pickup/route.ts           NEW
src/app/operator/page.tsx                         + compost route banner
src/app/operator/compost/page.tsx                 NEW
src/app/operator/compost/[id]/page.tsx            NEW
src/app/operator/compost/[id]/BinPickupForm.tsx   NEW
src/lib/auth/residentAccount.ts                   NEW (loadResidentAccount, requireConsumerResident)
src/components/resident/BottomNav.tsx             + items prop, COMMERCIAL_ITEMS
src/app/resident/layout.tsx                       + accountType-aware nav
src/app/resident/page.tsx                         + commercial branch
src/app/resident/CommercialResidentHome.tsx       NEW
src/app/resident/calculator/page.tsx              + requireConsumerResident
src/app/resident/order-bags/page.tsx              + requireConsumerResident
src/app/resident/scan-bag/page.tsx                + requireConsumerResident
```

## What changes for Kirk's side

**Nothing for residents.** All consumer flows still work exactly as before
(legacy bags default to `containerType: 'bag'`, users default to
`accountType: 'resident'`).

What's available to Kirk as admin:
- Commercial-account onboarding (he can use it for his commercial bulk
  collection if/when needed)
- Reusable bins for non-compost flows (textiles drop-bins, etc.)

## What's missing (Phase C)

1. **Diversion report export** — `/admin/reports?zone=&from=&to=&affiliation=`
   filter, grouped by material, exported to CSV/PDF in Dominique's Columbus
   monthly format. Need a sample export from her to match exactly.
2. **`program_manager` role** — Dominique-style: zone-scoped read+admin on
   commercial accounts, pickups, reports.
3. **`city_viewer` role** — Ari (City of Columbus): zone-scoped read-only
   on diversion reports.
4. **Cars-equivalent + CO₂eq impact stats** — already in Tia's monthly
   emails. ReFED constants:
   `1 lb = 0.00245393764 t CO₂eq = 0.0005307037 cars/year`. Surface on
   commercial-account dashboards + reports.
5. **Compost voucher redemption (optional)** — admin-fulfilled queue for
   "free compost units" once Columbus facility is producing. Mirrors
   gift-card pattern. Skip for v1 per locked-in lean.

## Future considerations (out of B/C scope)

- **Compost route abstraction** — currently the operator sees today's sites
  in their zone but there's no "route" record assigning specific stops to
  specific drivers. Add when Tia onboards a second driver.
- **Per-bin contamination flags** — currently severity is recorded once per
  pickup (matches the bag flow). If Tia wants per-bin granularity, extend
  `BinPickupBinEntry` with `contamination?: ContaminationSeverity`.
- **Bin retirement** — physical bins eventually get damaged/replaced. Need a
  "retire bin" admin action that flips `status` away from `unused` so it
  drops off the operator UI without breaking historical pickups.

## Local commands

```bash
npm run seed:materials -- --force   # re-seed materials with Phase A modes
npm run dev                          # Next.js
npx tsc --noEmit                     # typecheck
npm run lint                         # ESLint
npm run build                        # production build
```

## Open questions (carried from Phase A)

- Sample of Dominique's current Columbus monthly export — **needed for Phase C**
- Compost voucher v1 (Phase C) or skip until facility ships? — **lean skip**
- Compost Clubhouse branding on commercial-account screens, or "powered by WBCT"? — **TBD**
- Pre-service compliance letters apply to commercial accounts? — **TBD**
