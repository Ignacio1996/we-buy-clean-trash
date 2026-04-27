# Compost Integration · Phase A — Foundation

**Date:** 2026-04-27
**Status:** Phase A shipped. Phase B + C planned.

## Background

Tia (Compost Clubhouse) and Kirk (US Refuse / We Buy Clean Trash) independently
asked for several overlapping features on Apr 27:

- **Tia:** wants to migrate her commercial food-scrap collection off Linktree +
  Google Sheets into the WBCT platform. 19 active sites today, split across
  two affiliations: Compost Clubhouse (private) and City of Columbus (public
  drop-off). Drivers measure pickups by **bin count + fullness per bin**, not
  weight at scale. Reward model is access to free compost, not cash.
- **Kirk:** wants to add/remove materials anytime (textiles, electronics,
  clothing donations). Wants commingled bags to record weight without paying
  points. Wants per-depot material acceptance — Tocco Hills can refuse glass
  while another depot accepts it.

Both asks share the same primitives. Phase A builds those primitives once;
Tia's compost flow becomes a thin layer on top in Phase B.

## What shipped (Phase A)

### 1. `payoutMode` on every material
Every material is either:
- **`cash`** — pays points (existing 7 commodities)
- **`diversion_only`** — weight recorded for landfill-diversion reports, no points

`calculatePoints` skips dollar contribution for `diversion_only` materials.
The mode is snapshotted onto each `bagProcessing.priceSnapshot` entry, so
historical records reflect the mode at the time even if it changes later.

### 2. `measurementMode` on every material
Every material declares how its weight is captured:
- **`bag_weight`** — depot worker enters lbs at the scale (existing flow)
- **`bin_fullness`** — driver picks a fullness bucket per bin; weight is
  derived from a lookup table. **Used by compost in Phase B.**

### 3. Material CRUD with mode picker
Admin → Pricing now lets admins:
- Add new materials with a name, mode toggle (Cash / Diversion-only), and
  measurement-mode select
- Toggle existing materials active/inactive
- Soft-delete only — historical bagProcessing/inventory records keep working
- Diversion-only rows hide the price fields (kept honest), show a blue badge
- Pricing-campaign material picker now correctly excludes diversion-only
  materials (×N on $0 is still $0)

### 4. Per-depot accepted materials (UI dynamic)
Admin → Zones & Depots chip list now iterates the live materials collection,
not the static seed. Custom materials (compost, textiles, etc.) appear and
can be toggled per depot. Depot PATCH validates against active materials.

### 5. Bin weight lookup table
`src/lib/logic/binWeightTable.ts` — exact values from Compost Clubhouse's
"Static Values" sheet (verified by on-site weighing 9/21/23 at City of Columbus
sites):

| Bin size | 0% | 25% | 50% | 75% | 100% |
|----------|----|-----|-----|-----|------|
| 32 gal   | 0  | 30  | 60  | 90  | 130  |
| 48 gal   | 0  | 49* | 98* | 146*| 195  |
| 64 gal   | 0  | 60  | 120 | 180 | 260  |

\* 48-gallon intermediate buckets are linearly interpolated until measured on-site.
Marked `interpolated: true` on the entry so reports can footnote the estimate.

Not yet wired into a UI — Phase B uses it.

### 6. Commingled bag handling at the depot
Process-bag form has a new **Commingled** checkbox (pre-checked when bag was
declared `mixed`). When checked: weights still flow to inventory and the
diversion ledger, but `pointsAwarded` is forced to 0. Matches Kirk's exact
scenario: *"the commingle, plastic and glass mixed, he would get the weight,
but he won't get no points."*

### 7. Two new seeded materials
`scripts/seed-materials.ts` now seeds:
- `commingled` — diversion_only / bag_weight — for Kirk's commingled-bag flow
- `food_scrap` — diversion_only / bin_fullness — for Tia's compost pickups

The 7 cash commodities now also seed `payoutMode: 'cash'` and
`measurementMode: 'bag_weight'` explicitly. Run `npm run seed:materials` (add
`--force` to backfill existing materials docs).

## Files touched

