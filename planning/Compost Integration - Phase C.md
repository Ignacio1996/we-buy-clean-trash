# Compost Integration · Phase C — Reporting (matching Tia's workbook)

**Date:** 2026-06-15
**Status:** In progress. Foundation + report engine + report UI + historical import (to production) shipped; quarterly notes, email distribution, and the program_manager/city_viewer roles planned.
**Builds on:** [Phase A](./Compost%20Integration%20-%20Phase%20A.md), [Phase B](./Compost%20Integration%20-%20Phase%20B.md)

## Why this phase exists

Both Phase A and Phase B closed with the same blocker: *"need a sample of
Dominique's current Columbus monthly export to match the format exactly."*

We now have the real artifact — **"Compost Clubhouse Collection Data (3).xlsx"**,
the master workbook Tia and Dominique actually run the business on. Phase C
replicates it. This doc captures the analysis so the report math is legible and
reproducible.

## The workbook, in four layers

The 14 sheets fall into four functional groups:

**1. Raw intake**
- **Form Responses** (~1,600 rows) — one row per pickup since Jul 2023:
  timestamp, site, # bins, fullness (0/.25/.5/.75/1), bin size, computed
  weight, comments, photo. → maps to our `binPickups` collection.
- **Directory** — the site master. Columns: No., Name, **Affiliation**,
  Address, **First Month of Data**, Collection Day, Size of Bins, # of Bins,
  # pickups/week, Contact Email, Note, Active?. → maps to `commercialAccounts`.

**2. Reference constants — "Static Values"**
- Full-bin weights: 32→130, 48→195, 64→260 lbs
- **Monthly Multiplier = 4.35** (weeks per month)
- ReFED: 1 ton = 5.41 CO₂eq / 1.17 passenger-vehicles-yr; per-lb =
  0.00245393764 CO₂eq, 0.0005307037 cars.

**3. Computation engine — "Fill in the Gaps CCH" / "Fill in the Gaps CoC"**
One block per site, one row per month. The real IP. Per site-month:
- `Reported Total` = `SUMIFS(Form Responses weight)` for that site + month
- `Monthly Total` = **`(Reported Total / # entries) × 4.35`** — the month's
  *weekly average* extrapolated to a standard month, NOT a raw sum
- **Gap-fill (legacy)**: in her sheet, a month with zero entries carries the
  previous month's total forward. ⚠️ **The app deliberately does NOT do this** —
  see "Measured totals" below.
- Cumulative weight, avg fullness, avg bin count.

### Measured totals — where the app intentionally diverges (decision 2026-06-15)

Inspecting the workbook's own computation (e.g. The Wellington School) revealed
three behaviours that are **manual editorial artifacts, not derivable from the
pickup data**:

1. **Seasonal blanking** — months hand-annotated `"Closed For Summer"` /
   `"Not Open Yet"` are blanked (schools close every summer).
2. **Manual cumulative resets** — Wellington's running total hit ~105k by May
   2025 then **resets to 0 in Sep 2025** (new school year). Her reported
   "all-time" is really "cumulative since the last manual reset."
3. **Carry-forward forever** — discontinued sites (Chapman's) keep accruing
   their last monthly total every month indefinitely (~1,272 × 30 ≈ her 37,870),
   estimating weight that was never collected.

Because these can't be reproduced from raw pickups (and represent estimates, not
measured weight), the app uses **measured totals**:
- A month with no pickups contributes **0** (no carry-forward, no resets).
- Cumulative = running sum of measured monthly totals.
- The monthly KPI **excludes inactive sites** (matches her shared reports, which
  blank discontinued sites).

**Consequence:** the **monthly report matches her workbook exactly** for active
sites (e.g. CCH April 2026 = 27,966.33 lbs, to the cent). **All-time figures
differ** for sites with gaps/closures (e.g. Florin all-time: app 28,390 vs sheet
33,374) because the app counts only measured pickups. This is surfaced in-app via
`METHODOLOGY_NOTE` on every report and export.

**4. Output / distribution**
- **Monthly Reports CCH** & **Monthly Reports CoC** — the two formatted reports,
  one per affiliation (Compost Clubhouse client sites vs City of Columbus
  drop-off). Monthly + all-time KPIs (lbs, tons, "cars off the road"), a
  per-site "Monthly Summary" table, and an "All Time Summary" table with
  **Months Active** (`DATEDIF(firstMonthOfData, reportMonth)`).
- **Quarterly Notes** — per-site contamination/recommendation log feeding the
  report narrative.
- **Emails / MailSuite Emails / Email Logs** — monthly mail-merge: each site
  gets an email with its weight, cumulative total, and cars-equivalent.

## Weight model — the linear formula (decision: match her)

Her reports aggregate the **"Alternative Weight"** column, which is **linear**:

```
weight = binCount × fullnessFraction × fullBinWeight
fullBinWeight = { 32: 130, 48: 195, 64: 260 }   # Static Values sheet
```

