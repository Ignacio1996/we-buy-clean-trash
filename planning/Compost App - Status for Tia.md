# Compost Clubhouse on the WBCT App — Where Things Stand

**Prepared for:** Tia
**Date:** June 15, 2026

This is a plain-language summary of what we've built so far, what's still to come,
and a few questions where we need your input. The goal: move Compost Clubhouse off
the Linktree + Google Sheets setup and onto one app that your drivers, you, and
the City of Columbus can all use — without losing any of your history.

---

## The headline

**Your entire operation is already in the app.** We imported everything from your
master spreadsheet:

- **22 sites** — 12 Compost Clubhouse client sites + 10 City of Columbus drop-off
  sites (19 active, 3 archived).
- **Every pickup since July 2023** — about 1,528 collection records, with the
  weights, bin counts, and fullness exactly as you've been tracking them.
- All of it organized so Compost Clubhouse and City of Columbus stay **separate**
  from the rest of the WBCT recycling business.

And importantly: **the monthly report numbers match your spreadsheet to the
penny.** For example, the Compost Clubhouse total for April 2026 comes out to
**27,966.33 lbs** in both your sheet and the app.

---

## What's working today

**For your drivers (the phone app)**
- They open the app and see today's sites for their route.
- At each stop they pick how full each bin was (0 / 25 / 50 / 75 / 100%), and the
  app does the weight math automatically using your verified bin-weight values
  (32-gal, 48-gal, 64-gal).
- They can add a photo and a contamination note per stop, then submit.

**For you (the admin dashboard)**
- A "Compost · Tia" section, kept separate from the recycling side of the app.
- **Commercial sites** — add, edit, or archive sites; set the address, schedule,
  affiliation, bin size, number of bins, contact, and driver notes (gate codes,
  bin location, etc.).
- **Diversion reports** — pick a month and an affiliation (Compost Clubhouse or
  City of Columbus) and instantly see:
  - Monthly and all-time totals in pounds, tons, and "cars off the road."
  - A per-site monthly table (weight, average bins collected, bins on site,
    average fullness).
  - A per-site all-time table (total lbs/tons, months active).
  - **Download to CSV** or **Print/PDF** to send to the City or clients.

**Your history**
- Three years of data is loaded, so the reports aren't starting from zero — they
  reflect your real track record from day one.

---

## What's still to come

These are planned but not built yet:

- **Full route operations** — a "Start/End Route" day, plus per-stop buttons for
  *Swapped* vs *Loaded*, *Skipped* (with a reason), and *Damaged* (with a photo);
  a running truck-weight tracker with a "truck is full → deliver to Alum Creek or
  London?" prompt and an auto-text to the facility; and a cart cleaning queue at
  the yard.
- **Quarterly contamination notes** — a place to log the recommendations and
  contamination observations you keep per site, carried into reports.
- **Automated monthly emails** — right now those go out manually (via Dominique).
  We can have the app send each site its monthly weight + cumulative + impact
  automatically.
- **Access for Dominique and the City** — a "program manager" login for Dominique
  (manage sites, pickups, reports) and a read-only login for the City of Columbus
  to view their own diversion reports.
- **Compost voucher rewards** — for when the Columbus facility is producing.

---

## Where the app's numbers may look different from your spreadsheet — and why

We want to be fully transparent here, because a few numbers **won't** match your
sheet exactly, and that's by design. Here's what changed and why.

### 1. How a pickup's weight is calculated — *matches your sheet*
We use the same method your reports already rely on: **bins × fullness × full-bin
weight** (130 lbs for 32-gal, 195 for 48-gal, 260 for 64-gal). So individual
pickups and your monthly totals come out the same.

### 2. "Cars off the road" — *kept the same for now, but we have a question (see below)*
We kept your existing cars-equivalent calculation so your reports stay consistent
with what clients have already received. **However**, we noticed this number looks
much larger than the standard EPA/ReFED conversion would produce. We flagged it in
the app and would like your decision on whether to keep it or switch to the
standard figure — details in the Questions section.

### 3. Monthly totals — *match your sheet exactly* ✅
The monthly report (the one you send clients each month) reproduces your
spreadsheet exactly for active sites.

### 4. All-time ("lifetime") totals — *these will look lower in the app*
This is the main difference. When we looked closely at how your spreadsheet
calculates lifetime totals, we found three things built into the sheet by hand
over the years:

- **Estimated "gap" months** — when a site had no pickup recorded in a month, the
  sheet automatically *carried the previous month's estimate forward*, adding
  weight that wasn't actually collected.
- **Seasonal resets** — for schools (e.g. The Wellington School), the running
  total is manually reset each school year and summer months are blanked out as
  "Closed for Summer."
- **Discontinued sites keep counting** — sites that left the route (e.g.
  Chapman's) kept accumulating estimated weight every month afterward.

The app instead reports **only weight that was actually collected** — no estimated
fill-ins, no resets. This is more defensible if the City or a client ever asks
"how did you get this number?", but it means **lifetime totals in the app run
lower** than your sheet for any site with gaps or seasonal closures.

**Concrete example — Florin Cafe lifetime total:**
- Your spreadsheet: **33,374 lbs**
- The app (measured only): **28,390 lbs**

Both are "right" — they're just answering slightly different questions ("estimated
diversion" vs "measured diversion"). Every report in the app includes a short note
explaining this. **If you'd prefer the app to preserve your historical reported
numbers, we can do that** — it's one of the questions below.

### 5. Inactive sites in the monthly total — *matches what you share*
Sites that are no longer on the route are shown greyed out and are left out of the
monthly total — the same way you blank them before sharing a report.

---

## Questions for you

1. **"Cars off the road" figure.** The current calculation produces a number that's
   far higher than the standard EPA/ReFED conversion (for the same pounds, the
   standard method gives a much smaller number). Do you want to (a) keep your
   current figure for consistency with past reports, or (b) switch to the standard
   conversion going forward? We'll do whatever you prefer.

2. **Lifetime totals.** Should the app show **measured-only** totals (cleaner, more
   defensible), or should we **preserve your historical spreadsheet totals** as the
   starting baseline so nothing appears to "drop"? We can do either.

3. **Seasonal closures.** How would you like the app to handle school summer breaks
   and other planned pauses — should sites have a "paused" status so they don't
   look like missed pickups?

4. **Monthly report format.** Could we get a recent example of the exact report
   Dominique sends the City? We want the app's export to match it precisely.

5. **Route operations details** (for the next phase):
   - Are Alum Creek and London the only drop-off destinations, or are there more?
   - Who's the contact (phone number) at each, for the automatic "on my way" text?
   - Who marks bins as cleaned — someone at the yard, or the driver next day?
   - What are your 4–5 most common reasons a stop gets skipped?

6. **Site contact info.** Several sites are missing a contact email. Would you like
   to fill those in so monthly emails can reach them?

7. **Branding.** On screens the City or clients might see, do you want Compost
   Clubhouse branding, "powered by WBCT," or both?

---

## In short

- Your sites and three years of pickups are **live in the app today**.
- The **monthly reports match your spreadsheet exactly.**
- **Lifetime totals are measured-only** and will look a bit lower — we can change
  that if you prefer.
- The biggest open decisions are the **cars-equivalent figure** and **how to treat
  lifetime totals**.

We'd love your feedback on the questions above so we can finish the next phase
(route operations, automated emails, and City/Dominique access).
