'use client';

import { Suspense, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth/client';
import { IconArrow, IconArrowLeft } from '@/components/icons/EcoIcons';

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
    <div style={shellStyle}>
      <Grain />

      <div style={topBarStyle}>
        <button type="button" onClick={() => router.back()} style={backBtnStyle}>
          <IconArrowLeft size={14} color="var(--ink-soft)" />
          <span style={backLabelStyle}>Back</span>
        </button>
        <div style={mastheadStyle}>We Buy Clean Trash</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={bodyStyle}>
        <div style={eyebrowStyle}>Returning resident</div>
        <h1 style={titleStyle}>
          Welcome <em style={{ fontStyle: 'italic', color: 'var(--green)' }}>back</em>.
        </h1>
        <p style={ledeStyle}>Sign in to see this week&rsquo;s pickup.</p>

        <form onSubmit={handleEmail}>
          <div style={{ borderTop: '1px solid var(--line)', marginBottom: 14 }}>
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              placeholder="aguirre@example.com"
              required
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              required
              mono
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Link href="/forgot-password" style={forgotStyle}>
              Forgot password?
            </Link>
          </div>

          {error && <ErrorNotice />}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>
        </form>

        <div style={dividerStyle}>
          <div style={dividerLineStyle} />
          <span style={dividerTextStyle}>or</span>
          <div style={dividerLineStyle} />
        </div>

        <button type="button" onClick={handleGoogle} disabled={busy} style={googleBtnStyle}>
          <GoogleG />
          <span>Continue with Google</span>
        </button>

        <p style={footerLinkStyle}>
          New here?{' '}
          <Link
            href="/signup"
            style={{ color: 'var(--green)', fontWeight: 600, fontStyle: 'normal' }}
          >
            Create an account
          </Link>
        </p>
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
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={fieldRowStyle}>
      <span style={{ ...eyebrowStyle, flexShrink: 0, margin: 0 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: mono ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'var(--eco-serif)',
          fontSize: mono ? 14 : 15,
          color: value ? 'var(--ink)' : 'var(--ink-faint)',
          fontStyle: value ? 'normal' : 'italic',
          textAlign: 'right',
          padding: 0,
          flex: 1,
          minWidth: 0,
          letterSpacing: mono ? 2 : 0,
        }}
      />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: disabled ? 'var(--line)' : 'var(--green)',
        color: disabled ? 'var(--ink-faint)' : 'var(--paper)',
        border: 'none',
        borderRadius: 14,
        padding: '15px 18px',
        fontFamily: 'var(--eco-sans)',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 0.3,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        marginBottom: 18,
      }}
    >
      <span>{children}</span>
      <IconArrow size={16} color={disabled ? 'var(--ink-faint)' : 'var(--paper)'} />
    </button>
  );
}

function ErrorNotice() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        background: 'var(--rust-soft)',
        border: '1px solid rgba(154, 75, 38, 0.3)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--rust)',
          color: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--eco-serif)',
          fontStyle: 'italic',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        !
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 13,
            color: 'var(--rust)',
            fontStyle: 'italic',
          }}
        >
          That doesn&rsquo;t match our records.
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
          Check email and password, or reset.
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
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

function Grain() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.4,
        pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(160,140,100,0.06) 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(160,140,100,0.05) 1px, transparent 2px)',
        backgroundSize: '14px 14px, 22px 22px',
      }}
    />
  );
}

const shellStyle: CSSProperties = {
  width: '100%',
  minHeight: '100dvh',
  background: 'var(--paper-bg)',
  color: 'var(--ink)',
  fontFamily: 'var(--eco-sans)',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const topBarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '20px 20px 12px',
  borderBottom: '1px solid var(--line)',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
};

const backBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--ink-soft)',
};

const backLabelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: 1.4,
};

const mastheadStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 13,
  color: 'var(--green)',
};

const bodyStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  flex: 1,
  padding: '36px 22px 24px',
  maxWidth: 480,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: 1.4,
  fontWeight: 500,
  fontFamily: 'var(--eco-sans)',
  marginBottom: 8,
  display: 'block',
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontSize: 32,
  lineHeight: 1.05,
  fontWeight: 400,
  letterSpacing: -0.6,
  marginBottom: 8,
  color: 'var(--ink)',
};

const ledeStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 13,
  color: 'var(--ink-soft)',
  lineHeight: 1.5,
  marginBottom: 22,
};

const fieldRowStyle: CSSProperties = {
  padding: '14px 0',
  borderBottom: '1px solid var(--line-soft)',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
};

const forgotStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 12,
  color: 'var(--green)',
  textDecoration: 'none',
};

const dividerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  margin: '8px 0 16px',
  color: 'var(--ink-soft)',
};

const dividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: 'var(--line)',
};

const dividerTextStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1.4,
};

const googleBtnStyle: CSSProperties = {
  width: '100%',
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: '13px 18px',
  fontFamily: 'var(--eco-sans)',
  fontSize: 13,
  fontWeight: 500,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  marginBottom: 28,
};

const footerLinkStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 12,
  color: 'var(--ink-soft)',
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
};
