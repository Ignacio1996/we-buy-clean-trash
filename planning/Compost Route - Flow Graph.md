# Tia's Compost Route — End-to-End Flow Graph

> What the app does with the Compost Clubhouse food-scrap collection route that
> Tia (and Dominique) run. Generated 2026-06-15 from the Phase A→C compost code.
> See [Compost Integration - Phase C.md](./Compost%20Integration%20-%20Phase%20C.md).

**Tia** = Tia Johnson, founder of **Compost Clubhouse**, a commercial food-scrap
collection business in Columbus, OH (~19 active sites split across two
affiliations: `compost_clubhouse` private clients and `city_of_columbus` public
drop-offs). **"Tia's compost route"** = the operator's recurring food-scrap
pickup round at those commercial sites (Florin Cafe, The Columbus Foundation,
Overlook Cafe, The Wellington School, …). The app captures each pickup, rolls
weight into diversion inventory, and reproduces Tia's Excel workbook
("Compost Clubhouse Collection Data") as monthly diversion reports —
all in a `/admin/compost/*` + `/operator/compost/*` namespace that never touches
points / transactions (food scrap is `diversion_only` = 0 points).

```mermaid
flowchart TD
    %% ============ SETUP ============
    subgraph SETUP["① Admin setup — the site directory"]
        ADMIN([Admin]) --> CAUI["/admin/commercial-accounts<br/>CommercialAccountsClient.tsx"]
        CAUI -->|"POST / PATCH"| CAAPI["/api/admin/commercial-accounts(/[id])<br/>name · affiliation · collectionDays<br/>materialIds · firstMonthOfData (YYYY-MM)"]
        CAUI -->|provision bins| BINAPI["/api/admin/commercial-accounts/[id]/bins<br/>creates reusable bag = physical bin"]
        CAAPI --> CACOLL[("commercialAccounts<br/>= workbook 'Directory'")]
        BINAPI --> BAGS[("bags<br/>reusable=true · commercialAccountId<br/>= 'Bins on Site'")]
    end

    %% ============ ROUTE / PICKUP ============
    subgraph ROUTE["② Operator route — recording pickups"]
        OP([Operator]) --> OPLIST["/operator/compost<br/>today's sites: active + zone<br/>+ collectionDays = today"]
        OPLIST --> OPSITE["/operator/compost/[id]<br/>BinPickupForm.tsx"]
        OPSITE -->|"scan bin QR or manual"| FORM["per bin: binSize 32/48/64<br/>+ fullness 0/.25/.5/.75/1<br/>+ contamination · notes · photo"]
        FORM -->|POST| PROC["/api/process-bin-pickup<br/>(operator-gated)"]
    end

    %% ============ WRITE ============
    subgraph WRITE["③ Server validate + atomic write"]
        PROC --> VAL{"validate:<br/>account active?<br/>material accepted?<br/>bins belong + reusable + size match?"}
        VAL -->|"weight per bin"| WT["BIN_WEIGHT_TABLE (linear)<br/>binCount × fullness × fullBinWeight<br/>{32:130, 48:195, 64:260} lbs"]
        WT --> TX[["Admin SDK transaction"]]
        TX --> BP[("binPickups<br/>= workbook 'Form Responses'<br/>one doc / pickup event")]
        TX --> INV[("inventory<br/>commercial_{zone}_{material}<br/>weight += totalWeightLbs")]
        TX -.->|food_scrap = diversion_only| NOPTS["❌ no points · no transactions ledger"]
    end

    CACOLL -.->|active + zone| OPLIST
    BAGS -.->|bin counts| OPLIST

    %% ============ REPORT ENGINE ============
    subgraph REPORT["④ Diversion report — reproduces the workbook"]
        ADMIN2([Admin]) --> RPAGE["/admin/compost/reports<br/>?month=YYYY-MM &affiliation=<br/>page.tsx (server)"]
        RPAGE --> LOAD["loadCompostReportData.ts<br/>reads all 3 collections whole"]
        CACOLL --> LOAD
        BP --> LOAD
        BAGS --> LOAD
        LOAD -->|"ReportSiteInput[] + ReportPickupInput[]"| ENGINE["compostReport.ts (pure)<br/>buildCompostMonthlyReport"]

        ENGINE --> SERIES["buildSiteSeries — 'Fill in the Gaps' per site/month:<br/>reportedTotal = Σ pickup weights<br/>weeklyAvg = reported / entries<br/>monthlyTotal = weeklyAvg × 4.35 (MONTHLY_MULTIPLIER)<br/>gap-fill: carry prev month forward if 0 entries<br/>cumulative · avgFullness · avgBinCount"]
        SERIES --> KPIS["KPI bands (monthly + all-time):<br/>lbs · tons (÷2000)<br/>cars = lbs / 1.17 ⚠️ legacy, flagged<br/>monthsActive = DATEDIF(firstMonth, reportMonth)"]
    end

    %% ============ CONSTANTS ============
    subgraph CONST["logic constants"]
        WTC["binWeightTable.ts<br/>BIN_WEIGHT_TABLE · FULL_BIN_WEIGHT_LBS"]
        RPTC["compostReporting.ts<br/>MONTHLY_MULTIPLIER 4.35 · LBS_PER_TON<br/>carsEquivalent · carsEquivalentNote<br/>USE_REFED_CARS flag · co2eqTons"]
    end
    WTC -.-> WT
    WTC -.-> SERIES
    RPTC -.-> SERIES
    RPTC -.-> KPIS

    %% ============ OUTPUT ============
    subgraph OUT["⑤ Output + verification"]
        KPIS --> CLIENT["CompostReportClient.tsx<br/>KPI band · Monthly Summary table<br/>All Time Summary · cars footnote<br/>month/affiliation filters (URL)"]
        CLIENT --> CSV["CSV export (Blob)"]
        CLIENT --> PDF["Print / PDF (window.print)"]
        ENGINE -.->|"npm run verify:compost-report"| VERIFY["verify-compost-report.ts<br/>checks vs hand-checked workbook<br/>(Chapman's extrapolation + 33-mo span)"]
    end

    %% ============ NAV ============
    NAV["AdminNav.tsx — 'Compost · Tia' group:<br/>Commercial sites + Diversion reports"]
    NAV -.-> CAUI
    NAV -.-> RPAGE
```

