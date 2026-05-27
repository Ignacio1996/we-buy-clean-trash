import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isInvitableRole } from '@/lib/types/role';
import { toE164 } from '@/lib/phone/normalize';
import { sendEmail } from '@/lib/email/send';
import { sendSMS } from '@/lib/sms/send';
import { buildInviteEmail, buildInviteSms } from '@/lib/invites/messages';

const INVITE_TTL_DAYS = 7;

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
  const role = raw.role;
  const zoneId = typeof raw.zoneId === 'string' && raw.zoneId ? raw.zoneId : null;
  const depotId = typeof raw.depotId === 'string' && raw.depotId ? raw.depotId : null;

  if (!isInvitableRole(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: 'email_or_phone_required' }, { status: 400 });
  }
  if (phoneRaw && !phone) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  }

  const token = randomUUID();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await adminDb.collection('invites').doc(token).set({
    token,
    email,
    phone,
    role,
    zoneId,
    depotId,
    status: 'pending',
    createdBy: session.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    consumedAt: null,
    consumedBy: null,
  });

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;
  const deliveries: DeliveryResult[] = [];

  if (email) {
    const { subject, text, html } = buildInviteEmail({ acceptUrl, role, expiresAt });
    try {
      await sendEmail({ to: email, subject, text, html, purpose: 'invite', relatedDocId: token });
      deliveries.push({ channel: 'email', ok: true });
    } catch (err) {
      console.error('[invites] email send failed', err);
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
        body: buildInviteSms({ acceptUrl, role }),
        purpose: 'invite',
        relatedDocId: token,
      });
      deliveries.push({ channel: 'sms', ok: true });
    } catch (err) {
      console.error('[invites] sms send failed', err);
      deliveries.push({
        channel: 'sms',
        ok: false,
        error: err instanceof Error ? err.message : 'send_failed',
      });
    }
  }

  return NextResponse.json({ ok: true, token, url: acceptUrl, deliveries });
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const snap = await adminDb.collection('invites').orderBy('createdAt', 'desc').limit(50).get();
  const invites = snap.docs.map((d) => d.data());
  return NextResponse.json({ invites });
}
