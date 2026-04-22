import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { isInvitableRole } from '@/lib/types/role';

export const runtime = 'nodejs';

interface AcceptPayload {
  idToken: string;
  inviteToken: string;
  name: string;
}

function parsePayload(raw: unknown): AcceptPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const idToken = typeof r.idToken === 'string' ? r.idToken : '';
  const inviteToken = typeof r.inviteToken === 'string' ? r.inviteToken : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!idToken || !inviteToken || !name) return null;
  return { idToken, inviteToken, name };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const payload = parsePayload(json);
  if (!payload) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(payload.idToken, true);
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    console.error(
      `verifyIdToken failed [accept-invite] code=${e.code} name=${e.name} msg=${e.message}`,
    );
    return NextResponse.json({ error: 'invalid_id_token' }, { status: 401 });
  }
  const { uid, email } = decoded;
  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });

  const inviteRef = adminDb.collection('invites').doc(payload.inviteToken);
  const userRef = adminDb.collection('users').doc(uid);

  const result = await adminDb.runTransaction(async (tx) => {
    const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);
    if (!inviteSnap.exists) return { error: 'invite_not_found', status: 404 } as const;
    if (userSnap.exists) return { error: 'already_registered', status: 409 } as const;

    const invite = inviteSnap.data()!;
    if (invite.status !== 'pending') return { error: 'invite_not_pending', status: 409 } as const;
    const expiresAt = invite.expiresAt as Timestamp | undefined;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      tx.update(inviteRef, { status: 'expired' });
      return { error: 'invite_expired', status: 410 } as const;
    }
    if (typeof invite.email === 'string' && invite.email.toLowerCase() !== email.toLowerCase()) {
      return { error: 'email_mismatch', status: 403 } as const;
    }
    if (!isInvitableRole(invite.role)) return { error: 'invite_corrupt', status: 500 } as const;

    const depotId =
      typeof invite.depotId === 'string' && invite.depotId ? invite.depotId : null;

    // A depot_manager invite scoped to a depot implies this user manages that depot.
    // Wiring managerId here so the manager sees the depot on first login without
    // a separate admin step. Must read before writing to satisfy Firestore tx order.
    const shouldLinkManager = invite.role === 'depot_manager' && !!depotId;
    const depotRef = shouldLinkManager
      ? adminDb.collection('depots').doc(depotId!)
      : null;
    const depotSnap = depotRef ? await tx.get(depotRef) : null;

    tx.update(inviteRef, {
      status: 'consumed',
      consumedAt: FieldValue.serverTimestamp(),
      consumedBy: uid,
    });
    tx.set(userRef, {
      uid,
      email,
      name: payload.name,
      phone: null,
      role: invite.role,
      zoneId: invite.zoneId ?? null,
      addressId: null,
      depotId,
      pointsBalance: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (shouldLinkManager && depotRef && depotSnap?.exists) {
      tx.update(depotRef, { managerId: uid });
    }
    return { role: invite.role } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await adminAuth.setCustomUserClaims(uid, { role: result.role });
  return NextResponse.json({ ok: true, role: result.role });
}
