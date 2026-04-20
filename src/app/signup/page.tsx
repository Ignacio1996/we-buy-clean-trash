'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFreshIdToken, signupWithEmail, signupWithGoogle } from '@/lib/auth/client';
import { PresignupScanBanner } from '@/components/PresignupScanBanner';

interface Address {
  street: string;
  unit: string;
  city: string;
  state: string;
  postalCode: string;
}

const EMPTY_ADDRESS: Address = { street: '', unit: '', city: '', state: '', postalCode: '' };

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function postSignup(idToken: string) {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idToken,
        name: name.trim(),
        address: {
          street: address.street.trim(),
          unit: address.unit.trim() || null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'signup_failed');
    }
  }

  async function finish() {
    // After /api/signup sets the role claim we need a fresh ID token that carries it,
    // then exchange it for a session cookie.
    const fresh = await getFreshIdToken();
    const sessionRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: fresh }),
    });
    if (!sessionRes.ok) throw new Error('session_failed');
    router.replace('/resident');
    router.refresh();
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signupWithEmail(email, password);
      const idToken = await getFreshIdToken();
      await postSignup(idToken);
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signup_failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim() || !address.street.trim()) {
        throw new Error('fill_name_and_address_first');
      }
      await signupWithGoogle();
      const idToken = await getFreshIdToken();
      await postSignup(idToken);
      await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signup_failed');
    } finally {
      setBusy(false);
    }
  }

  function updateAddress<K extends keyof Address>(key: K, value: string) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4 pb-16">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-gray-600">
        Residents only — operator and depot accounts are invite-only.
      </p>

      <div className="mt-4">
        <PresignupScanBanner />
      </div>

      <form onSubmit={handleEmail} className="mt-6 space-y-3">
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
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />

        <div className="pt-2">
          <h2 className="text-sm font-medium text-gray-700">Pickup address</h2>
        </div>
        <input
          required
          placeholder="Street"
          value={address.street}
          onChange={(e) => updateAddress('street', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <input
          placeholder="Unit / Apt (optional)"
          value={address.unit}
          onChange={(e) => updateAddress('unit', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            required
            placeholder="City"
            value={address.city}
            onChange={(e) => updateAddress('city', e.target.value)}
            className="col-span-2 rounded border border-gray-300 px-3 py-2"
          />
          <input
            required
            placeholder="State"
            maxLength={2}
            value={address.state}
            onChange={(e) => updateAddress('state', e.target.value.toUpperCase())}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <input
          required
          placeholder="ZIP"
          value={address.postalCode}
          onChange={(e) => updateAddress('postalCode', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
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
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