```
src/lib/types/material.ts          + PayoutMode, MeasurementMode, guards
src/lib/types/depot.ts             + updatedAt optional
src/lib/types/bagProcessing.ts     + commingled
src/lib/logic/calculatePoints.ts   + skip $ for diversion_only
src/lib/logic/binWeightTable.ts    NEW — bin-fullness lookup
src/lib/admin/loadActiveMaterials  + surface modes
src/app/api/admin/materials/route  + persist modes
src/app/api/admin/depots/[id]/...  + validate against active materials
src/app/api/process-bag/route.ts   + commingled flag + mode snapshot
src/app/admin/pricing/page.tsx     + load modes, filter campaign options
src/app/admin/pricing/PricingForm  + Mode column, mode picker on new
src/app/admin/zones/page.tsx       + load materials, strip updatedAt
src/app/admin/zones/ZonesClient    + dynamic material chips
src/app/depot/process/.../Process… + Commingled toggle
scripts/seed-materials.ts          + commingled, food_scrap, modes
```

## What changes for the existing WBCT app (Kirk's side)

**Behavior for residents and operators: nothing changes.** All existing
recyclable flows work exactly as before. The 7 commodities still pay the same.

What Kirk gains as admin (things he asked for on the call):
- Add/remove materials anytime
- Cash vs Diversion-only distinction (textiles, electronics donations, etc.)
- Commingled bag handling at the depot

## What's missing (Phase B + C)

Phase B is what unlocks Tia's drivers actually using the app instead of Linktree.

### Phase B — Compost-specific intake

1. **Reusable bin containers** — extend bag/container model with
   `containerType: "bag" | "bin_32" | "bin_48" | "bin_64"` and
   `reusable: boolean`. QR sticker stays on the bin permanently; pickup empties
   the bin instead of retiring it.
2. **Operator-only intake flow** — `intakeMode: "resident_scan" | "operator_scan"`.
   For operator-scan: driver scans the bin at the site, picks bin count, then
   picks fullness per bin from the buckets. Server multiplies via
   `binFullnessToWeightLbs` to get total lbs.
3. **Commercial accounts** — `accountType: "resident" | "commercial_site"`. Sites
   are admin-onboarded only (no public signup). Account fields: business name,
   address, contact, list of bins, zone, default bin size, # pickups/week,
   collection day. Mirrors Dominique's Directory sheet.
4. **Affiliation tag** — `affiliationId` on commercial accounts (e.g.
   "compost_clubhouse" / "city_of_columbus"). Drives report filtering. Not a
   separate "program" abstraction — just a tag.
5. **Commercial residents skip resident-app screens** — calculator / order-bag /
   scan-bag are hidden for accounts whose only material is operator-scan.

### Phase C — Reporting + roles

6. **Diversion report export** — Admin → Reports filtered by zone + date range,
   grouped by material → CSV/PDF in Dominique's Columbus monthly format. Need
   a sample export from her to match exactly.
7. **`program_manager` role** — Dominique-style: zone-scoped read+admin on
   commercial accounts, pickups, reports.
8. **`city_viewer` role** — Ari (City of Columbus): zone-scoped read-only on
   diversion reports.
9. **Cars-equivalent + CO2eq impact stats** — already in Tia's monthly emails.
   Add to commercial-account dashboards using ReFED constants
   (1 lb = 0.00245393764 t CO2eq = 0.0005307037 cars/year).
10. **Compost voucher redemption (optional)** — admin-fulfilled queue for
    "free compost units" once Columbus facility is producing. Mirrors
    gift-card pattern. Skip for v1; Tia's v1 is report-only.

## Open questions

- One QR per site (driver enters bin count + fullness per bin) — **answered yes**
- Sample of Dominique's current Columbus monthly export — **needed for Phase C**
- Compost voucher v1 (Phase C) or skip until facility ships? — **lean skip**
- Compost Clubhouse branding on commercial-account screens, or "powered by WBCT"? — **TBD**
- Pre-service compliance letters apply to commercial accounts? — **TBD**

## Local commands

```bash
npm run seed:materials -- --force   # backfill modes + add commingled / food_scrap
npm run dev                          # start Next.js
npx tsc --noEmit                     # typecheck
npm run lint                         # ESLint
```
