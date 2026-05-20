import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { sendSMS } from '@/lib/sms/send';

export const runtime = 'nodejs';

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
  const toPhone = typeof raw.toPhone === 'string' ? raw.toPhone.trim() : '';
  const customBody = typeof raw.body === 'string' ? raw.body.trim() : '';

  if (!toPhone) {
    return NextResponse.json({ error: 'missing_phone' }, { status: 400 });
  }

  const body =
    customBody || `WBCT test SMS — ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;

  await sendSMS({ toPhone, body, purpose: 'other', relatedDocId: null });

  return NextResponse.json({ ok: true, mode: process.env.SMS_MODE ?? 'stub' });
}
