'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish(destination: string | null) {
    router.replace(next ?? destination ?? '/');
    router.refresh();
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const home = await loginWithEmail(email, password);
      await finish(home);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login_failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      const home = await loginWithGoogle();
      await finish(home);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form onSubmit={handleEmail} className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
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
      <p className="mt-6 text-sm text-gray-600">
        New here?{' '}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
