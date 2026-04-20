import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

interface SignupPayload {
  idToken: string;
  name: string;
  address: {
    street: string;
    unit: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
}

function parsePayload(raw: unknown): SignupPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const a = (r.address ?? {}) as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const idToken = typeof r.idToken === 'string' ? r.idToken : '';
  const street = typeof a.street === 'string' ? a.street.trim() : '';
  const city = typeof a.city === 'string' ? a.city.trim() : '';
  const state = typeof a.state === 'string' ? a.state.trim() : '';
  const postalCode = typeof a.postalCode === 'string' ? a.postalCode.trim() : '';
  const unit = typeof a.unit === 'string' && a.unit.trim() ? a.unit.trim() : null;
  if (!idToken || !name || !street || !city || !state || !postalCode) return null;
  return { idToken, name, address: { street, unit, city, state, postalCode } };
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
  } catch {
    return NextResponse.json({ error: 'invalid_id_token' }, { status: 401 });
  }

  const { uid, email } = decoded;

  // Block re-signup or role reassignment: if a users doc already exists, bail.
  const userRef = adminDb.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  // Also block if a custom role claim is already set (invited non-residents shouldn't self-signup).
  if (decoded.role) {
    return NextResponse.json({ error: 'role_already_assigned' }, { status: 409 });
  }

  await adminAuth.setCustomUserClaims(uid, { role: 'resident' });

  const SIGNUP_BONUS_POINTS = 10000;
  const addressRef = adminDb.collection('addresses').doc();
  const transactionRef = adminDb.collection('transactions').doc();

  await adminDb.runTransaction(async (tx) => {
    tx.set(addressRef, {
      id: addressRef.id,
      residentId: uid,
      street: payload.address.street,
      unit: payload.address.unit,
      city: payload.address.city,
      state: payload.address.state,
      postalCode: payload.address.postalCode,
      geo: null,
      zoneId: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      uid,
      email: email ?? null,
      name: payload.name,
      role: 'resident',
      zoneId: null,
      addressId: addressRef.id,
      pointsBalance: SIGNUP_BONUS_POINTS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(transactionRef, {
      id: transactionRef.id,
      userId: uid,
      type: 'signup_bonus',
      pointsDelta: SIGNUP_BONUS_POINTS,
      balanceAfter: SIGNUP_BONUS_POINTS,
      relatedDocId: null,
      description: 'Welcome bonus',
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json({ ok: true, role: 'resident' });
}
