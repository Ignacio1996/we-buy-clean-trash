import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from '@/lib/auth/cookie';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { idToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken : null;
  if (!idToken) {
    return NextResponse.json({ error: 'missing_id_token' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (err) {
    const e = err as { code?: string; message?: string; name?: string };
    console.error(
      `verifyIdToken failed [session] code=${e.code} name=${e.name} msg=${e.message}`,
    );
    return NextResponse.json({ error: 'invalid_id_token' }, { status: 401 });
  }

  // Reject ID tokens older than 5 minutes — forces fresh sign-in before issuing cookie.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
    return NextResponse.json({ error: 'stale_sign_in' }, { status: 401 });
  }

  const expiresIn = SESSION_COOKIE_MAX_AGE_SECONDS * 1000;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

  (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, {
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return NextResponse.json({ ok: true, role: decoded.role ?? null });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
