# User Guides Refactor Plan

Goal: make the guides usable by non-technical clients testing the pilot. Current structure is phase-ordered (for the developer); target structure is role-ordered (for the tester).

Work top-to-bottom. Each step is independently shippable — you can stop after any step and the guides are still in a better state than before. Check items off as you go.

---

## Step 0 — Baseline snapshot

- [ ] Commit current state so you can diff later: `git add planning/user-guides && git commit -m "snapshot user guides before refactor"`
- [ ] Open `index.html` in a browser and skim — note anything obviously broken before you start.

---

## Step 1 — Test User Reference Card (quick win, 30 min)

Add a printable table at the top of `index.html` so testers stop hunting for credentials.

- [ ] In `index.html`, add a new top section **"Test Users"** above the phase list.
- [ ] Include columns: **Name | Email | Password | Role | Device | What they do**.
- [ ] Use the same accounts created by `npm run seed:pilot` (check `scripts/seed-pilot.ts` for exact emails).
- [ ] Add a print stylesheet hint (`@media print`) so it fits on one page.
- [ ] Link to it from every other guide's top nav.

**Done when:** a client can open `index.html`, print one page, and have every login they need.

---

## Step 2 — "What's stubbed" warning box (20 min)

Prevent mid-test confusion about features that don't fully work.

- [ ] Add a reusable `<div class="stub-warning">` style to `styles.css`.
- [ ] Drop a ⚠️ box at the top of each guide listing the stubs relevant to *that* guide:
  - Resident guides → Stripe checkout is mocked, gift-card redemption is manual, "Pay trash bill" / "Donate" are disabled.
  - Operator guides → SMS is console-logged, not sent.
  - Depot guides → SMS stub, manual weight entry only.
  - Admin guides → gift-card fulfillment is a queue, compliance notices are "mark as mailed."

**Done when:** every guide tells the tester upfront what won't work and why.

---

## Step 3 — Smoke-test rewrite of `phase-11-security-deploy.html` (30 min)

Strip the developer-oriented Firestore rules/indexes content.

- [ ] Duplicate the current file → `phase-11-security-deploy.DEV.html` (keep as dev appendix).
- [ ] Rewrite `phase-11-security-deploy.html` as a 5-minute smoke test:
  - "Sign in as each of the 5 roles. Confirm each of these pages loads." (bulleted checklist)
  - "If any page shows 'permission denied,' report it — don't try to fix it."
- [ ] Remove: composite index details, rules playground scenarios, `PERMISSION_DENIED` / `failed-precondition` error taxonomy.
- [ ] Link to the `.DEV.html` version at the bottom for "developer testing."

**Done when:** the client version of this guide fits on one screen and has zero Firestore jargon.

---

## Step 4 — Trim `phase-7-depot.html` (1 hour)

Cut the longest guide (~3,800 words) roughly in half.

- [ ] Keep scenarios 1–4 (invite, receive route, scan bag, weigh + submit) as the **Happy Path**.
- [ ] Move the rest to a new section **"Advanced: edge cases"** at the bottom:
  - Contamination severity
  - Separated vs commingled bags
  - Re-processing guards
  - SMS stub verification
  - Inventory drill-down
- [ ] Add an "Optional — skip unless debugging" badge to the Advanced section.

**Done when:** a first-time tester finishes the guide in under 15 minutes.

---

## Step 5 — Dependency line + device icon on every scenario (30 min)

Before a tester starts a scenario they should see what's required and which device.

- [ ] Add a small header block to each scenario:
  - `📱 Phone` / `💻 Laptop` / `📱+💻 Both`
  - `Requires: <prior scenario or guide>, <another>`
- [ ] Use a consistent class (`.scenario-meta`) styled in `styles.css`.
- [ ] Do a pass across all 11 guides.

**Done when:** no scenario requires the tester to read prerequisites buried inside the body.

---

## Step 6 — Merge `generating-users.html` + `phase-1-auth.html` (45 min)

Single source of truth for account creation and sign-in.

