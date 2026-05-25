import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { parsePickupDays, parseZipCodes } from '@/lib/types/zone';
import {
  assignResidentsToZone,
  unassignResidentsFromZone,
} from '@/lib/admin/assignResidentsToZone';

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
  if (raw.pickupDaysOfWeek !== undefined) {
    const days = parsePickupDays(raw.pickupDaysOfWeek);
    if (!days) {
      return NextResponse.json({ error: 'invalid_pickup_days' }, { status: 400 });
    }
    updates.pickupDaysOfWeek = days;
    // Clear the legacy single-day field on any zone that still has it so the
    // two never disagree after an edit.
    updates.pickupDayOfWeek = FieldValue.delete();
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

  let residentsAssigned = 0;
  let residentsUnassigned = 0;
  if (Array.isArray(updates.zipCodes)) {
    const newZips = updates.zipCodes as string[];
    residentsUnassigned = await unassignResidentsFromZone(id, newZips);
    if (newZips.length > 0) {
      residentsAssigned = await assignResidentsToZone(id, newZips);
    }
  }
  return NextResponse.json({ ok: true, residentsAssigned, residentsUnassigned });
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

  const residentsUnassigned = await unassignResidentsFromZone(id, []);

  const depotId = zoneSnap.get('depotId') as string | undefined;
  await adminDb.runTransaction(async (tx) => {
    tx.delete(zoneRef);
    if (depotId) {
      tx.update(adminDb.collection('depots').doc(depotId), {
        zoneIds: FieldValue.arrayRemove(id),
      });
    }
  });
  return NextResponse.json({ ok: true, residentsUnassigned });
}
