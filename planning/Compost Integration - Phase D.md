# Compost Integration · Phase D — Route Operations & Program Rollout

**Date:** 2026-06-15
**Status:** Planning.
**Builds on:** [Phase A](./Compost%20Integration%20-%20Phase%20A.md),
[Phase B](./Compost%20Integration%20-%20Phase%20B.md),
[Phase C](./Compost%20Integration%20-%20Phase%20C.md). Operational design captured in
[Compost Route Ops - Design + Story](./Compost%20Route%20Ops%20-%20Design%20+%20Story.md).
Stakeholder summary in [Compost App - Status for Tia](./Compost%20App%20-%20Status%20for%20Tia.md).

## Where we are

Phases A–C delivered the data primitives, the operator intake flow, the diversion
report engine + UI, and a full import of Tia's three years of history into
production. The app currently handles **what happened at a single bin/stop** and
**reports on it**. Phase D builds everything **around** the stop — the driver's
day, the program's people, and the loops the spreadsheet handled by hand — plus
resolves the open product decisions surfaced to Tia.

## Decisions that gate this phase

These come from the Tia status doc. Several Phase D workstreams can't be finalized
until they're answered; build order should follow.

| # | Decision | Blocks |
|---|----------|--------|
| 1 | **Cars-equivalent**: keep her `lbs ÷ 1.17` or switch to ReFED `0.0005307037/lb`? | Report wording; trivial flag flip (`USE_REFED_CARS`). |
| 2 | **Lifetime totals**: measured-only (current) or preserve her historical reported baseline? | D5 (historical baseline model). |
| 3 | **Seasonal closures**: should sites have a "paused" status so summer gaps aren't read as missed pickups? | D5 (site status), report avg-fullness/gap logic. |
| 4 | **Report format**: sample of Dominique's exact City export to match precisely. | D2/D3 export polish. |
| 5 | **Destinations + contacts**: Alum Creek / London only? SMS contact numbers? | D1 truck-weight + delivery + auto-SMS. |
| 6 | **Cleaning workflow**: who marks bins cleaned (yard vs driver next day)? | D1 cart-cleaning queue. |
| 7 | **Skip reasons**: the 4–5 canonical reasons. | D1 skip action picker. |
| 8 | **Branding**: Compost Clubhouse vs "powered by WBCT" on City/client surfaces. | D4 city_viewer UI, report headers. |

Decisions 1 and 8 are quick. 5/6/7 are needed before D1 ships. 2/3 shape D5.

---

## Workstreams

### D1 — Route Operations (the centerpiece)

Turns the operator flow from a list of independent stops into a structured driving
day. Five independently shippable chunks (per the Route Ops design doc); ship in
order.

**D1.1 — Per-bin/stop actions.** On the stop screen, each bin (or the stop) gets
*Swapped* · *Loaded* · *Skipped* · *Damaged*.
- *Swapped* = gave clean empties, took fulls. *Loaded* = dumped into truck, set
  same bins back. (Both still record weight; the distinction matters to the office
  and to the cleaning queue.)
