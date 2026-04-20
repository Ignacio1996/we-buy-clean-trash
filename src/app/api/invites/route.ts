import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { isInvitableRole } from '@/lib/types/role';

export const runtime = 'nodejs';

const INVITE_TTL_DAYS = 7;

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
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const role = raw.role;
  const zoneId = typeof raw.zoneId === 'string' && raw.zoneId ? raw.zoneId : null;
  const depotId = typeof raw.depotId === 'string' && raw.depotId ? raw.depotId : null;

  if (!email || !isInvitableRole(role)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const token = randomUUID();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await adminDb.collection('invites').doc(token).set({
    token,
    email,
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
  return NextResponse.json({ ok: true, token, url: `${origin}/invite/${token}` });
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
