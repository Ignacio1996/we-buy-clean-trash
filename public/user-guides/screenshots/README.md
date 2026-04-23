# Screenshot shot-list

This folder is where screenshots used by the testing guides live. Each image is referenced by a short, kebab-case filename (no phase numbers, so they survive the role-based reorg).

## How to insert a screenshot into a guide

Once you've captured an image and saved it here, paste this snippet into the scenario's `scenario-body` — ideally right after the `<ol>` / `<ul>` steps, before the `<div class="expected">` block:

```html
<figure class="screenshot">
  <img src="screenshots/FILENAME.png" alt="DESCRIPTIVE ALT TEXT" />
  <figcaption><strong>Expected:</strong> one-line summary of what the image shows.</figcaption>
</figure>
```

For phone-sized shots (operator + resident), add the `phone` modifier class to cap the width:

```html
<figure class="screenshot phone">
  <img src="screenshots/FILENAME.png" alt="..." />
  <figcaption>...</figcaption>
</figure>
```

## Capture tips

- **Real browser only, no DevTools device emulation.** Emulation lies about fonts and touch targets.
- **Phone shots** on an actual phone or iOS Simulator (`xcrun simctl`), saved as PNG. Crop the status bar if you can.
- **Laptop shots** at 1440-wide, zoom 100%, light mode. PNG > JPG (the UI is text-heavy).
- **Don't capture real PII.** The pilot test users are fictional — that's fine. If you happen to capture your own email from a signed-in Google session, blur it before saving.
- **File size.** Run captures through something like `pngquant` or `imageoptim` — keep each under ~200 KB. This folder will be served with the app.

## Priority 1 — happy-path ship-blockers (8 shots)

These are the screenshots that actually remove tester confusion. If you do nothing else, do these eight.

| Filename | Where it goes | What to capture |
|---|---|---|
| `resident-dashboard-after-signup.png` | `phase-3-resident.html` Scenario 2 | Phone — resident home immediately after signup. 10,000 pts, "Next pickup not assigned yet", bottom nav visible. |
| `resident-order-confirmation.png` | `phase-3-resident.html` Scenario 3 | Phone — order confirmation screen after tapping "Pay now" (mock). Order number + "delivered on next pickup" line. |
| `admin-dashboard-kpis.png` | `phase-4-admin.html` Scenario 1 | Laptop — `/admin` with KPI tiles (residents, bags this week, material totals, revenue). |
| `admin-invite-pending.png` | `phase-4-admin.html` Scenario 2 | Laptop — invite list with a pending row after sending an operator invite. |
| `operator-today-route.png` | `phase-6-operator.html` Scenario 1 | Phone — operator home with "Ready to roll?" card and first-stop preview. |
| `operator-scan-camera.png` | `phase-6-operator.html` Scenario 3 | Phone — scan screen with camera viewfinder + manual code entry field visible. |
| `depot-incoming-new.png` | `phase-7-depot.html` Scenario 2 | Laptop — `/depot/incoming` with one route labeled **NEW**. |
| `depot-process-form.png` | `phase-7-depot.html` Scenario 4 | Laptop — process form with the 7 material rows and live points preview at the bottom. |

## Priority 2 — supporting shots (6 shots)

Add these once the ship-blockers are in.

| Filename | Where it goes | What to capture |
|---|---|---|
| `resident-scan-success.png` | `phase-3-resident.html` Scenario 4 | Phone — the "bag registered for pickup" confirmation screen. |
| `admin-pricing-yellow-sheet.png` | `phase-4-admin.html` Scenario 5 | Laptop — `/admin/pricing` with all 7 material rows. |
| `admin-route-builder.png` | `phase-5-routes.html` Scenario 2 | Laptop — route builder after Optimize order, showing map preview + total time/distance. |
| `admin-qr-print-view.png` | `phase-10-qr-generation.html` Scenario 1 | Laptop — the 10-label print preview for a sticker sheet. |
| `admin-compliance-batch.png` | `phase-9-admin-polish.html` Scenario 5 | Laptop — a compliance batch with "Mark as mailed" button. |
| `operator-route-complete.png` | `phase-6-operator.html` Scenario 6 | Phone — "All stops handled" summary with **Deliver to depot** button. |

## Priority 3 — polish (4 shots)

Only if time. These are the "advanced" scenarios most testers skip.

| Filename | Where it goes | What to capture |
|---|---|---|
| `depot-contamination-preview.png` | `phase-7-depot.html` Scenario 5 | Laptop — process form with contamination set to Major showing the penalty-adjusted preview. |
| `depot-inventory-dashboard.png` | `phase-7-depot.html` Scenario 9 | Laptop — `/depot/inventory` with progress bars. |
| `admin-contamination-alerts.png` | `phase-9-admin-polish.html` Scenario 3 | Laptop — Contamination alerts panel with WARNED / STRIKE / ACTION badges. |
| `admin-redemption-queue.png` | `phase-4-admin.html` Scenario 6 | Laptop — gift card redemption queue with a pending request. |

## When you're done

- Commit the images alongside the HTML edits (one PR).
- Sanity-check that each `<img src="screenshots/...">` resolves when you open `index.html` in a browser.
- Delete this README section or strike through each row as you finish it, so later-you knows what's left.
