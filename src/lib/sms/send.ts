import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { SmsPurpose } from '@/lib/types/smsLog';

export interface SendSmsInput {
  toPhone: string;
  body: string;
  purpose: SmsPurpose;
  relatedDocId?: string | null;
}

export async function sendSMS(input: SendSmsInput): Promise<void> {
  // TODO(phase-post-pilot): replace with Twilio SDK call.
  console.log(`[sms-stub] to=${input.toPhone} purpose=${input.purpose} body=${input.body}`);
  await adminDb.collection('smsLog').add({
    toPhone: input.toPhone,
    body: input.body,
    purpose: input.purpose,
    relatedDocId: input.relatedDocId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}
