# Compost Clubhouse App — Project Proposal

**Prepared for:** Tia Johnson, Compost Clubhouse
**Prepared by:** Nicolas Aguirre
**Date:** June 18, 2026

---

## Overview

This proposal covers the next phase of work to move Compost Clubhouse off the
Linktree + Google Sheets setup and onto one app your drivers, you, Dominique, and
the City of Columbus can all use — without losing any of your three years of
history.

A large portion of the system is **already built and working**. This document
outlines what's done, what's planned next, and the cost to complete it.

---

## What's already built

**Your full operation is in the app**

- **22 sites** imported (12 Compost Clubhouse + 10 City of Columbus; 19 active, 3 archived).
- **~1,528 pickup records** since July 2023, with weights, bin counts, and fullness exactly as you tracked them.
- Monthly report totals **match your spreadsheet to the penny** (e.g. CCH April 2026 = 27,966.33 lbs in both).

**For your drivers (the phone app)**

- See today's scheduled sites on the route, sorted today-first.
- **Start Route / End Route** — one run per day, with an end-of-run summary (stops, skipped, carts swapped, total lbs, damaged, to-clean).
- Per stop: bin size (32 / 48 / 64 gal) × fullness (0 / 25 / 50 / 75 / 100%), with weight auto-calculated from your verified bin-weight values.
- Per-stop action — **Swapped / Loaded / Skipped** (skip requires a reason).
- Flag a bin as **damaged** or **needs cleaning**, add a contamination note and photo.
- **"On the way" text** — driver picks a delivery facility (Alum Creek / London) and the app texts the facility contact (where SMS is enabled).

**For you and Dominique (the dashboard)**

- A "Compost · Tia" section kept separate from the recycling side.
- **Commercial sites** — add, edit, pause (seasonal closures), or archive sites; set address, schedule, affiliation, bins, contact, and driver notes.
- **Delivery destinations** — manage Alum Creek / London, with per-facility SMS opt-in.
- **Diversion reports** — pick a month and affiliation; see monthly + all-time lbs/tons/impact, per-site tables, with **CSV export** and **Print/PDF**.
- **Route history** — review past runs and their summaries.
- **Program-manager login for Dominique** — full compost access, walled off from the recycling business.

---

## What will be built next

These are the items still ahead, in roughly the order they deliver value:

1. **Truck operations on the route**
   - Running truck-weight tracker across the day's stops.
   - "Truck is full → deliver to Alum Creek or London?" prompt, with the auto-text to the facility tied into it.

2. **Cart-cleaning queue at the yard**
   - Drivers already flag bins as "needs cleaning" — this adds the admin screen to see that queue and mark bins as cleaned.

3. **Quarterly contamination notes**
   - A place to log recommendations and contamination observations per site, carried into reports.

4. **Automated monthly emails**
   - The app sends each site its monthly weight + cumulative + impact automatically (currently manual via Dominique).

5. **City of Columbus read-only access**
   - A login for the City to view only their own diversion reports.

*Final scope and ordering will be confirmed with you before work begins — we'll
prioritize based on what's most useful for your day-to-day and your reporting to
the City.*

---

## Open decisions (no cost, just your call)

- **"Cars off the road" number** — the app reproduces your existing formula for
  continuity, but it reads much higher than the standard EPA/ReFED conversion.
  We've flagged it and can switch to the standard figure with a one-line toggle —
  your decision.
- **All-time totals** — the app reports only weight actually collected (no
  estimated gap-fills or seasonal carry-forwards), so lifetime totals run lower
  than the sheet but are more defensible if the City asks. Monthly numbers still
  match exactly.

---

## Pricing

Work is billed at **$72/hour**. The next phase is estimated at **15–25 hours**,
covering both development and testing. The range reflects how much we iterate on
the app together as you and your drivers use it.

| Scenario | Hours | Cost |
| --- | --- | --- |
| Low end (focused build, light iteration) | 15 hrs | **$1,080** |
| High end (more iteration and refinement) | 25 hrs | **$1,800** |

**Estimated total: $1,080 – $1,800**

This includes development, testing against your real data, and bug fixes within
the phase. Anything beyond this scope (significant new features not listed above)
would be quoted separately.

---

## Next steps

1. Confirm the priority order of the "next" items above.
2. Lock in the two open decisions (cars figure, all-time totals).
3. Begin development, with check-ins as features land so you can test on real routes.
