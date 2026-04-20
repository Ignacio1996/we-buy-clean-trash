import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '@/lib/firebase/admin';
import { isRole, ROLE_HOME_PATH, type Role } from '@/lib/types/role';
import { SESSION_COOKIE_NAME } from './cookie';

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from './cookie';

export interface SessionUser {
  uid: string;
  email: string | null;
  role: Role;
  claims: DecodedIdToken;
}

function claimsToSessionUser(claims: DecodedIdToken): SessionUser | null {
  if (!isRole(claims.role)) return null;
  return {
    uid: claims.uid,
    email: claims.email ?? null,
    role: claims.role,
    claims,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const claims = await adminAuth.verifySessionCookie(cookie, true);
    return claimsToSessionUser(claims);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== role) redirect(ROLE_HOME_PATH[session.role]);
  return session;
}
