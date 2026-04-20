import type { Timestamp } from 'firebase-admin/firestore';

export const COMPLIANCE_NOTICE_TYPES = ['initial_service', 'semi_annual'] as const;
export type ComplianceNoticeType = (typeof COMPLIANCE_NOTICE_TYPES)[number];

export const COMPLIANCE_NOTICE_STATUSES = ['generated', 'mailed'] as const;
export type ComplianceNoticeStatus = (typeof COMPLIANCE_NOTICE_STATUSES)[number];

export interface ComplianceNoticeDoc {
  id: string;
  residentId: string;
  type: ComplianceNoticeType;
  pdfUrl: string;
  status: ComplianceNoticeStatus;
  generatedAt: Timestamp;
  mailedAt: Timestamp | null;
  mailedBy: string | null;
}
