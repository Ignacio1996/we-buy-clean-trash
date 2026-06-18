# Compost Integration · Phase D — Route Operations & Program Rollout

**Date:** 2026-06-15
**Status:** In progress. Gating decisions resolved with Tia (2026-06-15). Landed
so far: D1.1 stop actions + skip reasons, D1.4 cleaning/damaged toggles, D5 paused
site status, D1.2′ tap-triggered on-the-way SMS + `compostDestinations`, and D4
`program_manager` role + scoped `/program` surface. Remaining: D1.3 route record,
D1.4 admin cleaning queue, D2 quarterly notes, D3 automated emails, D4
`city_viewer`. See "Decisions resolved" below.
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

### Decisions resolved — 2026-06-15 call with Tia

| # | Resolution | Effect on build |
|---|------------|-----------------|
| 1 | **Cars-equivalent** — Tia doesn't know the source of her conversion; suspects it's off. Nic to find the published standard and report the exact mismatch. | **Deferred.** Keep current factor until Nic confirms the standard. |
| 2 | **Lifetime totals** — go with **measured-only** (raw collected data), not the spreadsheet's carried-forward estimates. Accuracy over continuity. | **D5 historical baseline DROPPED.** Keep `METHODOLOGY_NOTE`. |
| 3 | **Seasonal closures** — **yes**, add a paused status so summer-closed schools don't read as missed pickups. | **D5 site status: BUILD.** ✅ Done — `paused` status. |
| 4 | **Report format** — she just File→Save-as-PDFs the "Monthly Reports" sheet. Nic to grab a recent City export to match precisely. | **Deferred** until sample in hand. |
| 5 | **Destinations/SMS** — Alum Creek + London only. They no longer fill the truck to a limit: whole route runs Sunday, all containers swapped, dropped Monday. **No truck-weight routing.** SMS "on the way" should be **optional per destination**, triggered when the operator marks the **last pickup done** (not by truck weight). Alum Creek wants the text; London (a prison) probably can't receive one. | **D1.2 truck-weight tracker DROPPED.** Replace with optional per-destination "last pickup done → SMS" (see D1.2′ below). Deferred to a later pass. |
| 6 | **Cleaning** — keep it dead simple: a per-stop **"needs cleaning" toggle** (not a 1–5 scale), in the same form (no second app/form). Feeds a cart-cleaning queue. | **D1.4 simplified.** ✅ Toggle done; admin cleaning queue still to build. |
| 7 | **Skip reasons** — facility closed · no access · bin blocked · weather · other (+ optional note). | **D1.1 skip picker: BUILD.** ✅ Done. |
| 8 | **Branding** — **Compost Clubhouse only** on City/client surfaces; no "powered by WBCT". | Apply in D4/D6. |
| — | **Rewards/vouchers** — confirmed **none** for the compost program. | Stays out of scope. |
| — | **Program manager** — Tia wants a program-manager owner (her daughter or Dominique), not herself. | Reinforces D4 `program_manager` role. |

> **Immediate driver:** Tia runs the City of Columbus route **Sun June 21, ~2pm** and will run the app in parallel with the existing flow for feedback. The operator stop flow (D1.1 actions + skip reasons + cleaning/damaged toggles) is the priority for that test. Tia explicitly wants the operator form kept **as close to the current simple form as possible** (location · bins · weight · status · photo).

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

