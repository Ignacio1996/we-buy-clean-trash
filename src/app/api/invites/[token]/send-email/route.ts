import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { sendEmail } from '@/lib/email/send';
import { buildInviteEmail } from '@/lib/invites/messages';
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
  if (!invite.email) {
    return NextResponse.json({ error: 'no_email' }, { status: 409 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;
  const { subject, text, html } = buildInviteEmail({
    acceptUrl,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });

  try {
    const { id } = await sendEmail({
      to: invite.email,
      subject,
      text,
      html,
      purpose: 'invite',
      relatedDocId: token,
    });
    return NextResponse.json({ ok: true, mailId: id });
  } catch (err) {
    console.error('[invites/send-email] failed', err);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
}