- [ ] Create `accounts-and-signin.html` combining both.
- [ ] Structure:
  1. Create resident account (self-signup flow)
  2. Admin invites operator / depot / manager
  3. Accept invite link → set password → sign in
  4. Troubleshooting (stolen from both current files)
- [ ] Redirect the old two files with a banner: *"Moved to accounts-and-signin.html"*, or delete once `index.html` is updated.
- [ ] Update `index.html` links.

**Done when:** a tester has exactly one guide for creating + signing in to any role.

---

## Step 7 — Standardize the "Verify:" checklist (1 hour)

So testers can copy/paste their results back to you.

- [ ] Define a CSS class `.verify-checklist` in `styles.css` (bold heading, checkbox list, monospace).
- [ ] At the end of every scenario, replace prose "Expected:" blocks with:
  ```html
  <div class="verify-checklist">
    <h4>Verify:</h4>
    <ul>
      <li>☐ Points balance increased by X</li>
      <li>☐ SMS log entry created (check console)</li>
      ...
    </ul>
  </div>
  ```
- [ ] Trim the verbose Firestore-field expectations — leave those in an optional "Under the hood" toggle for devs.

**Done when:** every scenario ends with the same 4–6 checkbox format.

---

## Step 8 — Glossary page (30 min)

One page, linked from every guide.

- [ ] Create `glossary.html` covering: commingled, separated, contamination severity, zone, depot, route, sticker sheet, bag processing, decimal, custom claims (briefly).
- [ ] Link from every guide's top nav.
- [ ] In each guide body, replace the first use of each term with `<abbr title="...">term</abbr>` or a link to the glossary anchor.

**Done when:** no client has to ask what "commingled" means.

---

## Step 9 — Role-based reorganization (3–4 hours, the big one)

Do this last. By now every guide is already shorter and clearer, so the reorg is lower risk.

- [ ] Create new structure in `planning/user-guides/`:
  ```
  index.html                     # role chooser + test users + glossary link
  accounts-and-signin.html       # from Step 6
  glossary.html                  # from Step 8
  resident/
    01-sign-up.html
    02-order-bags.html
    03-scan-and-earn.html
    04-redeem.html
  operator/
    01-start-day.html
    02-run-route.html
    03-end-day.html
  depot/
    01-receive-route.html
    02-process-bag.html
    03-advanced.html             # from Step 4
  admin/
    01-dashboard.html
    02-setup-zone-depot-pricing.html
    03-manage-users.html
    04-qr-stickers.html
    05-compliance.html
  launch/
    smoke-test.html              # from Step 3
    pilot-launch.html            # current phase-12 content
  _dev/
    phase-11-security-deploy.DEV.html
  ```
- [ ] Move scenarios out of phase guides into the role folders. Map:
  - `phase-3-resident.html` → `resident/*`
  - `phase-4-admin.html` + `phase-9-admin-polish.html` → `admin/*`
  - `phase-5-routes.html` → split: admin creates route → `admin/02`, operator runs route → `operator/02`
  - `phase-6-operator.html` → `operator/*`
  - `phase-7-depot.html` → `depot/*`
  - `phase-10-qr-generation.html` → `admin/04-qr-stickers.html`
  - `phase-12-pilot-launch.html` → `launch/pilot-launch.html`
- [ ] Rewrite `index.html` as a **role chooser**: five big buttons ("I'm a resident" / operator / depot / admin / manager) → each links to that role's first guide.
- [ ] Delete the old `phase-*.html` files (commit first).
- [ ] Update all internal links.

**Done when:** a client lands on `index.html`, clicks their role, and follows a linear set of guides specific to them.

---

## Step 10 — Add screenshots (2 hours, optional polish)

- [ ] One screenshot per happy-path scenario showing the expected success state.
- [ ] Store under `planning/user-guides/screenshots/` to keep paths relative.
- [ ] Add alt text.

**Done when:** testers stop asking "is this what I'm supposed to see?"

---

## Tracking

Keep this file updated as you go — tick boxes, add notes inline. When everything's done, delete this file (or move it to `planning/done/`).
