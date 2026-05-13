'use client';

import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFreshIdToken, signupWithEmail } from '@/lib/auth/client';
import { PresignupScanBanner } from '@/components/PresignupScanBanner';
import {
  SS,
  SSDots,
  SSEyebrow,
  SSPillButton,
  SSStickerCard,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  calculateBagOrderTotal,
} from '@/lib/logic/calculateBagOrderTotal';

type Step = 'splash' | 'address' | 'how' | 'account' | 'password' | 'first';

const FLOW: Step[] = ['splash', 'address', 'how', 'account', 'password', 'first'];

type NotifyPref = 'sms' | 'email' | 'both';

interface AddressForm {
  street: string;
  unit: string;
  city: string;
  state: string;
  postalCode: string;
}

const EMPTY_ADDRESS: AddressForm = {
  street: '',
  unit: '',
  city: '',
  state: '',
  postalCode: '',
};

export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('splash');
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notify, setNotify] = useState<NotifyPref>('sms');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [bagQty, setBagQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idx = Math.max(0, FLOW.indexOf(step));
  // Step 0 (splash) shows no dot bar; dots run 0..3 across the remaining 4 "decision" steps
  // (address, account, password, first). "How" is informational — keep step indicator on
  // the prior dot.
  const dotStepByStep: Record<Step, number> = {
    splash: 0,
    address: 0,
    how: 0,
    account: 1,
    password: 2,
    first: 3,
  };

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function goBack() {
    const i = FLOW.indexOf(step);
    if (i > 0) go(FLOW[i - 1]);
  }

  const addressValid =
    address.street.trim() !== '' &&
    address.city.trim() !== '' &&
    address.state.trim() !== '' &&
    address.postalCode.trim() !== '';

  const accountValid = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email.trim());

  async function completeSignup() {
    setBusy(true);
    setError(null);
    try {
      await signupWithEmail(email.trim(), password);
      const idToken = await getFreshIdToken();
      const signupRes = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idToken,
          name: name.trim(),
          phone: phone.trim() || null,
          address: {
            street: address.street.trim(),
            unit: address.unit.trim() || null,
            city: address.city.trim(),
            state: address.state.trim(),
            postalCode: address.postalCode.trim(),
          },
        }),
      });
      if (!signupRes.ok) {
        const body = await signupRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'signup_failed');
      }
      const fresh = await getFreshIdToken();
      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: fresh }),
      });
      if (!sessionRes.ok) throw new Error('session_failed');
      go('first');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signup_failed');
    } finally {
      setBusy(false);
    }
  }

  async function placeBagOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bag-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: bagQty }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'order_failed');
      router.replace(body.checkoutUrl ?? '/resident');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'order_failed');
      setBusy(false);
    }
  }

  function skipBagOrder() {
    router.replace('/resident');
    router.refresh();
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

      {step === 'splash' ? (
        <SplashHeader />
      ) : (
        <StepBar onBack={goBack} step={dotStepByStep[step]} total={4} />
      )}

      <div
        style={{
          flex: 1,
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {step === 'splash' && <SplashStep onNext={() => go('address')} />}
        {step === 'address' && (
          <AddressStep
            address={address}
            onChange={setAddress}
            onNext={() => go('how')}
            valid={addressValid}
            idx={idx}
          />
        )}
        {step === 'how' && <HowStep onNext={() => go('account')} idx={idx} />}
        {step === 'account' && (
          <AccountStep
            name={name}
            email={email}
            phone={phone}
            notify={notify}
            onName={setName}
            onEmail={setEmail}
            onPhone={setPhone}
            onNotify={setNotify}
            valid={accountValid}
            onNext={() => go('password')}
            idx={idx}
          />
        )}
        {step === 'password' && (
          <PasswordStep
            password={password}
            confirm={confirm}
            show={showPw}
            onPassword={setPassword}
            onConfirm={setConfirm}
            onToggleShow={() => setShowPw((s) => !s)}
            onNext={completeSignup}
            busy={busy}
            error={error}
            idx={idx}
          />
        )}
        {step === 'first' && (
          <FirstBagStep
            qty={bagQty}
            onQty={setBagQty}
            onPlace={placeBagOrder}
            onSkip={skipBagOrder}
            busy={busy}
            error={error}
            idx={idx}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 1 · Splash ─────────────────────────────────────────────
function SplashStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '32px 24px 28px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7, letterSpacing: 1.6 }}>
          We Buy Clean Trash
        </SSEyebrow>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: -1.6,
            lineHeight: 0.95,
            color: SS.ink,
          }}
        >
          Your trash is <span style={{ color: SS.green }}>worth money.</span>
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: SS.ink,
            opacity: 0.75,
            lineHeight: 1.4,
          }}
        >
          We pick up your clean recyclables at the curb and pay you in gift cards. No sorting
          machines. No bins to lug.
        </div>

        <PresignupScanBanner />

        <SSStickerCard style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: SS.green,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            $
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: SS.ink, letterSpacing: -0.5 }}>
              $10 gift card
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: SS.inkSoft }}>
              ≈ 4 weeks of pickups
            </div>
          </div>
        </SSStickerCard>
      </div>

      <div style={{ background: '#fff', padding: '20px 24px 28px' }}>
        <SSPillButton onClick={onNext} variant="primary">
          Get started
        </SSPillButton>
        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 16,
          }}
        >
          Have an account?{' '}
          <Link
            href="/login"
            style={{ color: SS.ink, textDecoration: 'underline', fontWeight: 900 }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 · Address ────────────────────────────────────────────
function AddressStep({
  address,
  onChange,
  onNext,
  valid,
  idx,
}: {
  address: AddressForm;
  onChange: (a: AddressForm) => void;
  onNext: () => void;
  valid: boolean;
  idx: number;
}) {
  function update<K extends keyof AddressForm>(key: K, value: string) {
    onChange({ ...address, [key]: key === 'state' ? value.toUpperCase() : value });
  }
  return (
    <>
      <StepHeading
        eyebrow={`Step ${idx} · Service area`}
        title="Where do you live?"
        lede="We need your address so our driver can find your bags."
      />
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <FormInput
          label="Street"
          value={address.street}
          onChange={(v) => update('street', v)}
          placeholder="312 Almanac Way"
          autoComplete="address-line1"
          background={SS.mint}
        />
        <FormInput
          label="Apt / Unit (optional)"
          value={address.unit}
          onChange={(v) => update('unit', v)}
          placeholder="Apt 3B"
          autoComplete="address-line2"
        />
        <FormInput
          label="City"
          value={address.city}
          onChange={(v) => update('city', v)}
          placeholder="Portland"
          autoComplete="address-level2"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>
          <FormInput
            label="State"
            value={address.state}
            onChange={(v) => update('state', v)}
            placeholder="OR"
            maxLength={2}
            autoComplete="address-level1"
          />
          <FormInput
            label="ZIP"
            value={address.postalCode}
            onChange={(v) => update('postalCode', v)}
            placeholder="97214"
            autoComplete="postal-code"
            background={SS.sky}
            mono
          />
        </div>
        {valid && (
          <div
            style={{
              background: SS.mint,
              border: `2px solid ${SS.ink}`,
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: SS.ink,
                color: SS.mint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: SS.ink }}>
              You&rsquo;re in service. We&rsquo;ll confirm your pickup day after sign-up.
            </div>
          </div>
        )}
      </div>
      <FooterBar>
        <SSPillButton variant="primary" disabled={!valid} onClick={onNext}>
          Continue
        </SSPillButton>
      </FooterBar>
    </>
  );
}

// ─── Step 3 · How it works ───────────────────────────────────────
function HowStep({ onNext, idx }: { onNext: () => void; idx: number }) {
  const steps = [
    ['Order bags', 'Reusable, labeled by material. Free shipping over $20.'],
    ['Fill clean', 'Rinse what goes in. Caps off bottles. No glass shards.'],
    ['Set out by 5:30', 'On your pickup day. We weigh, sort, and credit points.'],
    ['Redeem', 'Cash out for gift cards once you reach $10.'],
  ];
  return (
    <>
      <StepHeading
        eyebrow={`Step ${idx} · How it works`}
        title="Four simple things."
        lede="Read once, do weekly."
      />
      <div style={{ background: SS.mint, padding: '24px 20px', flex: 1 }}>
        {steps.map(([t, sub], i) => (
          <div
            key={t}
            style={{ display: 'flex', gap: 14, padding: '12px 0', alignItems: 'flex-start' }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: SS.ink,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: SS.ink,
                  letterSpacing: -0.3,
                }}
              >
                {t}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: SS.ink,
                  marginTop: 2,
                  lineHeight: 1.35,
                  opacity: 0.75,
                }}
              >
                {sub}
              </div>
            </div>
          </div>
        ))}
      </div>
      <FooterBar>
        <SSPillButton variant="primary" onClick={onNext}>
          Continue
        </SSPillButton>
      </FooterBar>
    </>
  );
}

