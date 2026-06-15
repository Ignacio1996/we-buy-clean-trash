/**
 * Constants + pure helpers that reproduce the math in Tia's
 * "Compost Clubhouse Collection Data" workbook, so the app's diversion reports
 * match her three-year reporting history exactly.
 *
 * Two sheets drive the numbers:
 *  - "Static Values" — the constants below
 *  - "Fill in the Gaps CCH"/"CoC" — the per-site × per-month rollup engine
 *    (monthly extrapolation + gap-fill). That engine will live alongside this
 *    file; this module holds only the shared constants + impact conversions.
 *
 * See "planning/Compost Integration - Phase C.md" for the full analysis.
 */

/**
 * Weeks-per-month multiplier from the "Static Values" sheet (cell C2).
 *
 * Tia's "Monthly Total" is NOT a sum of that month's pickups — it is the
 * month's *weekly average* extrapolated to a standard month:
 *
 *     monthlyTotal = (reportedTotalLbs / pickupEntryCount) × MONTHLY_MULTIPLIER
 *
 * 4.35 ≈ 52.18 weeks / 12 months. When a month has zero pickup entries the
 * engine carries the previous month's total forward ("filling the gaps").
 */
export const MONTHLY_MULTIPLIER = 4.35;

/** Pounds per US ton — used for the lbs → tons KPI. */
export const LBS_PER_TON = 2000;

/**
 * ReFED diversion-impact constants (the scientifically correct factors).
 * Per ton: 5.41 of CO2eq, 1.17 passenger vehicles driven for a year.
 * These are the per-POUND equivalents.
 */
export const REFED_CO2EQ_TONS_PER_LB = 0.00245393764;
export const REFED_CARS_PER_LB = 0.0005307037;

/**
 * ⚠️ KNOWN DISCREPANCY — read before changing.
 *
 * Tia's workbook computes its "CO2e of Cars Off the Road" figure as
 * `lbs / 1.17`. The 1.17 is ReFED's cars-per-TON factor, so dividing POUNDS by
 * it is dimensionally wrong and inflates the result roughly 1,900× versus the
 * correct per-lb constant (REFED_CARS_PER_LB above). Example: 33,374 lbs →
 * her sheet reports ≈28,524 "cars", whereas the correct figure is ≈17.7 cars.
 *
 * Per the product decision (2026-06-15) we REPRODUCE her formula so the app's
 * numbers stay continuous with the reports her clients have already received,
 * but every surface that shows it must footnote it (see carsEquivalentNote).
 * Flip `USE_REFED_CARS` to true if Tia later agrees to correct it.
 */
export const LEGACY_CARS_DIVISOR = 1.17;
export const USE_REFED_CARS = false;

/** Tons of CO2eq avoided for a given pounds-diverted figure (correct ReFED). */
export function co2eqTons(lbs: number): number {
  return lbs * REFED_CO2EQ_TONS_PER_LB;
}

/**
 * "Cars off the road" figure for a given pounds-diverted total.
 * Reproduces Tia's historical `lbs / 1.17` by default (see LEGACY_CARS_DIVISOR).
 */
export function carsEquivalent(lbs: number): number {
  return USE_REFED_CARS ? lbs * REFED_CARS_PER_LB : lbs / LEGACY_CARS_DIVISOR;
}

/** Footnote to render anywhere carsEquivalent() is displayed. */
export const carsEquivalentNote = USE_REFED_CARS
  ? 'Cars-equivalent per ReFED (0.0005307037 vehicles/lb).'
  : "Cars-equivalent uses Compost Clubhouse's historical reporting factor for continuity with prior reports.";
