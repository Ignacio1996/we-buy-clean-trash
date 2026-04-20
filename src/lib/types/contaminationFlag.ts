import type { Timestamp } from 'firebase-admin/firestore';
import type { ContaminationSeverity } from './material';

export const STRIKE_LEVELS = ['warning', 'first', 'second', 'third'] as const;
export type StrikeLevel = (typeof STRIKE_LEVELS)[number];

export interface ContaminationFlagDoc {
  id: string;
  residentId: string;
  bagProcessingId: string;
  severity: ContaminationSeverity;
  strikeLevel: StrikeLevel;
  notifiedAt: Timestamp | null;
  createdAt: Timestamp;
}
