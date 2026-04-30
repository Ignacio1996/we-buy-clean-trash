'use client';

import {
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFreshIdToken, signupWithEmail } from '@/lib/auth/client';
import { PresignupScanBanner } from '@/components/PresignupScanBanner';
import {
  IconArrow,
  IconArrowLeft,
  IconCheck,
} from '@/components/icons/EcoIcons';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  calculateBagOrderTotal,
} from '@/lib/logic/calculateBagOrderTotal';

type Step =
  | 'splash'
  | 'address'
  | 'how'
  | 'account'
  | 'password'
  | 'first';

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
  const total = FLOW.length;

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

  const accountValid =
    name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email.trim());

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
    <div style={shellStyle}>
      <Grain />

      {step !== 'splash' && (
        <TopBar idx={idx} total={total} onBack={goBack} />
      )}

      <div style={contentStyle}>
        {step === 'splash' && <SplashStep onNext={() => go('address')} />}
        {step === 'address' && (
          <AddressStep
            address={address}
            onChange={setAddress}
            onNext={() => go('how')}
            valid={addressValid}
          />
        )}
        {step === 'how' && <HowStep onNext={() => go('account')} />}
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
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Splash ──────────────────────────────────────────────
function SplashStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ paddingTop: 28, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 28 }}>
        <div
          style={{
            fontFamily: 'var(--eco-mono, ui-monospace, monospace)',
            fontSize: 9,
            color: 'var(--ink-soft)',
            letterSpacing: 2,
          }}
        >
          VOL. I · NO. 01
        </div>
      </div>

      <div
        className="italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 22,
          color: 'var(--green)',
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        We Buy
        <br />
        Clean Trash
      </div>

      <h1
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 38,
          lineHeight: 1.05,
          fontWeight: 400,
          letterSpacing: -0.8,
          marginBottom: 18,
          color: 'var(--ink)',
        }}
      >
        Turn what you
        <br />
        throw away
        <br />
        into <em style={{ color: 'var(--green)' }}>cash</em>.
      </h1>

      <p
        className="italic"
        style={{
          fontSize: 13,
          color: 'var(--ink-soft)',
          lineHeight: 1.5,
          fontFamily: 'var(--eco-serif)',
          marginBottom: 22,
        }}
      >
        Fill our bags with cleaned bottles, cans and paper. We pick them up. Points
        become gift cards.
      </p>

      <div className="mb-6">
        <PresignupScanBanner />
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginBottom: 28 }}>
        {[
          ['Avg. earnings', '$5–$12 / pickup'],
          ['Pickup cadence', 'Weekly · curbside'],
          ['Materials', '7 commodities'],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '11px 0',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            <span style={eyebrowStyle}>{label}</span>
            <span
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 14,
                color: 'var(--ink)',
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <PrimaryButton onClick={onNext}>Get started</PrimaryButton>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)', marginTop: 14 }}>
        Already a member?{' '}
        <Link href="/login" style={{ color: 'var(--green)', fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Step 2: Address ─────────────────────────────────────────────
function AddressStep({
  address,
  onChange,
  onNext,
  valid,
}: {
  address: AddressForm;
  onChange: (a: AddressForm) => void;
  onNext: () => void;
  valid: boolean;
}) {
  function update<K extends keyof AddressForm>(key: K, value: string) {
    onChange({ ...address, [key]: key === 'state' ? value.toUpperCase() : value });
  }
  return (
    <div>
      <StepHeading
        eyebrow="Step one · Service area"
        title={
          <>
            Where shall we <em style={{ color: 'var(--green)' }}>collect</em>?
          </>
        }
        lede="We need a curbside address. Service runs in select neighborhoods."
      />

      <div style={{ borderTop: '1px solid var(--line)', marginBottom: 14 }}>
        <FormInput
          label="Street"
          value={address.street}
          onChange={(v) => update('street', v)}
          placeholder="312 Almanac Way"
          autoComplete="address-line1"
        />
        <FormInput
          label="Apt / Unit"
          value={address.unit}
          onChange={(v) => update('unit', v)}
          placeholder="Optional"
          autoComplete="address-line2"
        />
        <FormInput
          label="City"
          value={address.city}
          onChange={(v) => update('city', v)}
          placeholder="Portland"
          autoComplete="address-level2"
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FormInput
              label="State"
              value={address.state}
              onChange={(v) => update('state', v)}
              placeholder="OR"
              maxLength={2}
              autoComplete="address-level1"
            />
          </div>
          <div style={{ flex: 1 }}>
            <FormInput
              label="ZIP"
              value={address.postalCode}
              onChange={(v) => update('postalCode', v)}
              placeholder="97214"
              autoComplete="postal-code"
              mono
            />
          </div>
        </div>
      </div>

      {valid && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            background: 'var(--green-soft)',
            border: '1px solid rgba(45,90,61,0.2)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 18,
          }}
        >
          <IconCheck size={18} color="var(--green)" stroke={2} />
          <div>
            <div style={{ fontFamily: 'var(--eco-serif)', fontSize: 14, color: 'var(--green)' }}>
              You&rsquo;re in service.
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              We&rsquo;ll confirm your pickup day after sign-up.
            </div>
          </div>
        </div>
      )}

      <PrimaryButton onClick={onNext} disabled={!valid}>
        Continue
      </PrimaryButton>
    </div>
  );
}