## Quick legend of the moving parts

| Stage | Where | Workbook analogue |
|-------|-------|-------------------|
| Site directory | `commercialAccounts` + `/admin/commercial-accounts` | **Directory** sheet |
| Bins on site | `bags` where `reusable=true` | "Bins on Site" column |
| Pickup capture | `/operator/compost/[id]` → `/api/process-bin-pickup` → `binPickups` | **Form Responses** sheet |
| Weight model | `binWeightTable.ts` (linear `count × fullness × fullBinWeight`) | **Static Values** |
| Monthly extrapolation | `compostReport.ts` `buildSiteSeries` | **Fill in the Gaps CCH/CoC** |
| Report output | `/admin/compost/reports` + `CompostReportClient` | **Monthly Reports CCH/CoC** |
| Constants | `compostReporting.ts` (4.35×, lbs→tons, cars/1.17) | Static Values + ReFED |

## Key invariants

- **No points.** Food scrap is `payoutMode: 'diversion_only'` — pickups write
  `binPickups` + `inventory` only, never `transactions` or `pointsBalance`.
- **Linear weights** (Phase C decision) so the app reproduces Tia's 3-yr history
  exactly: `weight = binCount × fullnessFraction × {32:130, 48:195, 64:260}`.
- **Monthly total ≠ raw sum.** It's the month's *weekly average × 4.35*, with
  zero-entry months gap-filled by carrying the prior month forward.
- **Cars-equivalent is knowingly wrong** (`lbs / 1.17`) — reproduced for
  continuity with reports clients already received, flagged via `carsNote` and
  togglable with `USE_REFED_CARS`.
- **Walled off** from recycling: `/admin/compost/*` reads only
  `commercialAccounts` + `binPickups` + `bags`; admin-gated by `src/proxy.ts`.
```
