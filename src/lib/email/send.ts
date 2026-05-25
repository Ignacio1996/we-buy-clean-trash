import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  purpose: 'invite' | 'delivery_scheduled' | 'welcome' | 'other';
  relatedDocId?: string | null;
}

// Writes a doc to the Firestore collection watched by the Firebase
// "Trigger Email from Firestore" extension (firebase/firestore-send-email).
// The extension reads the doc and sends via configured SMTP, writing
// delivery status back to the same doc under `delivery`.
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const collection = process.env.FIRESTORE_SEND_EMAIL_COLLECTION || 'mail';
  const from = process.env.EMAIL_FROM || null;

  const message: Record<string, unknown> = {
    subject: input.subject,
    text: input.text,
  };
  if (input.html) message.html = input.html;

  const doc: Record<string, unknown> = {
    to: input.to,
    message,
    purpose: input.purpose,
    relatedDocId: input.relatedDocId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (from) doc.from = from;

  const ref = await adminDb.collection(collection).add(doc);
  console.log(`[email] queued id=${ref.id} to=${input.to} purpose=${input.purpose}`);
  return { id: ref.id };
}
