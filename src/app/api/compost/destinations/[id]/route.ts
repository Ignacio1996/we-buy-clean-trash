import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';
import type { CompostDestinationDoc } from '@/lib/types/compostDestination';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const ref = adminDb.collection('compostDestinations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const current = snap.data() as CompostDestinationDoc;

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (raw.name !== undefined) {
    const v = str(raw.name);
    if (!v) return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    update.name = v;
  }
  if (raw.contactName !== undefined) update.contactName = strOrNull(raw.contactName);
  if (raw.contactPhone !== undefined) update.contactPhone = strOrNull(raw.contactPhone);
  if (raw.smsEnabled !== undefined) update.smsEnabled = raw.smsEnabled === true;
  if (raw.active !== undefined) update.active = Boolean(raw.active);

  // Resolve the effective phone/smsEnabled after this patch and block SMS-without-phone.
  const effPhone =
    update.contactPhone !== undefined
      ? (update.contactPhone as string | null)
      : current.contactPhone;
  const effSms =
    update.smsEnabled !== undefined ? (update.smsEnabled as boolean) : current.smsEnabled;
  if (effSms && !effPhone) {
    return NextResponse.json({ error: 'sms_requires_phone' }, { status: 400 });
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }
  await ref.update(update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const ref = adminDb.collection('compostDestinations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true });
}
