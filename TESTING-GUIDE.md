# WBCT Compost — Demo & Testing Guide (Tia walkthrough)

Focused on the **Compost Clubhouse / City of Columbus food-scrap program** only. The story to tell, in order:
**Set up sites & bins (Admin) → run a pickup route (Operator) → notify the drop-off → see the diversion report.**

---

## 0. Before the meeting

**Start the app**
```
npm run dev
```
Open **http://localhost:3000** (or the Vercel URL if demoing the deployed site).

**Logins** — password for all is `webuycleantrash`

| Role | Email | Use for |
|------|-------|---------|
| Admin | *your admin account* (or `tia.admin@wbct-pilot.test`) | Sites, bins, destinations, reports — admin can also open all `/program` pages |
| Operator (driver) | `operator.test@webuyclean.trash` | Running the pickup route |

> There is **no seeded program-manager login**, but you don't need one — the **admin account can access every `/program/*` page**, so demo the program-manager screens while logged in as admin.

**Make sure the demo data is loaded.** The compost report needs the historical pickups imported. If reports look empty, run:
```
npm run seed:pilot
npx tsx --env-file=.env.local scripts/import-compost-data.ts --commit
```
This loads ~20 real commercial sites (Florin Cafe, The Columbus Foundation, Overlook Cafe, etc.) and 600+ historical pickups so the report shows populated, workbook-matching numbers.

**One manual setup step:** drop-off destinations are **not** seeded. Before the demo, log in as admin → `/program/destinations` → add **Alum Creek** and **London** so the "heading to drop-off" step has somewhere to send.

> Tip: have two browser profiles/windows open — one logged in as admin, one as operator — so you can switch roles instantly.

---

## 1. Admin / Program Manager — set up sites & bins

Log in as admin.

1. **Commercial sites** (`/admin/commercial-accounts`, or `/program/commercial-accounts`)
   - Review the seeded sites — active ones (Florin Cafe, Columbus Foundation, Overlook Cafe…) and archived ones (Chapman's Eat Market, Crew Training Facility).
   - Show **"Add commercial site"**: business name, contact, address (geocoded), zone, default bin size, pickups/week, collection days, materials, affiliation tag (Compost Clubhouse vs City of Columbus), driver notes.
   - Show **pause / archive** controls on a site card.

2. **Provision bins (QR codes)** — on a site card click **"Provision bins"** → pick bin size (32/48/64 gal) + count.
   - The app reserves a unique **`BIN-####` QR code per bin**, marked **reusable** (the QR stays on the bin across pickups — it isn't a single-use bag).
   - ⚠️ **Caveat for Tia:** the codes are generated and stored, and drivers can scan them — but there's **no "print bin label" screen yet**. You can't download a printable sticker sheet for bins from the app today. (See "What's missing.")

3. **Drop-off destinations** (`/program/destinations`) — the composting facilities the route drops at.
   - Add/edit a facility: name, zone, contact name + phone, and a **toggle for the "on the way" SMS** to that facility.

---

## 2. Operator — run the compost route

Log in as `operator.test@webuyclean.trash`.

1. **Compost home** (`/operator/compost`) — sites due today (filtered to the driver's zone), with a **"Start run"** button.
   - Tap **Start run** → banner flips to "Run in progress" with a live tally (stops, lbs).

2. **Record a pickup** — tap a site → `/operator/compost/{site}`:
   - **Action:** Swapped (drop empties / take full) · Loaded (dump into truck) · Skipped.
   - **Bins:** each provisioned bin shows with its QR/number; set **fullness** (Empty, ¼, ½, ¾, Full). Weight is computed automatically from a bin-size × fullness table.
   - **Material** (food scrap), **contamination severity**, **needs-cleaning / damaged** flags, optional **notes + photo**.
   - If **Skipped**, pick a reason (closed, no access, blocked, weather, other).
   - Submit → records the pickup, attaches it to the open route, and updates inventory. Repeat per site.

3. **"Done — heading to drop-off"** (banner button) → pick a destination (e.g. Alum Creek) → notifies the program manager and, if enabled, the facility.
   - ⚠️ SMS is a **stub** in the pilot — it logs to the console instead of sending a real text. Functionally correct, just not wired to Twilio yet.

4. **End run** → freezes the summary (stops, carts swapped, total lbs, damaged, cleaning needs). Banner shows "Run complete ✓".

---

## 3. Admin / Program Manager — reporting

Log in as admin.

1. **Route history** (`/admin/compost/routes`) — every run with operator, date, start/end, and the frozen summary line. Your just-completed run appears here.

2. **Diversion reports** (`/admin/compost/reports`, or `/program/reports`) — the City-facing numbers:
   - **Monthly KPIs:** total lbs, tons, "cars off the road."
   - **Per-site table:** monthly lbs, all-time lbs, months active, contamination rate (active sites first).
   - **All-time by affiliation:** Compost Clubhouse vs City of Columbus.
   - **Month / affiliation pickers** + **CSV export** (summary + monthly + site-detail sheets). Figures are built to match Tia's workbook.

**The headline for Tia:** the full operational loop is real — set up a site, provision bins, run a route on the phone, weigh by bin fullness, notify the drop-off, and produce a City diversion report with export.

---

## What works ✅

- Commercial site directory — create / edit / pause / archive, with affiliation tagging
- Bin provisioning with unique reusable QR codes per bin
- Drop-off destination management + per-facility SMS toggle
- Operator route: start run → per-site bin pickup form (fullness-based weighing) → skip reasons → photo upload
- "Heading to drop-off" notification flow
- End-of-run summary (stops, carts, lbs, damaged, cleaning)
- Route history view
- Diversion reports: monthly KPIs, per-site + all-time, affiliation split, **CSV export** — matches the workbook
- ~20 real sites + 600+ historical pickups seeded for a populated report

## What's missing / stubbed ⚠️

- **Printable bin QR labels** — bins get a QR in the system, but there's no screen to download/print a sticker sheet for them yet
- **SMS is a stub** — "on the way" notifications log to the console, not real Twilio texts
- **Destinations aren't seeded** — add Alum Creek / London manually before the demo
- **No program-manager test login** — demo `/program/*` screens as admin instead
- **Contamination & "needs cleaning" queues** — the data is captured per pickup, but there's no dedicated admin dashboard to action them yet
- **Single-driver model** — no multi-driver dispatch / route optimization for compost (by design for the pilot)
