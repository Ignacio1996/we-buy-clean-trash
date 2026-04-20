import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

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

  const name = str(raw.name);
  const street = str(raw.street);
  const city = str(raw.city);
  const state = str(raw.state);
  const postalCode = str(raw.postalCode);
  if (!name || !street || !city || !state || !postalCode) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const ref = adminDb.collection('depots').doc();
  await ref.set({
    id: ref.id,
    name,
    street,
    city,
    state,
    postalCode,
    geo: null,
    managerId: null,
    zoneIds: [],
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
