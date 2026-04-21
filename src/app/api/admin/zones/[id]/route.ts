import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { parseZipCodes } from '@/lib/types/zone';

export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
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

  const updates: Record<string, unknown> = {};
  if (typeof raw.name === 'string' && raw.name.trim()) updates.name = raw.name.trim();
  if (raw.pickupDayOfWeek !== undefined) {
    const d = Number(raw.pickupDayOfWeek);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return NextResponse.json({ error: 'invalid_pickup_day' }, { status: 400 });
    }
    updates.pickupDayOfWeek = d;
  }
  if (raw.zipCodes !== undefined) {
    const text =
      typeof raw.zipCodes === 'string'
        ? raw.zipCodes
        : Array.isArray(raw.zipCodes)
          ? (raw.zipCodes as unknown[]).filter((x): x is string => typeof x === 'string').join(',')
          : '';
    updates.zipCodes = parseZipCodes(text);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  const zoneRef = adminDb.collection('zones').doc(id);
  const zoneSnap = await zoneRef.get();
  if (!zoneSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await zoneRef.update(updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  const zoneRef = adminDb.collection('zones').doc(id);
  const zoneSnap = await zoneRef.get();
  if (!zoneSnap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const usersSnap = await adminDb.collection('users').where('zoneId', '==', id).limit(1).get();
  if (!usersSnap.empty) {
    return NextResponse.json({ error: 'zone_has_residents' }, { status: 409 });
  }

  const depotId = zoneSnap.get('depotId') as string | undefined;
  await adminDb.runTransaction(async (tx) => {
    tx.delete(zoneRef);
    if (depotId) {
      tx.update(adminDb.collection('depots').doc(depotId), {
        zoneIds: FieldValue.arrayRemove(id),
      });
    }
  });
  return NextResponse.json({ ok: true });
}