(Her sheet also has a second "Weight" column built on a stepped, 32-gal-only
bucket table — but the reports do **not** use it. Ignore it.)

Phase A's `binWeightTable.ts` had originally used a non-linear "bucket" table
(32-gal: 30/60/90/130; 64-gal: 60/120/180/260) which diverged ~8% from her
reports for 32 and 64-gal bins. **Decision (2026-06-15): switch the app to her
linear formula** so the app reproduces her three-year history exactly. Done —
`BIN_WEIGHT_TABLE` now holds `fullnessFraction × fullBinWeight` for every bucket,
and `FULL_BIN_WEIGHT_LBS` is exported for the report engine.

## CO₂ / cars-equivalent — known discrepancy (decision: reproduce + flag)

Her workbook computes "CO2e of Cars Off the Road" as **`lbs / 1.17`**. The 1.17
is ReFED's cars-per-**ton** factor, so dividing pounds by it is dimensionally
wrong and inflates the figure ~1,900× vs. the correct per-lb constant. Example:
33,374 lbs → her sheet says ≈28,524 "cars"; the correct figure is ≈17.7 cars.

**Decision (2026-06-15): reproduce her `lbs / 1.17` for continuity with reports
clients have already received, but flag it.** Implemented in
`src/lib/logic/compostReporting.ts`:
- `carsEquivalent(lbs)` returns `lbs / LEGACY_CARS_DIVISOR` (1.17) by default.
- A `USE_REFED_CARS` flag flips it to the correct `REFED_CARS_PER_LB` if Tia
  ever agrees to correct it.
- `carsEquivalentNote` is the footnote every report surface must render.
- A `// KNOWN DISCREPANCY` comment documents the correct constant inline.

## What shipped so far (Phase C foundation)

1. **Linear bin weights** — `src/lib/logic/binWeightTable.ts` rewritten to the
   linear model + `FULL_BIN_WEIGHT_LBS` export. The `interpolated` flag is
   retained on the entry type for compatibility but no entry sets it.
2. **Reporting constants** — `src/lib/logic/compostReporting.ts` (NEW):
   `MONTHLY_MULTIPLIER`, `LBS_PER_TON`, ReFED constants, `co2eqTons()`,
   `carsEquivalent()`, `carsEquivalentNote`, `USE_REFED_CARS`.
3. **`firstMonthOfData`** added to `CommercialAccountDoc` (Timestamp | null),
   wired through the create (`POST`) and edit (`PATCH`) routes (accepts a
   `YYYY-MM` month input, pinned to the first of the month UTC) and surfaced as
   a "First month of data" field in the admin new-site form. Excluded from the
   client `CommercialAccountView` (server-only; the report engine reads it
   directly).
4. **Report engine** — `src/lib/logic/compostReport.ts` (NEW, pure). Input:
   plain `ReportPickupInput[]` (the binPickups analogue) + `ReportSiteInput[]`
   (the directory) + a target "YYYY-MM". Output: per-site month-by-month series
   replicating "Fill in the Gaps" (reported total, weekly-avg × 4.35, gap-fill
   carry-forward, cumulative, avg fullness, avg bin count) and an assembled
   `CompostMonthlyReport` (monthly + all-time KPIs in lbs/tons/cars, per-site
   "Monthly Summary" + "All Time Summary" lines with months-active). All month
   math on "YYYY-MM" keys; no Firebase/Next imports. Verified by
   `scripts/verify-compost-report.ts` (`npm run verify:compost-report`) against
   hand-checked workbook values — the Chapman's Jul→Aug 2023 extrapolation +
   gap-fill (585 lbs/2 entries → 1272.375 monthly → 2544.75 cumulative after a
   gap month) and the 33-month span.

### Files touched

```
src/lib/logic/binWeightTable.ts                    linear model + FULL_BIN_WEIGHT_LBS
src/lib/logic/compostReporting.ts                  NEW — constants + impact helpers
src/lib/logic/compostReport.ts                     NEW — pure report engine
scripts/verify-compost-report.ts                   NEW — engine verification
src/lib/types/commercialAccount.ts                 + firstMonthOfData
src/app/api/admin/commercial-accounts/route.ts     + firstMonthOfData (POST)
src/app/api/admin/commercial-accounts/[id]/route   + firstMonthOfData (PATCH)
src/app/admin/commercial-accounts/CommercialAcc…   + month input, view omits field
src/app/admin/commercial-accounts/page.tsx         strip firstMonthOfData from view
package.json                                       + verify:compost-report script
```

