import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { sendSMS } from '@/lib/sms/send';
import { buildInviteSms } from '@/lib/invites/messages';
import type { InviteDoc } from '@/lib/types/invite';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { token } = await context.params;
  const ref = adminDb.collection('invites').doc(token);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const invite = snap.data() as InviteDoc;
  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'not_sendable' }, { status: 409 });
  }
  if (invite.expiresAt.toMillis() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 409 });
  }
  if (!invite.phone) {
    return NextResponse.json({ error: 'no_phone' }, { status: 409 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;
  const body = buildInviteSms({ acceptUrl, role: invite.role });

  try {
    await sendSMS({
      toPhone: invite.phone,
      body,
      purpose: 'invite',
      relatedDocId: token,
    });
    return NextResponse.json({ ok: true, mode: process.env.SMS_MODE ?? 'stub' });
  } catch (err) {
    console.error('[invites/send-sms] failed', err);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
}