**D1.2 — ~~Truck weight + destination~~ DROPPED (decision #5).** Tia no longer
fills the truck to a weight limit — the whole route runs Sunday, every container
is swapped, and drops happen Monday. The running-weight tracker / 1-ton
destination prompt is therefore removed.

**D1.2′ — Optional "on the way" SMS (replaces D1.2).** ✅ **Done.** A
`compostDestinations` collection holds each facility (name, contact, phone,
per-destination `smsEnabled`). The operator taps **"Done — heading to drop-off"**
on `/operator/compost`, picks the destination, and `POST /api/compost/on-the-way`
texts the program manager(s) ("…finished the last pickup and is heading to X") and
— only if that destination opted in — the facility contact directly. Tap-triggered
(no GPS), matching how Tia texts JD today; SMS goes through the existing
`sendSMS()` stub and is logged to `smsLog`. Destinations are managed from
`/program/destinations` (and `/admin/compost/destinations`).

**D1.3 — Route record. ✅ Done.** A real "today's run" object: *Start Route* at
shift start, all stops/weights attached, *End Route* with a summary screen
("12 stops · 1 skipped · 18 carts swapped · 2,340 lbs · 1 damaged").
- Collection `compostRoutes`: `{ id, zoneId, operatorId, date (Columbus-local
  YYYY-MM-DD), status: 'in_progress' | 'completed', startedAt, endedAt, summary }`.
  One open run per operator (Start is idempotent). Bin pickups attach via
  `routeId` automatically — `process-bin-pickup` stamps the operator's open run
  onto each pickup (null when no run is open / ad-hoc). End Route freezes the
  summary from the run's pickups (pure `summarizeCompostRoute`).
- Operator surface: Start/End control at the top of `/operator/compost` with a
  live tally; admin reviews any past run at `/admin/compost/routes`.
- Single-driver: no dispatch/assignment — the run belongs to whoever started it.

**D1.4 — Cleaning queue (simplified per decision #6).** No bin-by-bin lifecycle —
Tia just wants to know *which sites need the cart-cleaning truck*. The operator
sets a per-stop **"needs cleaning"** toggle (✅ done on `binPickups.needsCleaning`)
and a **"damaged — needs replacement"** toggle (✅ `binPickups.damaged`). **Still to
build:** an admin queue surface that lists open `needsCleaning` / `damaged` stops
and lets someone mark them resolved (a simple resolved flag on the pickup, or a
lightweight `cleaningTasks` collection). The full `BagDoc.binStatus` lifecycle is
shelved as over-engineered for the pilot.

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

- **`program_manager`** ✅ **Done.** Invite-only (appears in the admin invite form
  with a zone selector), claim set via the existing accept-invite flow. Lands on a
  scoped **`/program`** surface (dashboard + diversion reports + commercial sites +
  drop-off destinations) gated by `requireAnyRole(['program_manager','admin'])`.
  The compost write APIs (`/api/admin/commercial-accounts/*`,
  `/api/compost/destinations/*`) accept `program_manager` via
  `COMPOST_MANAGER_ROLES`. The `/program` pages reuse the admin compost components
  (re-exported) so the two surfaces never diverge. Branded **Compost Clubhouse**.
  *Pilot note:* zone-scoping is not strictly enforced on writes (single-zone
  pilot) — harden when a second zone exists.
- **`city_viewer`** (Ari, City of Columbus) — read-only, scoped to the
  `city_of_columbus` affiliation. **Still deferred** — build alongside the City
  report-format work (decision #4).

### D5 — Site status (decisions 2 & 3 resolved)

- **Site status** ✅ — `commercialAccounts.status: 'active' | 'paused'` added.
  Paused sites are dropped from the operator's daily route and don't read as
  missed pickups; admin pauses/resumes from the commercial-sites page. Resolves
  decision #3.
- **Historical baseline — DROPPED.** Decision #2 = measured-only, so the
  `compostMonthlyBaseline` snapshot is not built; we keep the current
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

| Collection / field | Purpose | Workstream | Status |
|--------------------|---------|------------|--------|
| `binPickups.action / skipReason` | swapped/loaded/skipped + skip reason | D1.1 | ✅ done |
| `binPickups.needsCleaning / damaged` | per-stop cleaning + replacement flags | D1.4 | ✅ done |
| `commercialAccounts.status` (active/paused) | seasonal closures | D5 | ✅ done |
| `compostDestinations` | drop-off facilities + per-dest SMS opt-in | D1.2′ | ✅ done |
| `Role: program_manager` + `/program` surface | compost program access | D4 | ✅ done |
| `Role: city_viewer` | read-only City reports | D4 | deferred |
| `compostRoutes` | the driver's day record | D1.3 | ✅ done |
| `cleaningTasks` (or resolved flag) | admin cleaning/replacement queue | D1.4 | to build |
| `compostNotes` | per-site quarterly notes | D2 | to build |
| `emailLog` | monthly report send log | D3 | to build |
| ~~`compostDeliveries`~~ | ~~truck drops~~ — dropped (no truck-weight routing) | D1.2 | dropped |
| ~~`compostMonthlyBaseline`~~ | ~~historical figures~~ — dropped (measured-only) | D5 | dropped |
| ~~`BagDoc.binStatus`~~ | ~~bin lifecycle~~ — shelved (over-engineered) | D1.4 | dropped |

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