5. **`/admin/compost/reports`** — SHIPPED. Server page reads `month` +
   `affiliation` from searchParams, loads data via
   `src/lib/admin/loadCompostReportData.ts` (maps `binPickups` →
   `ReportPickupInput`, `commercialAccounts` → `ReportSiteInput`, bins-on-site
   from reusable bags), and renders the workbook layout: KPI band (monthly +
   all-time lbs/tons/cars), "Monthly Summary" + "All Time Summary" tables,
   cars-equivalent footnote. `CompostReportClient` handles the month/affiliation
   filters (URL-driven), **CSV export** (client Blob), and **Print/PDF**
   (print-friendly layout via `window.print`). Admin-gated by `src/proxy.ts`
   (`/admin` prefix). Inactive sites render greyed, matching the sheet.

   **Separation from the recycling app:** the admin sidebar now splits into a
   "Compost · Tia" group (Commercial sites + Diversion reports) below the
   recycling items. Reports live under the `/admin/compost/*` namespace, read
   only compost collections (`commercialAccounts`, `binPickups`), and never
   touch points / inventory / transactions.

### Files touched (step 5)

```
src/lib/admin/loadCompostReportData.ts             NEW — Firestore → engine inputs
src/app/admin/compost/reports/page.tsx             NEW — server page
src/app/admin/compost/reports/CompostReportClient  NEW — filters + tables + export
src/components/admin/AdminNav.tsx                   split into recycling + compost groups
```

6. **Historical data import** — SHIPPED (run to **production** 2026-06-15).
   Tia's master workbook was extracted + normalized into
   `scripts/data/compost-import.json` (22 real sites — 12 Compost Clubhouse + 10
   City of Columbus, 19 active — and 1,528 pickups; 2 test rows and 3 junk
   contact-info rows dropped). `scripts/import-compost-data.ts`
   (`npm run import:compost [-- --commit]`) writes them idempotently:
   - Creates a dedicated **`columbus-compost`** zone + depot (isolated from
     recycling zones).
   - Upserts each site as a `commercialAccounts` doc (deterministic slug ID,
     `binsOnSite` from the Directory, `firstMonthOfData`, affiliation, etc.).
   - Writes `binPickups` with weights recomputed via the linear table.
   - Everything tagged `importSource: 'compost-workbook'`; a re-run deletes the
     prior import first, so it never duplicates and is trivially reversible.
   - Touches ONLY compost collections — never points/transactions/inventory.
   - Built-in spot-check confirms CCH April 2026 monthly = 27,966.33 (exact).

   Added `binsOnSite` to `CommercialAccountDoc` (Directory's "# of Bins"); the
   report loader prefers it over provisioned-bag counts. Wired through the
   create/PATCH routes + admin form + account card.

### Files touched (step 6)

```
scripts/data/compost-import.json                   NEW — extracted + normalized workbook
scripts/import-compost-data.ts                     NEW — idempotent Firestore import
src/lib/types/commercialAccount.ts                 + binsOnSite
src/lib/admin/loadCompostReportData.ts             prefer declared binsOnSite
src/app/api/admin/commercial-accounts/route.ts     + binsOnSite (POST)
src/app/api/admin/commercial-accounts/[id]/route   + binsOnSite (PATCH)
src/app/admin/commercial-accounts/CommercialAcc…   + bins-on-site input + card stat
package.json                                       + import:compost script
```

## What's next (Phase C build)

7. **Quarterly notes** — a per-site note log (year/quarter/date/note) so the
   report narrative carries forward. Maps the "Quarterly Notes" sheet.
8. **Monthly email distribution** — mirror the "Emails" mail-merge (per-site
   weight, cumulative, cars-eq) via the existing `sendSMS()`/email stub.
9. **`program_manager` role** (Dominique) — zone-scoped read+admin on
   commercial accounts, pickups, reports. (Carried from Phase A/B.)
10. **`city_viewer` role** (Ari, City of Columbus) — zone-scoped read-only on
    diversion reports.

## Validation targets (from the workbook, Apr 2026 CCH report)

The **monthly** figures match the app exactly (active sites). **All-time**
figures are the workbook's; the app reports lower measured totals where sites
have gaps/closures (see "Measured totals" above) — the monthly match is the
contractual one Tia sends clients.

| Site | Monthly lbs (app = sheet) | Sheet all-time | Months active |
|------|---------------------------|----------------|---------------|
| Florin Cafe | 1,036.75 | 33,373.925 | 33 |
| The Columbus Foundation | 805.8375 | 19,347.16875 | 33 |
| Overlook Cafe | 1,215.825 | 44,700.41875 | 33 |
| The Wellington School | 7,634.25 | 46,406.34375 | 28 |

**CCH monthly total (Apr 2026): 27,966.33 lbs = 13.98 tons — reproduced exactly
by the app** (`npm run verify:compost-report` + the import spot-check).

## Open questions

- **Affiliation values** — confirm the canonical tags. Workbook uses
  "Compost Clubhouse " (trailing space) and "City of Columbus". We normalize to
  `compost_clubhouse` / `city_of_columbus`.
- **Report export format** — CSV is straightforward; the PDF should mirror the
  "Monthly Reports" sheet layout. Confirm Dominique wants both.
- **Cars-equivalent** — reproduce-and-flag is the current call; revisit with
  Tia whether to correct it.
- Compost Clubhouse branding vs "powered by WBCT" on reports — **TBD** (carried).
```
