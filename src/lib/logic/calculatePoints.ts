import {
  CONTAMINATION_PENALTY,
  MATERIAL_IDS,
  type ContaminationSeverity,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';

export const POINTS_PER_DOLLAR = 10000;
export const SEPARATED_MULTIPLIER = 2;

export interface CalculatePointsInput {
  weights: Partial<Record<MaterialId, number>>;
  materials: Record<MaterialId, MaterialPricing>;
  separated: boolean;
  contaminationSeverity: ContaminationSeverity;
}

export interface CalculatePointsBreakdown {
  perMaterial: Record<
    MaterialId,
    { weight: number; marketPrice: number; customerPct: number; dollars: number }
  >;
  subtotalDollars: number;
  separatedMultiplier: number;
  contaminationPenalty: number;
  payoutDollars: number;
  pointsAwarded: number;
}

export function calculatePoints(input: CalculatePointsInput): CalculatePointsBreakdown {
  const perMaterial = {} as CalculatePointsBreakdown['perMaterial'];
  let subtotalDollars = 0;
  for (const id of MATERIAL_IDS) {
    const weight = Math.max(0, input.weights[id] ?? 0);
    const { marketPrice, customerPct } = input.materials[id];
    const dollars = weight * marketPrice * customerPct;
    perMaterial[id] = { weight, marketPrice, customerPct, dollars };
    subtotalDollars += dollars;
  }
  const separatedMultiplier = input.separated ? SEPARATED_MULTIPLIER : 1;
  const contaminationPenalty = CONTAMINATION_PENALTY[input.contaminationSeverity];
  const payoutDollars = subtotalDollars * separatedMultiplier * (1 - contaminationPenalty);
  const pointsAwarded = Math.round(payoutDollars * POINTS_PER_DOLLAR);
  return {
    perMaterial,
    subtotalDollars,
    separatedMultiplier,
    contaminationPenalty,
    payoutDollars,
    pointsAwarded,
  };
}
