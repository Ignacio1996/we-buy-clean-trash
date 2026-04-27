import type { Timestamp } from 'firebase-admin/firestore';
import type { ContaminationSeverity, MaterialId, MaterialPricing } from './material';

export interface BagProcessingDoc {
  id: string;
  bagId: string;
  residentId: string;
  depotId: string;
  depotWorkerId: string;
  weights: Record<MaterialId, number>;
  separated: boolean;
  /**
   * Set by the depot worker at processing time when the bag's contents are
   * mixed beyond what can be sorted (e.g. plastic + glass jumbled together).
   * When true: weights are recorded into inventory for landfill-diversion
   * reporting, but pointsAwarded is forced to 0 regardless of weights.
   */
  commingled: boolean;
  contaminationSeverity: ContaminationSeverity;
  pointsAwarded: number;
  priceSnapshot: Record<MaterialId, MaterialPricing>;
  createdAt: Timestamp;
}