// ─── Step 3: How it works ────────────────────────────────────────
function HowStep({ onNext }: { onNext: () => void }) {
  const steps = [
    { n: 'I', title: 'Order bags', body: 'Reusable, labeled by material. Free shipping over $20.' },
    { n: 'II', title: 'Fill clean', body: 'Rinse what goes in. Caps off bottles. No glass shards.' },
    { n: 'III', title: 'Set out by 5:30', body: 'On your pickup day. We weigh, sort, and credit points.' },
    { n: 'IV', title: 'Redeem', body: 'Cash out for gift cards once you reach $10.' },
  ];
  return (
    <div>
      <StepHeading
        eyebrow="Step two · A short almanac"
        title={
          <>
            How <em style={{ color: 'var(--green)' }}>it works</em>.
          </>
        }
        lede="Four simple things. Read once, do weekly."
      />

      <div style={{ borderTop: '1px solid var(--line)' }}>
        {steps.map((s) => (
          <div
            key={s.n}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              borderBottom: '1px solid var(--line-soft)',
              alignItems: 'flex-start',
            }}
          >
            <div
              className="italic"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 18,
                color: 'var(--green)',
                width: 28,
                flexShrink: 0,
                paddingTop: 1,
              }}
            >
              {s.n}.
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--eco-serif)',
                  fontSize: 16,
                  color: 'var(--ink)',
                  marginBottom: 2,
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {s.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
      </div>
    </div>
  );
}

