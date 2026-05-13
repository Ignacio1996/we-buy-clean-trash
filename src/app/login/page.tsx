'use client';

import { Suspense, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth/client';
import {
  SS,
  SSEyebrow,
  SSPillButton,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
    <div
      style={{
        background: SS.bg,
        minHeight: '100dvh',
        color: SS.ink,
        fontFamily: SS.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/"
          aria-label="Back to home"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: SS.sans,
            textDecoration: 'none',
          }}
        >
          ←
        </Link>
        <Link
          href="/"
          aria-label="We Buy Clean Trash home"
          style={{
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: -0.4,
            color: SS.ink,
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          We Buy Clean <span style={{ color: SS.brand }}>Trash.</span>
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 1.2,
            color: SS.inkSoft,
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Home
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          padding: '28px 24px 8px',
        }}
      >
        <SSEyebrow style={{ color: SS.brand, marginBottom: 8 }}>Sign in</SSEyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          Welcome <span style={{ color: SS.green }}>back.</span>
        </h1>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.4,
            marginTop: 10,
            marginBottom: 24,
          }}
        >
          Sign in to see this week&rsquo;s pickup.
        </p>

        <form onSubmit={handleEmail}>
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            placeholder="aguirre@example.com"
            required
            background={SS.mint}
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••"
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: SS.sans,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: SS.brand,
                  textTransform: 'uppercase',
                }}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            }
          />

          <div style={{ textAlign: 'right', marginBottom: 18, marginTop: -4 }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: SS.ink,
                textDecoration: 'underline',
              }}
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div
              style={{
                background: SS.brand,
                border: `2px solid ${SS.ink}`,
                borderRadius: 14,
                padding: 14,
                color: '#fff',
                marginBottom: 16,
                fontFamily: SS.sans,
                boxShadow: `0 4px 0 ${SS.ink}`,
              }}
            >
              <SSEyebrow style={{ color: '#fff', opacity: 0.85, marginBottom: 4 }}>
                Error
              </SSEyebrow>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.3 }}>
                That doesn&rsquo;t match our records.
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, marginTop: 4 }}>
                Check email and password, or reset.
              </div>
            </div>
          )}

          <SSPillButton type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </SSPillButton>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '24px 0',
          }}
        >
          <div style={{ flex: 1, height: 2, background: SS.line }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: SS.inkSoft,
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 2, background: SS.line }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          style={{
            width: '100%',
            background: '#fff',
            color: SS.ink,
            border: `2px solid ${SS.ink}`,
            borderRadius: 999,
            padding: '18px 24px',
            fontFamily: SS.sans,
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: -0.2,
            boxShadow: `0 4px 0 ${SS.ink}`,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <GoogleG />
          <span>Continue with Google</span>
        </button>

        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 28,
          }}
        >
          New here?{' '}
          <Link
            href="/signup"
            style={{ color: SS.ink, textDecoration: 'underline', fontWeight: 900 }}
          >
            Create an account
          </Link>
        </div>
      </div>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  required,
  background = '#fff',
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  background?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: 'block',
        background,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 12,
        cursor: 'text',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <SSEyebrow>{label}</SSEyebrow>
        {trailing}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
          fontFamily: SS.sans,
          fontSize: 18,
          fontWeight: 800,
          color: SS.ink,
        }}
      />
    </label>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
