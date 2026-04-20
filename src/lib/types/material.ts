import type { Timestamp } from 'firebase-admin/firestore';

export const MATERIAL_IDS = [
  'aluminum',
  'tin_steel',
  'cardboard',
  'paper',
  'pet',
  'hdpe',
  'mixed_plastic',
] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

export function isMaterialId(value: unknown): value is MaterialId {
  return typeof value === 'string' && (MATERIAL_IDS as readonly string[]).includes(value);
}

export const MATERIAL_DISPLAY_NAMES: Record<MaterialId, string> = {
  aluminum: 'Aluminum',
  tin_steel: 'Tin / Steel',
  cardboard: 'Cardboard',
  paper: 'Paper',
  pet: 'PET',
  hdpe: 'HDPE',
  mixed_plastic: 'Mixed Plastic',
};

export interface MaterialPricing {
  marketPrice: number;
  customerPct: number;
}

export interface MaterialDoc extends MaterialPricing {
  id: MaterialId;
  name: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface PriceHistoryDoc {
  id: string;
  snapshot: Record<MaterialId, MaterialPricing>;
  createdAt: Timestamp;
  createdBy: string;
}

export const CONTAMINATION_SEVERITIES = ['none', 'minor', 'major', 'severe'] as const;
export type ContaminationSeverity = (typeof CONTAMINATION_SEVERITIES)[number];

export function isContaminationSeverity(value: unknown): value is ContaminationSeverity {
  return (
    typeof value === 'string' && (CONTAMINATION_SEVERITIES as readonly string[]).includes(value)
  );
}

export const CONTAMINATION_PENALTY: Record<ContaminationSeverity, number> = {
  none: 0,
  minor: 0.3,
  major: 0.6,
  severe: 0.9,
};
