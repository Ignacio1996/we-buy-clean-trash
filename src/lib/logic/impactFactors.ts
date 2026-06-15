import type { MaterialId } from '@/lib/types/material';

/**
 * Environmental-impact conversion factors, per pound of material recycled
 * instead of landfilled. Drives the resident dashboard "Impact" card.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TODO: confirm conversion factors.
 * These are EPA WARM–style *placeholders* picked to be directionally sane (a
 * pound of aluminum saves far more than a pound of mixed plastic) — they are
 * NOT yet sourced from a published table. Before the figures are shown to real
 * residents as fact, replace each row with values from EPA WARM, the Aluminum
 * Association, AF&PA, or an equivalent authority, and update the citation.
 *
 * Keep this file the single source of truth — never inline these numbers
 * elsewhere. Adding a new material? Add a row here; custom/unknown materials
 * fall back to DEFAULT_IMPACT_FACTOR so the card never silently undercounts.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface ImpactFactors {
  /** Pounds of CO₂-equivalent emissions avoided per lb recycled. */
  co2LbsPerLb: number;
  /** Gallons of water saved per lb recycled (vs. virgin production). */
  waterGalPerLb: number;
  /** Kilowatt-hours of energy saved per lb recycled (vs. virgin production). */
  energyKwhPerLb: number;
}

// PLACEHOLDER values — see TODO above.
export const IMPACT_FACTORS: Record<MaterialId, ImpactFactors> = {
  aluminum: { co2LbsPerLb: 9.1, waterGalPerLb: 1.6, energyKwhPerLb: 7.2 },
  tin_steel: { co2LbsPerLb: 1.8, waterGalPerLb: 1.0, energyKwhPerLb: 2.4 },
  cardboard: { co2LbsPerLb: 3.1, waterGalPerLb: 3.0, energyKwhPerLb: 1.5 },
  paper: { co2LbsPerLb: 3.5, waterGalPerLb: 3.5, energyKwhPerLb: 1.8 },
  pet: { co2LbsPerLb: 1.5, waterGalPerLb: 1.4, energyKwhPerLb: 1.2 },
  hdpe: { co2LbsPerLb: 1.4, waterGalPerLb: 1.2, energyKwhPerLb: 1.0 },
  mixed_plastic: { co2LbsPerLb: 1.0, waterGalPerLb: 1.0, energyKwhPerLb: 0.8 },
};

// Fallback for materials without an explicit row (e.g. admin-added commodities).
// Conservative so unknown materials don't overstate impact. TODO: confirm.
export const DEFAULT_IMPACT_FACTOR: ImpactFactors = {
  co2LbsPerLb: 1.0,
  waterGalPerLb: 1.0,
  energyKwhPerLb: 0.8,
};

export interface ImpactTotals {
  /** Total pounds diverted from landfill across all materials. */
  lbsDiverted: number;
  co2LbsAvoided: number;
  waterGalSaved: number;
  energyKwhSaved: number;
}

/**
 * Aggregate per-material recycled weights (lbs) into total environmental
 * impact. Pure — trivially unit-testable, no framework imports.
 */
export function calculateImpact(weights: Partial<Record<MaterialId, number>>): ImpactTotals {
  const totals: ImpactTotals = {
    lbsDiverted: 0,
    co2LbsAvoided: 0,
    waterGalSaved: 0,
    energyKwhSaved: 0,
  };
  for (const [id, rawWeight] of Object.entries(weights)) {
    const weight = Math.max(0, rawWeight ?? 0);
    if (weight === 0) continue;
    const f = IMPACT_FACTORS[id] ?? DEFAULT_IMPACT_FACTOR;
    totals.lbsDiverted += weight;
    totals.co2LbsAvoided += weight * f.co2LbsPerLb;
    totals.waterGalSaved += weight * f.waterGalPerLb;
    totals.energyKwhSaved += weight * f.energyKwhPerLb;
  }
  return totals;
}
