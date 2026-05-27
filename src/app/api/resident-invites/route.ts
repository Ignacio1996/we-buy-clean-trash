import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { toE164 } from '@/lib/phone/normalize';
import { sendEmail } from '@/lib/email/send';
import { sendSMS } from '@/lib/sms/send';
import { buildResidentInviteEmail, buildResidentInviteSms } from '@/lib/invites/messages';

type DeliveryResult = { channel: 'email' | 'sms'; ok: boolean; error?: string };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = (json ?? {}) as Record<string, unknown>;
  const email =
    typeof raw.email === 'string' && raw.email.trim()
      ? raw.email.trim().toLowerCase()
      : null;
  const phoneRaw = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const phone = phoneRaw ? toE164(phoneRaw) : null;

  if (!email && !phone) {
    return NextResponse.json({ error: 'email_or_phone_required' }, { status: 400 });
  }
  if (phoneRaw && !phone) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const signupUrl = `${origin}/signup`;
  const deliveries: DeliveryResult[] = [];

  if (email) {
    const { subject, text, html } = buildResidentInviteEmail({ signupUrl });
    try {
      await sendEmail({ to: email, subject, text, html, purpose: 'invite' });
      deliveries.push({ channel: 'email', ok: true });
    } catch (err) {
      console.error('[resident-invites] email send failed', err);
      deliveries.push({
        channel: 'email',
        ok: false,
        error: err instanceof Error ? err.message : 'send_failed',
      });
    }
  }
  if (phone) {
    try {
      await sendSMS({
        toPhone: phone,
        body: buildResidentInviteSms({ signupUrl }),
        purpose: 'invite',
      });
      deliveries.push({ channel: 'sms', ok: true });
    } catch (err) {
      console.error('[resident-invites] sms send failed', err);
      deliveries.push({
        channel: 'sms',
        ok: false,
        error: err instanceof Error ? err.message : 'send_failed',
      });
    }
  }

  return NextResponse.json({ ok: true, url: signupUrl, deliveries });
}
