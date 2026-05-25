import {
  CONTAMINATION_PENALTY,
  type ContaminationSeverity,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';

export const POINTS_PER_DOLLAR = 100;
export const SEPARATED_MULTIPLIER = 2;

export interface CalculatePointsInput {
  weights: Partial<Record<MaterialId, number>>;
  /** Pricing keyed by material id. Iteration is driven by this map's keys. */
  materials: Record<MaterialId, MaterialPricing>;
  separated: boolean;
  contaminationSeverity: ContaminationSeverity;
  /**
   * Optional per-material campaign multipliers (e.g. { aluminum: 2 } during a
   * "double points on aluminum" campaign). Applied to that material's dollar
   * contribution before the separated/contamination math.
   */
  materialMultipliers?: Record<MaterialId, number>;
}

export interface CalculatePointsBreakdown {
  perMaterial: Record<
    MaterialId,
    {
      weight: number;
      marketPrice: number;
      customerPct: number;
      campaignMultiplier: number;
      dollars: number;
    }
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
  for (const id of Object.keys(input.materials)) {
    const weight = Math.max(0, input.weights[id] ?? 0);
    const { marketPrice, customerPct, payoutMode } = input.materials[id];
    const campaignMultiplier = Math.max(0, input.materialMultipliers?.[id] ?? 1);
    // `diversion_only` materials log weight for reporting but never pay points,
    // regardless of price. Treat absent payoutMode as 'cash' for legacy snapshots.
    const dollars =
      payoutMode === 'diversion_only'
        ? 0
        : weight * marketPrice * customerPct * campaignMultiplier;
    perMaterial[id] = { weight, marketPrice, customerPct, campaignMultiplier, dollars };
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
