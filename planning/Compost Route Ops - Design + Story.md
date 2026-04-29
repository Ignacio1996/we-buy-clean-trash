# Compost Route Ops — Design + Driver Story

**For:** Tia, Dominique, Kirk
**From:** Ignacio
**Date:** April 28, 2026

---

## Part 1 — Where we are today

The Compost Operator app already covers the basics of a single stop:

- **Sites** can be added in the admin dashboard (name, address, contact, schedule, what zone they live in).
- **Bins** are provisioned per site in three sizes (32, 48, or 64 gallon). Each bin gets its own QR sticker.
- **The driver** opens the operator app and sees today's sites in their zone.
- **At each stop**, the driver picks how full each bin was (0 / 25 / 50 / 75 / 100%). The app does the weight math automatically using a verified lookup table.
- **Photos and contamination notes** can be added per stop, then the driver submits.

That works for capturing *what was in the bin*. What's missing is everything that happens *around* the stop — starting the day, swapping vs. loading, skipping, damaged carts, truck weight, where the load goes, return + cleaning, and end-of-day reporting.

---

## Part 2 — A driver's day (the story)

Meet **Marcus**, our compost driver. Here's how his Tuesday looks today vs. how it *should* look once we build the missing pieces.

### 6:45 AM — Marcus opens the app

He sees a list of sites. There's no "I'm starting my shift" button — he just begins.

> 🚧 **Missing: Start Route.** A simple **Start Route** button so the app knows the day began and creates a route record to attach everything to.

### 7:10 AM — Stop 1: Fox in the Snow café

Two bins. He picks "50%" on one, "75%" on the other, snaps a photo. Submits.

> ✅ This part works today.
> 🚧 **Missing: action buttons.** He needs **Swapped** (gave them clean empties, took the fulls) vs **Loaded** (dumped them into the truck and set the same bins back down). Right now both look identical to the office.

### 7:35 AM — Stop 2: Little Eater

The bin has a crack down the side.

> 🚧 **Missing: Damaged button.** Tap it, snap a photo. The office sees "Little Eater needs a replacement" on tomorrow's dashboard.

### 8:00 AM — Stop 3: Brassica

Gate is locked. Nobody answering.

> 🚧 **Missing: Skipped button** with a reason picker ("gate locked", "bin not out", "site closed"). Today he just doesn't submit, and nobody knows whether he skipped on purpose or forgot.

### 9:15 AM — After 6 stops

Truck is feeling heavy.

> 🚧 **Missing: truck weight tracker.** He should be able to tap **Add weight** and see a running total at the top of the screen — *1,840 lbs / 2,000 lbs*.

### 9:40 AM — Truck hits ~2,000 lbs

> 🚧 **Missing: 1-ton prompt.** App pops up: **"Truck is full. Deliver to Alum Creek or London?"** He picks Alum Creek. App auto-texts the Alum Creek contact: *"Marcus en route, ETA 25 min, ~2,000 lbs food scrap."*

### 10:15 AM — Arrives at Alum Creek, dumps

> 🚧 **Missing: Confirm Delivery button.** He taps it, optionally enters the actual scale weight from the facility. Truck weight resets to zero. He keeps going.

### 11:30 AM — Back on route, finishes the rest

### 1:00 PM — Done

> 🚧 **Missing: End Route + summary screen.** *"12 stops · 1 skipped · 18 carts swapped · 2,340 lbs delivered to Alum Creek · 1 damaged cart flagged."* Saves the whole day as one route record.

### Wednesday morning — back at the yard

Empty bins from yesterday are back.

> 🚧 **Missing: cart cleaning queue.** Someone marks each batch **"Cleaned, ready to redeploy"** so the office knows which bins are available for tomorrow's swaps.

### End of month — Tia needs to send the City a report

> 🚧 **Missing: report export.** A button: **"Export April · City of Columbus sites"** → CSV or PDF with totals per site, contamination rate, lbs diverted, CO₂ saved, cars equivalent.

---

## Part 3 — The pattern

The app currently handles **what happened at one bin**.

It's missing everything that happens **between bins, between stops, and after the day ends**.

That's the next phase of work.

---

## Part 4 — Proposed build (Phase C: Route Ops)

Five chunks. Each one is independently useful — we can ship them one at a time.

### Chunk 1: Per-bin actions
Add buttons on the stop screen for each bin: **Swapped · Loaded · Skipped · Damaged**. Skipped requires a reason. Damaged prompts for a photo.

### Chunk 2: Truck weight + destination
- Running truck weight at the top of the route screen
- "Add weight" button (driver enters lbs after each stop, or estimates)
- At ~1 ton, popup: pick **Alum Creek** or **London**
- Auto-SMS to the destination contact (uses the existing SMS stub)
- "Confirm delivery" button → resets truck weight to zero

### Chunk 3: Route record
A real "today's run" object instead of just a list of sites:
- **Start Route** when shift begins
- All stops, weights, deliveries attached to it
- **End Route** with a summary screen
- Admin can see any past route, who drove it, what happened

### Chunk 4: Cart return + cleaning
A small queue in the admin dashboard:
- Bins come back from a route → status: **Returned**
- Someone marks them **Cleaned** → status: **Ready**
- "Damaged" bins go to a separate "Needs replacement" list

### Chunk 5: Monthly report export
Filter by zone + date range + affiliation (Compost Clubhouse / City of Columbus). Export to CSV or PDF. Includes:
- Total lbs diverted
- Per-site breakdown
- Contamination rate
- CO₂ saved + cars-equivalent (using ReFED constants Tia already uses)

> ⏳ **Blocker:** need a sample of Dominique's current monthly report to match the format exactly.

---

## Part 5 — What we need from Tia & Dominique to start

1. **Sample of Dominique's current monthly export** to the City — so we match the format
2. **Confirm the destination list** is just Alum Creek + London for now, or are there others?
3. **Who's the SMS contact** at Alum Creek and London? (Phone number for the auto-text)
4. **Cleaning workflow** — does someone at the yard mark bins clean, or does the driver do it when they pick them up the next day?
5. **Skip reasons** — what are the 4–5 most common ones? ("Gate locked", "Bin not out", "Site closed", "Contaminated/refused", "Other")

Once we have these, Chunk 1 (per-bin actions) can ship within a few days. The rest follows in roughly the order listed.

---

## Part 6 — Out of scope for now

Worth naming what we're *not* building yet, so expectations stay clear:

- **Multi-driver route assignment** (one dispatcher assigning specific stops to specific drivers) — only matters once Tia hires a second driver
- **GPS tracking / live ETAs** — drivers tap "en route" manually instead
- **Compost voucher redemption** ("free compost units" for residents) — waiting until the Columbus facility is producing
- **Direct Google Sheets sync** — the data lives in our database; we *export* to CSV / PDF / Google-compatible formats on demand, but the source of truth is the app

---

*End of doc.*
