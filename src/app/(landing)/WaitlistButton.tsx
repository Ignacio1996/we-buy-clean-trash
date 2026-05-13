'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function WaitlistButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function closeModal() {
    setOpen(false);
    if (state === 'success') {
      setName('');
      setEmail('');
      setPostalCode('');
      setState('idle');
      setErrorMsg(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => nameInputRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          postalCode: postalCode.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = body?.error as string | undefined;
        throw new Error(
          code === 'invalid_payload'
            ? 'Double-check your name, email, and 5-digit zip.'
            : 'Something went wrong — try again in a moment.',
        );
      }
      setAlreadyOnList(Boolean(body?.alreadyOnList));
      setState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? styles.pilotCta}
      >
        {label} <span className={styles.arrow}>→</span>
      </button>

      {open && (
        <div
          className={styles.waitlistOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="waitlist-title"
        >
          <div className={styles.waitlistModal}>
            <button
              type="button"
              className={styles.waitlistClose}
              onClick={closeModal}
              aria-label="Close"
            >
              ×
            </button>

            {state === 'success' ? (
              <div className={styles.waitlistSuccess}>
                <div className={styles.waitlistTag}>You&apos;re on the list</div>
                <h3 id="waitlist-title">
                  {alreadyOnList ? 'Welcome back.' : "We'll be in touch."}
                </h3>
                <p>
                  {alreadyOnList
                    ? "You're already on the waitlist — we updated your details. We'll reach out as the Oakland pilot opens up."
                    : 'Thanks — we logged your spot. When the Oakland pilot opens up, you’ll be among the first 200 households we email.'}
                </p>
                <button
                  type="button"
                  className={styles.waitlistSubmit}
                  onClick={closeModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.waitlistForm}>
                <div className={styles.waitlistTag}>Pilot waitlist</div>
                <h3 id="waitlist-title">Join the waitlist.</h3>
                <p className={styles.waitlistLede}>
                  Oakland, summer 2026. We&apos;ll email you a few weeks before pickups start —
                  zero spam, just one note when it&apos;s your turn.
                </p>

                <label className={styles.waitlistField}>
                  <span>Name</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                </label>

                <label className={styles.waitlistField}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={200}
                    required
                  />
                </label>

                <label className={styles.waitlistField}>
                  <span>Zip code</span>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="94607"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    pattern="\d{5}(-\d{4})?"
                    maxLength={10}
                    required
                  />
                </label>

                {errorMsg && <div className={styles.waitlistError}>{errorMsg}</div>}

                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className={styles.waitlistSubmit}
                >
                  {state === 'submitting' ? 'Adding you…' : 'Join the waitlist'}
                </button>

                <p className={styles.waitlistFinePrint}>
                  We&apos;ll only use your info to invite you into the pilot. No newsletters, no
                  list sales. You can ask us to delete it anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
