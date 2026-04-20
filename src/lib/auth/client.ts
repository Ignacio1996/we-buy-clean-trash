'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { ROLE_HOME_PATH, isRole } from '@/lib/types/role';

const googleProvider = new GoogleAuthProvider();

async function exchangeForSession(credential: UserCredential): Promise<string | null> {
  const idToken = await credential.user.getIdToken(true);
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'session_failed');
  }
  const body = (await res.json()) as { ok: boolean; role: unknown };
  return isRole(body.role) ? ROLE_HOME_PATH[body.role] : null;
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return exchangeForSession(credential);
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return exchangeForSession(credential);
}

export async function signupWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signupWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function getFreshIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  return user.getIdToken(true);
}

export async function logout() {
  await signOut(auth);
  await fetch('/api/session', { method: 'DELETE' });
}