// ─── Step 4 · Account ────────────────────────────────────────────
function AccountStep({
  name,
  email,
  phone,
  notify,
  onName,
  onEmail,
  onPhone,
  onNotify,
  valid,
  onNext,
  idx,
}: {
  name: string;
  email: string;
  phone: string;
  notify: NotifyPref;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onNotify: (v: NotifyPref) => void;
  valid: boolean;
  onNext: () => void;
  idx: number;
}) {
  const options: Array<{ k: NotifyPref; label: string }> = [
    { k: 'sms', label: 'SMS' },
    { k: 'email', label: 'Email' },
    { k: 'both', label: 'Both' },
  ];
  return (
    <>
      <StepHeading
        eyebrow={`Step ${idx} · Your account`}
        title="A name to credit."
        lede="We'll use this on your account and pickup roster."
      />
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <FormInput
          label="Full name"
          value={name}
          onChange={onName}
          placeholder="Aguirre Mendez"
          autoComplete="name"
        />
        <FormInput
          label="Email"
          value={email}
          onChange={onEmail}
          placeholder="aguirre@example.com"
          type="email"
          autoComplete="email"
        />
        <FormInput
          label="Phone (optional)"
          value={phone}
          onChange={onPhone}
          placeholder="(503) 555-0117"
          type="tel"
          autoComplete="tel"
        />

        <SSEyebrow style={{ marginTop: 6, marginBottom: 10 }}>Pickup reminders</SSEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {options.map(({ k, label }) => {
            const active = notify === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onNotify(k)}
                style={{
                  padding: '14px 0',
                  textAlign: 'center',
                  border: `2px solid ${SS.ink}`,
                  background: active ? SS.yellow : '#fff',
                  color: SS.ink,
                  borderRadius: 14,
                  fontFamily: SS.sans,
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: active ? `0 4px 0 ${SS.ink}` : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: SS.inkSoft,
            lineHeight: 1.5,
            marginTop: 18,
          }}
        >
          By continuing you agree to our terms and a privacy policy that fits on a postcard.
        </p>
      </div>
      <FooterBar>
        <SSPillButton variant="primary" disabled={!valid} onClick={onNext}>
          Create account
        </SSPillButton>
      </FooterBar>
    </>
  );
}

// ─── Step 5 · Password ───────────────────────────────────────────
function PasswordStep({
  password,
  confirm,
  show,
  onPassword,
  onConfirm,
  onToggleShow,
  onNext,
  busy,
  error,
  idx,
}: {
  password: string;
  confirm: string;
  show: boolean;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  onToggleShow: () => void;
  onNext: () => void;
  busy: boolean;
  error: string | null;
  idx: number;
}) {
  const rules = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    {
      ok: /[A-Z]/.test(password) || /[0-9]/.test(password),
      label: 'A number or capital',
    },
    { ok: confirm.length > 0 && confirm === password, label: 'Both entries match' },
  ];
  const allOk = rules.every((r) => r.ok);

  return (
    <>
      <StepHeading
        eyebrow={`Step ${idx} · Password`}
        title="Set a password."
        lede="Used only to sign back in. Choose a phrase, not a puzzle."
      />
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <PasswordRow
          label="Password"
          value={password}
          onChange={onPassword}
          show={show}
          onToggle={onToggleShow}
          showToggle
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <PasswordRow
          label="Confirm"
          value={confirm}
          onChange={onConfirm}
          show={show}
          autoComplete="new-password"
          placeholder="Re-enter password"
        />

        <SSStickerCard style={{ marginTop: 6 }}>
          <SSEyebrow style={{ marginBottom: 10 }}>Rules</SSEyebrow>
          {rules.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderTop: i ? `1px solid ${SS.line}` : 'none',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `2px solid ${SS.ink}`,
                  background: r.ok ? SS.green : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                {r.ok ? '✓' : ''}
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: r.ok ? SS.ink : SS.inkSoft,
                }}
              >
                {r.label}
              </span>
            </div>
          ))}
        </SSStickerCard>

        {error && <ErrorNotice>{error}</ErrorNotice>}
      </div>
      <FooterBar>
        <SSPillButton variant="primary" disabled={!allOk || busy} onClick={onNext}>
          {busy ? 'Creating account…' : 'Continue'}
        </SSPillButton>
      </FooterBar>
    </>
  );
}

