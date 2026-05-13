'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import {
  SSOP,
  SSOpCard,
  SSOpError,
  SSOpPillButton,
} from '@/components/operator/SSOp';

type Step = 'scan' | 'submitting' | 'done';

export function DeliverClient({ bagOrderId }: { bagOrderId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ sheetId: string; bagCount: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!cameraOn || step !== 'scan') return;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            void submit(code.data.trim());
            return;
          }
        }
      }
      if (!cancelled) rafId = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        rafId = requestAnimationFrame(tick);
      })
      .catch((err) =>
        setError(`Camera unavailable: ${err instanceof Error ? err.message : 'unknown'}`),
      );

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, step]);

  async function submit(code: string) {
    setStep('submitting');
    setCameraOn(false);
    setError(null);
    try {
      const res = await fetch(`/api/bag-orders/${bagOrderId}/deliver`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scannedCode: code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'deliver_failed');
      }
      setSummary({
        sheetId: body.stickerSheetId,
        bagCount: Array.isArray(body.bagIds) ? body.bagIds.length : 10,
      });
      setStep('done');
      setTimeout(() => {
        router.replace('/operator');
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'deliver_failed');
      setStep('scan');
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    void submit(v);
  }

  if (step === 'done' && summary) {
    return (
      <div
        style={{
          background: SSOP.yellow,
          padding: '40px 20px',
          textAlign: 'center',
          borderBottom: `2px solid ${SSOP.ink}`,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: SSOP.brand,
            color: '#fff',
            border: `3px solid ${SSOP.ink}`,
            boxShadow: `0 6px 0 ${SSOP.ink}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            fontWeight: 900,
            transform: 'rotate(-6deg)',
          }}
        >
          ✓
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1.3,
            color: SSOP.ink,
            marginTop: 24,
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          {summary.bagCount} bags
          <br />
          <span style={{ color: SSOP.brand }}>issued.</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SSOP.ink, opacity: 0.75, marginTop: 10 }}>
          Returning to route…
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: SSOP.mint, padding: '20px 20px 14px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SSOP.ink,
            opacity: 0.7,
            marginBottom: 6,
          }}
        >
          How this works
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SSOP.ink, lineHeight: 1.4 }}>
          Scan <strong>one sticker</strong> (ends in{' '}
          <code style={{ fontFamily: SSOP.mono }}>-01</code>) from the sheet you&rsquo;re
          handing over. The app claims all 10 for the resident.
        </div>
      </div>

      <div style={{ background: '#fff', padding: '18px 20px' }}>
        <SSOpCard pad={0} style={{ overflow: 'hidden' }}>
          <div
            style={{
              position: 'relative',
              aspectRatio: '4/3',
              background: SSOP.ink,
              overflow: 'hidden',
            }}
          >
            {cameraOn ? (
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCameraOn(true);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: SSOP.sans,
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: -0.2,
                }}
              >
                Tap to scan first sticker
              </button>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </SSOpCard>

        <div style={{ marginTop: 14 }}>
          <SSOpPillButton
            variant="brand"
            size="lg"
            leftIcon={<span>📷</span>}
            onClick={() => {
              setError(null);
              setCameraOn(true);
            }}
            disabled={cameraOn || step === 'submitting'}
          >
            {cameraOn ? 'Scanning…' : step === 'submitting' ? 'Claiming…' : 'Tap to scan'}
          </SSOpPillButton>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '18px 0 12px',
          }}
        >
          <div style={{ flex: 1, height: 2, background: SSOP.line }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: SSOP.inkSoft,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            or type the code
          </span>
          <div style={{ flex: 1, height: 2, background: SSOP.line }} />
        </div>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="BAG-xxxx-01"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: '#fff',
              border: `2px solid ${SSOP.ink}`,
              borderRadius: 999,
              fontFamily: SSOP.mono,
              fontSize: 15,
              color: SSOP.ink,
              outline: 'none',
              boxShadow: `0 3px 0 ${SSOP.ink}`,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={!manual.trim() || step === 'submitting'}
            style={{
              padding: '14px 22px',
              background: SSOP.ink,
              color: '#fff',
              border: `2px solid ${SSOP.ink}`,
              borderRadius: 999,
              fontFamily: SSOP.sans,
              fontSize: 14,
              fontWeight: 900,
              boxShadow: `0 3px 0 ${SSOP.ink}`,
              cursor: manual.trim() ? 'pointer' : 'not-allowed',
              opacity: manual.trim() && step !== 'submitting' ? 1 : 0.4,
            }}
          >
            Use
          </button>
        </form>
      </div>

      {error && <SSOpError>{friendlyError(error)}</SSOpError>}
    </>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'invalid_sticker':
      return 'That code doesn’t look like a sticker. Expected: BAG-xxxx-01 (must end in -01).';
    case 'sheet_already_issued':
      return 'This sheet has already been claimed by another resident. Grab a fresh sheet.';
    case 'already_delivered':
      return 'This order is already marked delivered.';
    default:
      return code;
  }
}