// ─── Step 4: Account ─────────────────────────────────────────────
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
}) {
  const options: Array<{ k: NotifyPref; label: string }> = [
    { k: 'sms', label: 'SMS' },
    { k: 'email', label: 'Email' },
    { k: 'both', label: 'Both' },
  ];
  return (
    <div>
      <StepHeading
        eyebrow="Step three · Your account"
        title={
          <>
            A name to <em style={{ color: 'var(--green)' }}>credit</em>.
          </>
        }
        lede="We'll use this on your account and pickup roster."
      />

      <div style={{ borderTop: '1px solid var(--line)', marginBottom: 18 }}>
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
          label="Phone"
          value={phone}
          onChange={onPhone}
          placeholder="(503) 555-0117"
          type="tel"
          autoComplete="tel"
          mono
        />
      </div>

      <div style={{ ...eyebrowStyle, marginBottom: 8 }}>Pickup reminders</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {options.map(({ k, label }) => {
          const active = notify === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onNotify(k)}
              style={{
                flex: 1,
                padding: '10px 0',
                textAlign: 'center',
                border: `1px solid ${active ? 'var(--green)' : 'var(--line)'}`,
                background: active ? 'var(--green-soft)' : 'var(--paper)',
                color: active ? 'var(--green)' : 'var(--ink)',
                borderRadius: 10,
                fontFamily: 'var(--eco-serif)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p
        className="italic"
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
          lineHeight: 1.5,
          marginBottom: 14,
          fontFamily: 'var(--eco-serif)',
        }}
      >
        By continuing you agree to our terms and a privacy policy that fits on a postcard.
      </p>

      <PrimaryButton onClick={onNext} disabled={!valid}>
        Create account
      </PrimaryButton>
    </div>
  );
}

// ─── Step 5: Password ────────────────────────────────────────────
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
    <div>
      <StepHeading
        eyebrow="Step four · A password"
        title={
          <>
            Set a <em style={{ color: 'var(--green)' }}>password</em>.
          </>
        }
        lede="Used only to sign back in. Choose a phrase, not a puzzle."
      />

      <div style={{ borderTop: '1px solid var(--line)', marginBottom: 14 }}>
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
      </div>

      <div style={{ marginBottom: 22 }}>
        {rules.map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `1px solid ${r.ok ? 'var(--green)' : 'var(--line)'}`,
                background: r.ok ? 'var(--green)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {r.ok && <IconCheck size={10} color="var(--paper)" stroke={2.5} />}
            </div>
            <span
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 13,
                color: r.ok ? 'var(--ink)' : 'var(--ink-soft)',
                fontStyle: r.ok ? 'normal' : 'italic',
              }}
            >
              {r.label}
            </span>
          </div>
        ))}
      </div>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <PrimaryButton onClick={onNext} disabled={!allOk || busy}>
        {busy ? 'Creating account…' : 'Continue'}
      </PrimaryButton>
    </div>
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
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ ...eyebrowStyle, flexShrink: 0 }}>{label}</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily:
              value && show ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'var(--eco-serif)',
            fontSize: value && show ? 13 : value ? 16 : 14,
            color: value ? 'var(--ink)' : 'var(--ink-faint)',
            fontStyle: value ? 'normal' : 'italic',
            textAlign: 'right',
            padding: 0,
            minWidth: 0,
            flex: 1,
            letterSpacing: value && !show ? 1 : 0,
          }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 2,
              fontSize: 10,
              color: 'var(--green)',
              textTransform: 'uppercase',
              letterSpacing: 1.4,
              fontWeight: 600,
            }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 6: First bag order ─────────────────────────────────────