function PasswordRow({
  label,
  value,
  onChange,
  show,
  onToggle,
  showToggle,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label
      style={{
        display: 'block',
        background: '#fff',
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
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
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
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
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
          letterSpacing: show ? 0 : 4,
        }}
      />
    </label>
  );
}

// ─── Step 6 · First bag ──────────────────────────────────────────
function FirstBagStep({
  qty,
  onQty,
  onPlace,
  onSkip,
  busy,
  error,
  idx,
}: {
  qty: number;
  onQty: (v: number) => void;
  onPlace: () => void;
  onSkip: () => void;
  busy: boolean;
  error: string | null;
  idx: number;
}) {
  const breakdown = useMemo(
    () =>
      calculateBagOrderTotal({
        quantity: qty,
        unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS,
        // Brand-new signups always get the welcome credit. The bag-orders API
        // verifies and atomically claims the credit on the server.
        freeSheetCredits: 1,
      }),
    [qty],
  );
  return (
    <>
      <StepHeading
        eyebrow={`Step ${idx} · First batch`}
        title="Order your bags."
        lede="Your first sheet of 10 bags is on us. Add more if you'd like."
      />
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <div
          style={{
            background: SS.sky,
            border: `2px solid ${SS.ink}`,
            borderRadius: 22,
            padding: '24px 22px',
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: SS.ink }}>Sheets of bags</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => onQty(Math.max(1, qty - 1))}
                disabled={busy || qty <= 1}
                aria-label="Decrease"
                style={stepBtnStyle(false)}
              >
                −
              </button>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: SS.ink,
                  minWidth: 24,
                  textAlign: 'center',
                  letterSpacing: -0.8,
                }}
              >
                {qty}
              </div>
              <button
                type="button"
                onClick={() => onQty(Math.min(20, qty + 1))}
                disabled={busy || qty >= 20}
                aria-label="Increase"
                style={stepBtnStyle(true)}
              >
                +
              </button>
            </div>
          </div>
          {breakdown.freeSheetCredits > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: `1px dashed ${SS.ink}`,
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: SS.green }}>
                Welcome credit · 1 sheet
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 900, color: SS.green, fontStyle: 'italic' }}
              >
                −${breakdown.discount.toFixed(2)}
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: `1px dashed ${SS.ink}`,
              paddingTop: 12,
              marginTop: 4,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink }}>
              {qty * 10} bags · {breakdown.freeShipping ? 'free shipping' : `+$${SHIPPING_FEE.toFixed(2)} ship`}
            </div>
            <div
              style={{ fontSize: 22, fontWeight: 900, color: SS.ink, letterSpacing: -0.5 }}
            >
              ${breakdown.total.toFixed(2)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div
            style={{
              background: SS.mint,
              border: `2px solid ${SS.ink}`,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: SS.green,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              +
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: SS.ink, lineHeight: 1.3 }}>
              <span style={{ color: SS.green }}>+10,000 pts signup bonus</span> credited after
              your first pickup.
            </div>
          </div>
        </div>

        {!breakdown.freeShipping && breakdown.subtotal > 0 && (
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SS.inkSoft,
              marginTop: 12,
              padding: '0 4px',
            }}
          >
            Add ${(FREE_SHIPPING_THRESHOLD - breakdown.subtotal).toFixed(2)} more to unlock free
            shipping.
          </p>
        )}

        {error && <ErrorNotice>{error}</ErrorNotice>}
      </div>
      <FooterBar>
        <SSPillButton variant="primary" disabled={busy} onClick={onPlace}>
          {busy
            ? 'Placing order…'
            : breakdown.total === 0
              ? 'Claim my free sheet & continue'
              : 'Pay & continue'}
        </SSPillButton>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          style={{
            background: 'transparent',
            border: 'none',
            color: SS.inkSoft,
            fontFamily: SS.sans,
            fontSize: 13,
            fontWeight: 900,
            textDecoration: 'underline',
            marginTop: 12,
            cursor: busy ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          Skip — I&rsquo;ll order later
        </button>
      </FooterBar>
    </>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────
function SplashHeader() {
  return (
    <div
      style={{
        padding: '16px 20px 0',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      <Link
        href="/"
        aria-label="Back to home"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px 8px 12px',
          background: '#fff',
          border: `2px solid ${SS.ink}`,
          borderRadius: 999,
          boxShadow: `0 3px 0 ${SS.ink}`,
          fontFamily: SS.sans,
          fontSize: 12,
          fontWeight: 900,
          color: SS.ink,
          textDecoration: 'none',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: SS.ink,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ←
        </span>
        Home
      </Link>
    </div>
  );
}

function StepBar({
  onBack,
  step,
  total,
}: {
  onBack: () => void;
  step: number;
  total: number;
}) {
  return (
    <div
      style={{
        padding: '16px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: SS.ink,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: SS.sans,
        }}
      >
        ←
      </button>
      <SSDots step={step} total={total} />
      <div style={{ width: 22 }} />
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: string;
}) {
  return (
    <div style={{ padding: '28px 24px 8px' }}>
      <SSEyebrow style={{ color: SS.brand, marginBottom: 8 }}>{eyebrow}</SSEyebrow>
      <h1
        style={{
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: -1.4,
          lineHeight: 0.95,
          color: SS.ink,
          marginBottom: 10,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: SS.inkSoft,
          lineHeight: 1.4,
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        {lede}
      </p>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = 'text',
  maxLength,
  background = '#fff',
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  maxLength?: number;
  background?: string;
  mono?: boolean;
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
      <SSEyebrow style={{ marginBottom: 4 }}>{label}</SSEyebrow>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
          fontFamily: mono ? 'ui-monospace, "SF Mono", Menlo, monospace' : SS.sans,
          fontSize: 18,
          fontWeight: 800,
          color: SS.ink,
          letterSpacing: mono ? 1 : 0,
        }}
      />
    </label>
  );
}

function FooterBar({ children }: { children: ReactNode }) {
  return <div style={{ background: '#fff', padding: '8px 24px 28px' }}>{children}</div>;
}

function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: SS.brand,
        border: `2px solid ${SS.ink}`,
        borderRadius: 14,
        padding: 14,
        color: '#fff',
        marginTop: 14,
        fontFamily: SS.sans,
        fontSize: 14,
        fontWeight: 900,
        boxShadow: `0 4px 0 ${SS.ink}`,
      }}
    >
      {children}
    </div>
  );
}

const stepBtnStyle = (filled: boolean) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: filled ? SS.ink : '#fff',
  color: filled ? '#fff' : SS.ink,
  border: `2px solid ${SS.ink}`,
  fontFamily: SS.sans,
  fontWeight: 900,
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
