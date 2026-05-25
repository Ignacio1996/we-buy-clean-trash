'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFreshIdToken,
  signupWithEmail,
  loginWithEmail,
  signupWithGoogle,
  loginWithGoogle,
} from '@/lib/auth/client';
import { ROLE_HOME_PATH, type Role } from '@/lib/types/role';

type Mode = 'new' | 'existing';

export function InviteAcceptForm({
  token,
  email: invitedEmail,
  role,
}: {
  token: string;
  email: string | null;
  role: Exclude<Role, 'resident'>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitedEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailLocked = !!invitedEmail;

  async function submitAccept(idToken: string) {
    const res = await fetch('/api/accept-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken, inviteToken: token, name: name.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'accept_failed');
    }
  }

  async function finish() {
    const fresh = await getFreshIdToken();
    const sessionRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: fresh }),
    });
    if (!sessionRes.ok) throw new Error('session_failed');
    router.replace(ROLE_HOME_PATH[role]);
    router.refresh();
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('name_required');
      return;
    }
    if (mode === 'new' && password !== confirmPassword) {
      setError('passwords_do_not_match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'new') {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      const idToken = await getFreshIdToken();
      await submitAccept(idToken);
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'accept_failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!name.trim()) {
      setError('name_required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'new') {
        await signupWithGoogle();
      } else {
        await loginWithGoogle();
      }
      const idToken = await getFreshIdToken();
      await submitAccept(idToken);
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'accept_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`rounded border px-3 py-1 ${mode === 'new' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
        >
          New account
        </button>
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={`rounded border px-3 py-1 ${mode === 'existing' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
        >
          I already have one
        </button>
      </div>

      <form onSubmit={handleEmail} className="mt-4 space-y-3">
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={emailLocked}
          className={`w-full rounded border px-3 py-2 ${
            emailLocked
              ? 'border-gray-200 bg-gray-50 text-gray-600'
              : 'border-gray-300'
          }`}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder={mode === 'new' ? 'Create password (min 6)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {mode === 'new' && (
          <input
            type="password"
            required
            minLength={6}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'new' ? 'Create account' : 'Sign in & accept'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="mt-3 w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
      >
        Continue with Google
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
