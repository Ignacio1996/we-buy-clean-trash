import type { Timestamp } from 'firebase-admin/firestore';
import type { ComplianceNoticeType } from './complianceNotice';

export const COMPLIANCE_BATCH_STATUSES = ['generated', 'mailed'] as const;
export type ComplianceBatchStatus = (typeof COMPLIANCE_BATCH_STATUSES)[number];

export interface ComplianceBatchDoc {
  id: string;
  zoneId: string;
  zoneName: string;
  type: ComplianceNoticeType;
  residentCount: number;
  /** Resident UIDs included in this batch (snapshot at generation time). Empty array allowed. */
  residentIds: string[];
  /** Number of residents in the zone who were excluded because service had already started. */
  excludedActiveResidents: number;
  status: ComplianceBatchStatus;
  generatedAt: Timestamp;
  generatedBy: string;
  mailedAt: Timestamp | null;
  mailedBy: string | null;
  notes: string | null;
}

export const COMPLIANCE_NOTICE_LABELS: Record<ComplianceNoticeType, string> = {
  initial_service: 'Initial Service Notice',
  semi_annual: 'Semi-Annual Update',
};

export function isComplianceBatchStatus(value: unknown): value is ComplianceBatchStatus {
  return (
    typeof value === 'string' &&
    (COMPLIANCE_BATCH_STATUSES as readonly string[]).includes(value)
  );
}
