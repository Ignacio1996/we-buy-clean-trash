import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { SmsPurpose, SmsDeliveryStatus } from '@/lib/types/smsLog';
import { toE164 } from '@/lib/phone/normalize';

export interface SendSmsInput {
  toPhone: string;
  body: string;
  purpose: SmsPurpose;
  relatedDocId?: string | null;
}

let cachedClient: import('twilio').Twilio | null | undefined;

async function getTwilioClient(): Promise<import('twilio').Twilio | null> {
  if (cachedClient !== undefined) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    cachedClient = null;
    return null;
  }
  const { default: twilio } = await import('twilio');
  cachedClient = twilio(sid, token);
  return cachedClient;
}

export async function sendSMS(input: SendSmsInput): Promise<void> {
  const mode = process.env.SMS_MODE === 'twilio' ? 'twilio' : 'stub';

  let status: SmsDeliveryStatus = 'stub';
  let provider: 'stub' | 'twilio' = 'stub';
  let messageSid: string | null = null;
  let errorMessage: string | null = null;

  if (mode === 'twilio') {
    provider = 'twilio';
    const from = process.env.TWILIO_FROM_NUMBER;
    const e164 = toE164(input.toPhone);
    const client = await getTwilioClient();

    if (!client || !from) {
      status = 'failed';
      errorMessage = !client
        ? 'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN missing'
        : 'TWILIO_FROM_NUMBER missing';
      console.error(`[sms] config error: ${errorMessage}`);
    } else if (!e164) {
      status = 'skipped';
      errorMessage = `unparseable phone "${input.toPhone}"`;
      console.warn(`[sms] ${errorMessage}`);
    } else {
      try {
        const msg = await client.messages.create({
          to: e164,
          from,
          body: input.body,
        });
        status = 'sent';
        messageSid = msg.sid;
        console.log(`[sms] sent sid=${msg.sid} to=${e164} purpose=${input.purpose}`);
      } catch (err) {
        status = 'failed';
        errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[sms] twilio send failed: ${errorMessage}`);
      }
    }
  } else {
    console.log(`[sms-stub] to=${input.toPhone} purpose=${input.purpose} body=${input.body}`);
  }

  await adminDb.collection('smsLog').add({
    toPhone: input.toPhone,
    body: input.body,
    purpose: input.purpose,
    relatedDocId: input.relatedDocId ?? null,
    status,
    provider,
    messageSid,
    errorMessage,
    createdAt: FieldValue.serverTimestamp(),
  });
}
