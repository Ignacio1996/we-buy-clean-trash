'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import {
  SSOP,
  SSOpBadge,
  SSOpCard,
  SSOpError,
  SSOpEyebrow,
  SSOpPillButton,
  SSOpReviewRow,
  SSOpSteps,
  SSOpToggle,
} from '@/components/operator/SSOp';

const MAX_PHOTO_EDGE = 1024;
const STORAGE_MOCKED =
  (process.env.NEXT_PUBLIC_STORAGE_MODE ?? 'mock').toLowerCase() !== 'firebase';

type Step = 'scan' | 'condition' | 'photo' | 'review' | 'submitting' | 'done';

function resizeToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas_unavailable'));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1] ?? '';
        resolve({ base64, mime: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('image_load_failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

export function ScanConfirmClient({
  pickupId,
  expectedCode,
  declaredType,
}: {
  pickupId: string;
  expectedCode: string;
  declaredType: 'separated' | 'mixed' | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [cameraOn, setCameraOn] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [manual, setManual] = useState('');
  const [sealed, setSealed] = useState(true);
  const [contamination, setContamination] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string; mime: string; previewUrl: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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
            handleScanned(code.data.trim());
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

  function handleScanned(code: string) {
    if (!codeMatches(code, expectedCode)) {
      setError(`Scanned ${code}, expected ${expectedCode}. Double-check the bag.`);
      return;
    }
    setScannedCode(code);
    setCameraOn(false);
    setStep('condition');
    setError(null);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    handleScanned(v);
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { base64, mime } = await resizeToBase64(file);
      setPhoto({ base64, mime, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'photo_failed');
    }
  }

  async function handleConfirm() {
    if (!photo) return;
    setStep('submitting');
    setError(null);
    try {
      const res = await fetch(`/api/pickups/${pickupId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sealed,
          contaminationObserved: contamination,
          photoBase64: photo.base64,
          photoMime: photo.mime,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'submit_failed');
      setStep('done');
      setTimeout(() => {
        router.replace('/operator');
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('review');
    }
  }

  if (step === 'done') {
    return (
      <>
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
            {scannedCode || expectedCode}
            <br />
            <span style={{ color: SSOP.brand }}>logged.</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: SSOP.ink, opacity: 0.75, marginTop: 10 }}>
            Resident texted · loading next stop…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Step strip — sky */}
      <div style={{ background: SSOP.sky, padding: '20px 20px 14px' }}>
        <SSOpSteps step={step} />
      </div>

      {/* Expected bag — white */}
      <div style={{ background: '#fff', padding: '18px 20px 8px' }}>
        <SSOpCard pad={0}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: step === 'scan' ? `1px solid ${SSOP.line}` : 'none',
            }}
          >
            <div>
              <SSOpEyebrow mb={4}>Expected bag</SSOpEyebrow>
              <div
                style={{
                  fontFamily: SSOP.mono,
                  fontSize: 19,
                  fontWeight: 800,
                  color: SSOP.ink,
                  letterSpacing: 0.6,
                }}
              >
                {expectedCode || '—'}
              </div>
            </div>
            {declaredType === 'separated' ? (
              <SSOpBadge bg={SSOP.mint}>Separated</SSOpBadge>
            ) : declaredType === 'mixed' ? (
              <SSOpBadge bg={SSOP.yellow}>Mixed</SSOpBadge>
            ) : null}
          </div>

          {step === 'scan' && (
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
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
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
                  }}
                  aria-label="Start scan"
                >
                  <ScanReticule />
                </button>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  background: SSOP.yellow,
                  border: `2px solid ${SSOP.ink}`,
                  color: SSOP.ink,
                  borderRadius: 999,
                  padding: '5px 12px',
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  boxShadow: `0 2px 0 ${SSOP.ink}`,
                }}
              >
                {cameraOn ? '● Scanning' : 'Tap to scan'}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: 0.3,
                }}
              >
                Center the QR sticker.
              </div>
            </div>
          )}
        </SSOpCard>

        {scannedCode && step !== 'scan' && (
          <button
            type="button"
            onClick={() => {
              setStep('scan');
              setScannedCode('');
              setPhoto(null);
            }}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: 'none',
              color: SSOP.brand,
              fontFamily: SSOP.sans,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ← Rescan
          </button>
        )}

        {step === 'scan' && (
          <div style={{ marginTop: 14 }}>
            <SSOpPillButton
              variant="brand"
              size="lg"
              leftIcon={<span>📷</span>}
              onClick={() => {
                setError(null);
                setCameraOn(true);
              }}
              disabled={cameraOn}
            >
              {cameraOn ? 'Scanning…' : 'Tap to scan'}
            </SSOpPillButton>

            {/* Manual entry */}
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
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="A24-_ _ _"
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
                disabled={!manual.trim()}
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
                  opacity: manual.trim() ? 1 : 0.4,
                }}
              >
                Use
              </button>
            </form>
          </div>
        )}
      </div>

      {step === 'condition' && (
        <>
          <div style={{ background: '#fff', padding: '8px 20px 20px' }}>
            <SSOpCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${SSOP.line}`,
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: SSOP.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    Bag sealed properly
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: SSOP.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    Twist-tie or knot present, no tears
                  </div>
                </div>
                <SSOpToggle on={sealed} onChange={setSealed} label="Sealed" />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0 4px',
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: SSOP.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    Visible contamination
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: SSOP.inkSoft,
                      marginTop: 2,
                    }}
                  >
                    Food, liquid, or non-recyclable items
                  </div>
                </div>
                <SSOpToggle
                  on={contamination}
                  onChange={setContamination}
                  label="Contamination"
                  danger
                />
              </div>
            </SSOpCard>

            <div
              style={{
                marginTop: 14,
                background: SSOP.mint,
                border: `2px solid ${SSOP.ink}`,
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: `0 4px 0 ${SSOP.ink}`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: SSOP.ink,
                  lineHeight: 1.5,
                }}
              >
                {contamination
                  ? 'We’ll log this and the depot will sort it out at intake. The pickup still counts.'
                  : 'We’ll log these notes against the bag for the depot.'}
              </div>
            </div>
          </div>

          <div style={{ background: SSOP.peach, padding: '20px 20px 28px' }}>
            <SSOpPillButton variant="brand" size="lg" onClick={() => setStep('photo')}>
              Continue
            </SSOpPillButton>
          </div>
        </>
      )}

      {step === 'photo' && (
        <>
          <div style={{ background: '#fff', padding: '8px 20px 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <SSOpEyebrow mb={0}>Proof of pickup</SSOpEyebrow>
              {STORAGE_MOCKED && <SSOpBadge bg={SSOP.amber} fg="#fff">Demo mode</SSOpBadge>}
            </div>

            <SSOpCard pad={0} style={{ overflow: 'hidden' }}>
              {photo ? (
                <div style={{ aspectRatio: '4/3', position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      background: SSOP.ink,
                      color: '#fff',
                      border: `2px solid ${SSOP.ink}`,
                      borderRadius: 999,
                      padding: '5px 12px',
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      boxShadow: `0 2px 0 ${SSOP.ink}`,
                    }}
                  >
                    ● Captured
                  </div>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    aspectRatio: '4/3',
                    background: SSOP.sky,
                    cursor: 'pointer',
                    color: SSOP.ink,
                  }}
                >
                  <span style={{ fontSize: 36, fontWeight: 900 }}>📷</span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: -0.2,
                    }}
                  >
                    Tap to take photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </SSOpCard>

            {photo && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  style={{
                    flex: 1,
                    background: '#fff',
                    border: `2px solid ${SSOP.ink}`,
                    color: SSOP.ink,
                    borderRadius: 999,
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: -0.2,
                    fontFamily: SSOP.sans,
                    boxShadow: `0 3px 0 ${SSOP.ink}`,
                    cursor: 'pointer',
                  }}
                >
                  ↻ Retake
                </button>
              </div>
            )}
          </div>

          <div style={{ background: SSOP.peach, padding: '20px 20px 28px' }}>
            <SSOpPillButton
              variant="brand"
              size="lg"
              onClick={() => setStep('review')}
              disabled={!photo}
            >
              Continue
            </SSOpPillButton>
          </div>
        </>
      )}

      {(step === 'review' || step === 'submitting') && (
        <>
          <div style={{ background: '#fff', padding: '8px 20px 20px' }}>
            <SSOpCard>
              <SSOpReviewRow label="Bag code" value={scannedCode || expectedCode} />
              {declaredType && (
                <SSOpReviewRow
                  label="Declared"
                  value={declaredType === 'separated' ? 'Separated' : 'Mixed'}
                  color={declaredType === 'separated' ? SSOP.green : SSOP.ink}
                />
              )}
              <SSOpReviewRow
                label="Sealed"
                value={sealed ? 'Yes' : 'No'}
                color={sealed ? SSOP.ink : SSOP.brand}
                onEdit={() => setStep('condition')}
              />
              <SSOpReviewRow
                label="Contamination"
                value={contamination ? 'Flagged' : 'None'}
                color={contamination ? SSOP.brand : SSOP.green}
                onEdit={() => setStep('condition')}
              />
              <SSOpReviewRow
                label="Photo"
                value={photo ? 'Captured' : '—'}
                onEdit={() => setStep('photo')}
                last
              />
            </SSOpCard>
          </div>

          <div style={{ background: SSOP.mint, padding: '20px 20px' }}>
            <div
              style={{
                background: '#fff',
                border: `2px solid ${SSOP.ink}`,
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: `0 4px 0 ${SSOP.ink}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: SSOP.green,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 900,
                  border: `2px solid ${SSOP.ink}`,
                }}
              >
                ✓
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: SSOP.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  Pickup will credit the resident
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: SSOP.inkSoft,
                    marginTop: 1,
                  }}
                >
                  Final amount confirmed at depot weigh-in
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: SSOP.peach, padding: '20px 20px 28px' }}>
            <SSOpPillButton
              variant="brand"
              size="lg"
              leftIcon={<span>✓</span>}
              onClick={handleConfirm}
              disabled={!photo || step === 'submitting'}
            >
              {step === 'submitting' ? 'Submitting…' : 'Confirm pickup'}
            </SSOpPillButton>
          </div>
        </>
      )}

      {error && <SSOpError>{error}</SSOpError>}
    </>
  );
}

function ScanReticule() {
  type Corner = {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    bT?: boolean;
    bL?: boolean;
    bR?: boolean;
    bB?: boolean;
  };
  const corners: Corner[] = [
    { top: 0, left: 0, bT: true, bL: true },
    { top: 0, right: 0, bT: true, bR: true },
    { bottom: 0, left: 0, bB: true, bL: true },
    { bottom: 0, right: 0, bB: true, bR: true },
  ];
  return (
    <div style={{ width: 200, height: 200, position: 'relative' }}>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 36,
            height: 36,
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            borderTop: c.bT ? `4px solid ${SSOP.yellow}` : undefined,
            borderLeft: c.bL ? `4px solid ${SSOP.yellow}` : undefined,
            borderRight: c.bR ? `4px solid ${SSOP.yellow}` : undefined,
            borderBottom: c.bB ? `4px solid ${SSOP.yellow}` : undefined,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: '50%',
          height: 2,
          background: SSOP.brand,
          boxShadow: `0 0 14px ${SSOP.brand}`,
        }}
      />
    </div>
  );
}

function codeMatches(scanned: string, expected: string): boolean {
  if (!expected) return false;
  const norm = (s: string) => s.trim().toUpperCase();
  return norm(scanned) === norm(expected);
}
