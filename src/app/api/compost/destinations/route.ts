import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isCompostManagerRole } from '@/lib/types/role';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isCompostManagerRole(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const raw = (json ?? {}) as Record<string, unknown>;

  const name = str(raw.name);
  if (!name) return NextResponse.json({ error: 'invalid_name' }, { status: 400 });

  const zoneId = str(raw.zoneId);
  if (!zoneId) return NextResponse.json({ error: 'invalid_zone_id' }, { status: 400 });
  const zoneSnap = await adminDb.collection('zones').doc(zoneId).get();
  if (!zoneSnap.exists) return NextResponse.json({ error: 'zone_not_found' }, { status: 400 });

  const contactPhone = strOrNull(raw.contactPhone);
  const smsEnabled = raw.smsEnabled === true;
  // Can't opt into SMS without a number to text.
  if (smsEnabled && !contactPhone) {
    return NextResponse.json({ error: 'sms_requires_phone' }, { status: 400 });
  }

  const ref = adminDb.collection('compostDestinations').doc();
  await ref.set({
    id: ref.id,
    name,
    zoneId,
    contactName: strOrNull(raw.contactName),
    contactPhone,
    smsEnabled,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
