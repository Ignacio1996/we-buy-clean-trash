import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { parseZipCodes } from '@/lib/types/zone';
import { assignResidentsToZone } from '@/lib/admin/assignResidentsToZone';

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
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const depotId = typeof raw.depotId === 'string' ? raw.depotId.trim() : '';
  const pickupDayOfWeek = Number(raw.pickupDayOfWeek);
  const zipCodesRaw =
    typeof raw.zipCodes === 'string'
      ? raw.zipCodes
      : Array.isArray(raw.zipCodes)
        ? (raw.zipCodes as unknown[]).filter((x): x is string => typeof x === 'string').join(',')
        : '';
  const zipCodes = parseZipCodes(zipCodesRaw);

  if (
    !name ||
    !depotId ||
    !Number.isInteger(pickupDayOfWeek) ||
    pickupDayOfWeek < 0 ||
    pickupDayOfWeek > 6
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const depotRef = adminDb.collection('depots').doc(depotId);
  const depotSnap = await depotRef.get();
  if (!depotSnap.exists) {
    return NextResponse.json({ error: 'depot_not_found' }, { status: 404 });
  }

  const zoneRef = adminDb.collection('zones').doc();
  await adminDb.runTransaction(async (tx) => {
    tx.set(zoneRef, {
      id: zoneRef.id,
      name,
      depotId,
      pickupDayOfWeek,
      zipCodes,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(depotRef, { zoneIds: FieldValue.arrayUnion(zoneRef.id) });
  });

  const assigned = await assignResidentsToZone(zoneRef.id, zipCodes);
  return NextResponse.json({ ok: true, id: zoneRef.id, residentsAssigned: assigned });
}