- *Skipped* requires a reason (decision #7); records no weight.
- *Damaged* prompts for a photo; flags the bin for replacement.
- Data: extend `binPickups` with `action`, `skipReason?`, `damaged?` (the doc
  already carries `routeId`, `photoUrl`, `contaminationSeverity`).

**D1.2 — Truck weight + destination.** Running truck-weight total at the top of the
route screen; an "Add weight" entry after stops; at ~1 ton a prompt to pick a
destination (decision #5); an auto-SMS to that facility via the existing
`sendSMS()` stub; a "Confirm delivery" button that records the drop and resets the
running weight to zero.
- New collection `compostDeliveries`: `{ routeId, destination, weightLbs,
  confirmedAt, smsSent }`.

**D1.3 — Route record.** A real "today's run" object: *Start Route* at shift
start, all stops/weights/deliveries attached, *End Route* with a summary screen
("12 stops · 1 skipped · 18 carts swapped · 2,340 lbs delivered · 1 damaged").
- New collection `compostRoutes`: `{ id, zoneId, operatorId, date, status:
  'in_progress' | 'completed', startedAt, endedAt, summary }`. Pickups/deliveries
  reference it via `routeId`. Admin can review any past route.

**D1.4 — Cart return + cleaning queue.** Admin queue: bins come back from a route →
**Returned** → someone marks **Cleaned/Ready** (decision #6); damaged bins go to a
"Needs replacement" list.
- Extend the reusable-bin `BagDoc` with a `binStatus: 'ready' | 'out' |
  'returned' | 'cleaning' | 'needs_replacement'` lifecycle (separate from the
  sticker/bag status used by the recycling side).

**D1.5 — Route-aware reporting.** Surface route summaries + contamination/skip
rates in `/admin/compost`. Feeds D2.

> Out of scope for D1 (per Route Ops doc): multi-driver dispatch assignment and
> live GPS/ETA. Drivers tap "en route" manually. Add multi-driver only when Tia
> hires a second driver.

### D2 — Quarterly notes

A per-site notes log (`compostNotes`: `{ siteId, year, quarter, date, note,
authorId }`) mirroring her "Quarterly Notes" sheet, surfaced on the site detail
page and rolled into the report narrative. Low effort, high value for the City
contamination story.

### D3 — Automated monthly email distribution

Replace the manual mail-merge. A monthly job (admin-triggered first, cron later)
sends each active site its weight + cumulative + impact for the month, via the
existing email/SMS stub. Mirrors the workbook's "Emails" sheet (per-site weight,
cumulative, cars-eq, backup email). Needs decision #4 (format) and site contact
backfill (D6). Build the typed adapter + admin "send this month's reports" action;
log sends to an `emailLog` collection (matches her "Email Logs" sheet).

### D4 — Roles & access

Two new invite-only roles (same pattern as operator/depot/manager — admin issues
an `invites/{token}`, user accepts, claim set via Admin SDK; gate in `proxy.ts`):

- **`program_manager`** (Dominique) — zone-scoped read + admin on commercial
  accounts, pickups, routes, and reports. Effectively a compost-only admin.
- **`city_viewer`** (Ari, City of Columbus) — read-only, scoped to the
  `city_of_columbus` affiliation: can view/export only City diversion reports.

Touches `src/lib/types/role.ts`, `proxy.ts` route gating, the invite flow, and a
new `/program` (or scoped `/admin/compost`) entry surface. Branding per decision
#8 on the city_viewer surface.

### D5 — Historical baseline & site status (depends on decisions 2 & 3)

- **Site status** — add a `paused` / seasonal-closure concept to
  `commercialAccounts` so summer gaps for schools don't read as missed pickups and
  don't distort avg-fullness. Resolves decision #3.
- **Historical baseline (only if decision #2 = preserve)** — a
  `compostMonthlyBaseline` snapshot of her spreadsheet's reported per-site
  monthly/cumulative figures for months before go-live, displayed for historical
  months while the live engine takes over for new pickups. If decision #2 =
  measured-only, this workstream is dropped and we keep the current
  `METHODOLOGY_NOTE`.

### D6 — Polish & data hygiene

- **Site contact backfill** — fill missing site emails (gates D3 reach).
- **Month timezone** — report month buckets currently use UTC from each pickup's
  timestamp; switch to America/New_York so late-evening pickups land in the
  correct Columbus month. Small, do before heavy reporting use.
- **Branding** — apply decision #8 to report headers and any City-facing screen.
- **Cars-equivalent** — apply decision #1 (flip `USE_REFED_CARS` or keep).

---

## Suggested sequencing

1. **Quick wins first** — decisions #1 and #8; D6 timezone fix. (Hours, not days.)
2. **D2 quarterly notes** — small, unblocks the contamination narrative.
3. **D1 route operations** — once decisions #5/#6/#7 are in. Ship chunks
   D1.1 → D1.5 in order; each is usable on its own.
4. **D4 roles** — so Dominique and the City can self-serve; pairs well with D3.
5. **D3 automated emails** — after D6 contact backfill + decision #4 format.
6. **D5 baseline/status** — gated on decisions #2/#3; do once Tia has seen the
   measured-vs-estimated tradeoff in the live app.

---

## New data model (summary)

| Collection / field | Purpose | Workstream |
|--------------------|---------|------------|
| `compostRoutes` | the driver's day record | D1.3 |
| `compostDeliveries` | truck drops to facilities | D1.2 |
| `binPickups.action / skipReason / damaged` | per-stop action detail | D1.1 |
| `BagDoc.binStatus` | reusable-bin cleaning lifecycle | D1.4 |
| `compostNotes` | per-site quarterly notes | D2 |
| `emailLog` | monthly report send log | D3 |
| `Role: program_manager / city_viewer` | program + City access | D4 |
| `commercialAccounts.status` (paused) | seasonal closures | D5 |
| `compostMonthlyBaseline` | historical reported figures (conditional) | D5 |

All compost collections stay isolated from the recycling program; all privileged
writes go through Admin SDK API routes per the repo trust boundary; points math is
untouched (food scrap is diversion-only).

## Open questions (consolidated)

All eight gating decisions above. Most urgent for the next build step: the route
logistics (destinations, SMS contacts, cleaning workflow, skip reasons) for D1,
and Dominique's exact report format for D3.

## Out of scope (for Phase D)

- Multi-driver route assignment / dispatch (until a second driver).
- Live GPS tracking / automatic ETAs.
- Compost voucher redemption (until the Columbus facility is producing — mirrors
  the gift-card queue when it lands).
- Direct Google Sheets sync (the app is the source of truth; we export on demand).
