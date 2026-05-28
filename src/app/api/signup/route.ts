import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { geocodeAddress } from '@/lib/maps/geocode';
import { normalizePhone } from '@/lib/types/user';
import { sendEmail } from '@/lib/email/send';
import { buildResidentWelcomeEmail } from '@/lib/email/welcome';
import { SIGNUP_BONUS_POINTS } from '@/lib/logic/calculatePoints';

async function resolveZoneIdForZip(postalCode: string): Promise<string | null> {
  const snap = await adminDb
    .collection('zones')
    .where('zipCodes', 'array-contains', postalCode)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

interface SignupPayload {
  idToken: string;
  name: string;
  phone: string | null;
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
  // Phone is optional. If the caller sends a value we normalize + reject if invalid;
  // if the field is absent or empty we accept the signup with phone=null.
  const phoneRaw = typeof r.phone === 'string' ? r.phone.trim() : '';
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return null;
  if (!idToken || !name || !street || !city || !state || !postalCode) return null;
  return { idToken, name, phone, address: { street, unit, city, state, postalCode } };
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
      `verifyIdToken failed [signup] code=${e.code} name=${e.name} msg=${e.message}`,
    );
    // TEMP diagnostic — remove once root cause is known.
    return NextResponse.json(
      { error: 'invalid_id_token', _diag: { code: e.code, name: e.name, msg: e.message } },
      { status: 401 },
    );
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

  // Geocode + resolve zone before the transaction (Admin SDK transactions
  // can't run queries, only doc gets).
  const [geoResult, zoneId] = await Promise.all([
    geocodeAddress(payload.address),
    resolveZoneIdForZip(payload.address.postalCode),
  ]);
  const geo = geoResult ? { lat: geoResult.lat, lng: geoResult.lng } : null;

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
      geo,
      zoneId,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      uid,
      email: email ?? null,
      name: payload.name,
      phone: payload.phone,
      role: 'resident',
      zoneId,
      addressId: addressRef.id,
      depotId: null,
      pointsBalance: SIGNUP_BONUS_POINTS,
      freeSheetClaimed: false,
      onboardingCompletedAt: FieldValue.serverTimestamp(),
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

  // Fire-and-log the welcome email. The Firestore Send Email extension picks
  // it up asynchronously, so a failure here must never block signup.
  if (email) {
    try {
      const origin = request.headers.get('origin') ?? new URL(request.url).origin;
      const { subject, text, html } = buildResidentWelcomeEmail({
        name: payload.name,
        dashboardUrl: `${origin}/resident`,
        orderBagsUrl: `${origin}/resident/order-bags`,
      });
      await sendEmail({
        to: email,
        subject,
        text,
        html,
        purpose: 'welcome',
        relatedDocId: uid,
      });
    } catch (err) {
      console.error('[signup] welcome email send failed', err);
    }
  }

  return NextResponse.json({ ok: true, role: 'resident' });
}
