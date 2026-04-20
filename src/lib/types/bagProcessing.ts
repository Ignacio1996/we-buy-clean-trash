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
  contaminationSeverity: ContaminationSeverity;
  pointsAwarded: number;
  priceSnapshot: Record<MaterialId, MaterialPricing>;
  createdAt: Timestamp;
}
