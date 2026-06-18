import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';

/**
 * Admin-only: reassign a staff member's `zoneId`. Zone drives which sites/pickups
 * a user sees (e.g. the operator compost site list filters on it). Invites set the
 * zone at acceptance time, but there was previously no way to change it afterward —
 * this is that control. Pass an empty/absent zoneId to unassign.
 *
 * Only roles that actually use a zone (operator, program_manager) are accepted, to
 * avoid silently writing a zone onto residents/depot staff where it has no meaning.
 */
const ZONE_EDITABLE_ROLES = new Set(['operator', 'program_manager']);

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
  const uid = typeof raw.uid === 'string' ? raw.uid : '';
  const zoneId = typeof raw.zoneId === 'string' && raw.zoneId ? raw.zoneId : null;
  if (!uid) {
    return NextResponse.json({ error: 'missing_uid' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const role = snap.get('role');
  if (typeof role !== 'string' || !ZONE_EDITABLE_ROLES.has(role)) {
    return NextResponse.json({ error: 'role_has_no_zone' }, { status: 400 });
  }

  // Validate the target zone exists so we never strand a user on a dangling id.
  if (zoneId) {
    const zoneSnap = await adminDb.collection('zones').doc(zoneId).get();
    if (!zoneSnap.exists) {
      return NextResponse.json({ error: 'zone_not_found' }, { status: 400 });
    }
  }

  await userRef.update({ zoneId, updatedAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ ok: true, uid, zoneId });
}