function FirstBagStep({
  qty,
  onQty,
  onPlace,
  onSkip,
  busy,
  error,
}: {
  qty: number;
  onQty: (v: number) => void;
  onPlace: () => void;
  onSkip: () => void;
  busy: boolean;
  error: string | null;
}) {
  const breakdown = useMemo(
    () => calculateBagOrderTotal({ quantity: qty, unitPrice: BAG_SHEET_UNIT_PRICE_DOLLARS }),
    [qty],
  );
  return (
    <div>
      <StepHeading
        eyebrow="Step five · First batch"
        title={
          <>
            Order your <em style={{ color: 'var(--green)' }}>first sheet</em>.
          </>
        }
        lede={`Ten reusable bags per sheet. Free shipping over $${FREE_SHIPPING_THRESHOLD}.`}
      />

      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: 'var(--eco-serif)', fontSize: 16, color: 'var(--ink)' }}>
              Bag sheets
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              10 bags · ${BAG_SHEET_UNIT_PRICE_DOLLARS.toFixed(2)} / sheet
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={() => onQty(Math.max(1, qty - 1))}
              disabled={busy || qty <= 1}
              style={stepperStyle}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 22,
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onQty(Math.min(20, qty + 1))}
              disabled={busy || qty >= 20}
              style={stepperStyle}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <Ledger label="Subtotal" value={`$${breakdown.subtotal.toFixed(2)}`} />
        <Ledger
          label="Shipping"
          value={breakdown.freeShipping ? 'Free' : `$${SHIPPING_FEE.toFixed(2)}`}
          italic={breakdown.freeShipping}
        />
        <Ledger label="Estimated arrival" value="3–5 days" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '14px 0 4px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <span
            className="italic"
            style={{ fontFamily: 'var(--eco-serif)', fontSize: 14, color: 'var(--ink)' }}
          >
            Total
          </span>
          <span
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 24,
              color: 'var(--green)',
            }}
          >
            ${breakdown.total.toFixed(2)}
          </span>
        </div>
        {!breakdown.freeShipping && (
          <p
            className="italic"
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 12,
              color: 'var(--ink-soft)',
              marginTop: 8,
            }}
          >
            Add ${(FREE_SHIPPING_THRESHOLD - breakdown.subtotal).toFixed(2)} more to unlock free
            shipping.
          </p>
        )}
      </div>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <PrimaryButton onClick={onPlace} disabled={busy}>
        {busy ? 'Placing order…' : 'Place order'}
      </PrimaryButton>
      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          width: '100%',
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: 'var(--ink)',
          marginTop: 10,
          fontFamily: 'var(--eco-sans)',
          cursor: busy ? 'default' : 'pointer',
          padding: '14px 18px',
        }}
      >
        Skip — I&rsquo;ll order later
      </button>
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────
function TopBar({
  idx,
  total,
  onBack,
}: {
  idx: number;
  total: number;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        padding: '20px 20px 12px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: 'var(--ink-soft)',
        }}
      >
        <IconArrowLeft size={14} color="var(--ink-soft)" />
        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-soft)',
            textTransform: 'uppercase',
            letterSpacing: 1.4,
          }}
        >
          Back
        </span>
      </button>
      <div
        className="italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 13,
          color: 'var(--green)',
        }}
      >
        We Buy Clean Trash
      </div>
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 10,
          color: 'var(--ink-soft)',
          letterSpacing: 1,
        }}
      >
        {String(idx).padStart(2, '0')} / {String(total - 1).padStart(2, '0')}
      </div>
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
    <>
      <div style={{ ...eyebrowStyle, marginBottom: 8 }}>{eyebrow}</div>
      <h1
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 28,
          lineHeight: 1.1,
          fontWeight: 400,
          letterSpacing: -0.5,
          marginBottom: 8,
          color: 'var(--ink)',
        }}
      >
        {title}
      </h1>
      <p
        className="italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 13,
          color: 'var(--ink-soft)',
          lineHeight: 1.5,
          marginBottom: 22,
        }}
      >
        {lede}
      </p>
    </>
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
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  maxLength?: number;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ ...eyebrowStyle, flexShrink: 0 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: mono
            ? 'ui-monospace, "SF Mono", Menlo, monospace'
            : 'var(--eco-serif)',
          fontSize: mono ? 13 : 15,
          color: value ? 'var(--ink)' : 'var(--ink-faint)',
          fontStyle: value ? 'normal' : 'italic',
          textAlign: 'right',
          padding: 0,
          flex: 1,
          minWidth: 0,
        }}
      />
    </div>
  );
}

function Ledger({
  label,
  value,
  italic,
}: {
  label: string;
  value: string;
  italic?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <span style={eyebrowStyle}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 14,
          color: 'var(--ink)',
          fontStyle: italic ? 'italic' : 'normal',
        }}
      >
        {value}
      </span>
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
        transition: 'background 120ms ease',
      }}
    >
      <span>{children}</span>
      <IconArrow size={16} color={disabled ? 'var(--ink-faint)' : 'var(--paper)'} />
    </button>
  );
}

function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#F0DCC8',
        border: '1px solid rgba(154,75,38,0.3)',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 14,
        fontSize: 12,
        color: '#9A4B26',
        fontFamily: 'var(--eco-sans)',
      }}
    >
      {children}
    </div>
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

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: 1.4,
  fontWeight: 500,
  fontFamily: 'var(--eco-sans)',
};

const shellStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: 'var(--paper-bg)',
  color: 'var(--ink)',
  fontFamily: 'var(--eco-sans)',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const contentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  flex: 1,
  padding: '24px 22px 28px',
  maxWidth: 480,
  margin: '0 auto',
  width: '100%',
};

const stepperStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontSize: 16,
  cursor: 'pointer',
  fontFamily: 'serif',
};
