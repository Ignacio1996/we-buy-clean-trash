'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import {
  OP_TOK,
  OpEyebrow,
  OpPaper,
  OpPrimaryButton,
  OpRow,
  StepDots,
  ToggleRow,
} from '@/components/operator/Op';
import { IconArrow, IconCheck, IconScan } from '@/components/icons/EcoIcons';

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
}: {
  pickupId: string;
  expectedCode: string;
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
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('review');
    }
  }

  if (step === 'done') {
    return (
      <section className="mt-6">
        <OpPaper
          style={{
            background: OP_TOK.greenSoft,
            border: `1px solid ${OP_TOK.green}`,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div
            className="inline-flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: OP_TOK.green,
              color: OP_TOK.paper,
              marginBottom: 12,
            }}
          >
            <IconCheck size={28} color={OP_TOK.paper} stroke={2} />
          </div>
          <div
            style={{
              fontFamily: OP_TOK.serif,
              fontSize: 22,
              color: OP_TOK.green,
              letterSpacing: -0.3,
            }}
          >
            Pickup confirmed.
          </div>
          <div
            className="mt-1.5 italic"
            style={{
              fontFamily: OP_TOK.serif,
              fontSize: 12,
              color: OP_TOK.green,
              opacity: 0.85,
            }}
          >
            Loading next stop…
          </div>
        </OpPaper>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <StepDots step={step} />

      {/* Expected bag */}
      <OpPaper className="flex items-center justify-between gap-3">
        <div>
          <OpEyebrow>Expected bag</OpEyebrow>
          <div
            className="mt-1.5"
            style={{
              fontFamily: OP_TOK.mono,
              fontSize: 18,
              color: OP_TOK.ink,
              letterSpacing: 0.4,
            }}
          >
            {expectedCode || '—'}
          </div>
        </div>
        {scannedCode && step !== 'scan' && (
          <button
            type="button"
            onClick={() => {
              setStep('scan');
              setScannedCode('');
              setPhoto(null);
            }}
            className="cursor-pointer p-0 italic underline"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: OP_TOK.serif,
              fontSize: 12,
              color: OP_TOK.green,
              textDecorationColor: OP_TOK.line,
            }}
          >
            Rescan
          </button>
        )}
      </OpPaper>

      {step === 'scan' && (
        <OpPaper style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              aspectRatio: '4/3',
              background: '#1F2A22',
              position: 'relative',
            }}
          >
            {cameraOn ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCameraOn(true);
                }}
                className="flex h-full w-full cursor-pointer items-center justify-center"
                style={{ background: 'transparent', border: 'none' }}
              >
                <ScanReticule />
              </button>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <div
              className="absolute right-0 bottom-3 left-0 text-center italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {cameraOn ? 'Center the QR sticker.' : 'Tap to scan.'}
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <OpPrimaryButton
              onClick={() => {
                setError(null);
                setCameraOn(true);
              }}
              disabled={cameraOn}
            >
              <IconScan size={18} color={OP_TOK.paper} stroke={1.75} />
              {cameraOn ? 'Scanning…' : 'Tap to scan'}
            </OpPrimaryButton>
            <div className="mt-3.5 flex items-center gap-2">
              <div style={{ flex: 1, height: 1, background: OP_TOK.lineSoft }} />
              <span
                className="italic"
                style={{
                  fontFamily: OP_TOK.serif,
                  fontSize: 11,
                  color: OP_TOK.inkSoft,
                }}
              >
                or type the code
              </span>
              <div style={{ flex: 1, height: 1, background: OP_TOK.lineSoft }} />
            </div>
            <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Printed number"
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  border: `1px solid ${OP_TOK.line}`,
                  borderRadius: 10,
                  fontFamily: OP_TOK.mono,
                  fontSize: 14,
                  background: OP_TOK.paper,
                  color: OP_TOK.ink,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!manual.trim()}
                className="cursor-pointer disabled:opacity-50"
                style={{
                  padding: '12px 18px',
                  background: manual.trim() ? OP_TOK.ink : OP_TOK.lineSoft,
                  color: manual.trim() ? OP_TOK.paper : OP_TOK.inkFaint,
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: OP_TOK.serif,
                  fontSize: 14,
                }}
              >
                Use
              </button>
            </form>
          </div>
        </OpPaper>
      )}

      {step === 'condition' && (
        <>
          <OpPaper>
            <OpEyebrow>Condition check</OpEyebrow>
            <div className="mt-2">
              <ToggleRow label="Bag sealed properly" value={sealed} onChange={setSealed} />
              <ToggleRow
                label="Visible contamination"
                value={contamination}
                onChange={setContamination}
                tone="rust"
              />
            </div>
            <p
              className="mt-3.5 italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 12,
                color: OP_TOK.inkSoft,
                lineHeight: 1.5,
              }}
            >
              {contamination
                ? 'We’ll log this and the depot will sort it out at intake. The pickup still counts.'
                : 'We’ll log these notes against the bag for the depot.'}
            </p>
          </OpPaper>
          <OpPrimaryButton onClick={() => setStep('photo')}>
            Continue
            <IconArrow size={16} color={OP_TOK.paper} />
          </OpPrimaryButton>
        </>
      )}

      {step === 'photo' && (
        <>
          <OpPaper>
            <div className="flex items-center justify-between">
              <OpEyebrow>Doorstep photo</OpEyebrow>
              {STORAGE_MOCKED && (
                <span
                  style={{
                    background: OP_TOK.amberSoft,
                    color: OP_TOK.amber,
                    fontFamily: OP_TOK.sans,
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  Demo mode
                </span>
              )}
            </div>
            <p
              className="mt-1 italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 12,
                color: OP_TOK.inkSoft,
              }}
            >
              Proof of pickup. Saved with the route record.
            </p>
            {photo ? (
              <div className="mt-3.5">
                <div
                  style={{
                    aspectRatio: '4/3',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="cursor-pointer p-0 italic underline"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontFamily: OP_TOK.serif,
                      fontSize: 12,
                      color: OP_TOK.inkSoft,
                      textDecorationColor: OP_TOK.line,
                    }}
                  >
                    Retake
                  </button>
                </div>
              </div>
            ) : (
              <label
                className="mt-3.5 flex w-full cursor-pointer flex-col items-center justify-center gap-2.5"
                style={{
                  aspectRatio: '4/3',
                  background: OP_TOK.paperTint,
                  border: `1px dashed ${OP_TOK.line}`,
                  borderRadius: 12,
                  color: OP_TOK.inkSoft,
                }}
              >
                <IconScan size={32} stroke={1.5} />
                <span
                  className="italic"
                  style={{ fontFamily: OP_TOK.serif, fontSize: 14 }}
                >
                  Tap to take photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  className="hidden"
                />
              </label>
            )}
          </OpPaper>
          <OpPrimaryButton onClick={() => setStep('review')} disabled={!photo}>
            Continue
            <IconArrow size={16} color={OP_TOK.paper} />
          </OpPrimaryButton>
        </>
      )}

      {(step === 'review' || step === 'submitting') && (
        <>
          <OpPaper>
            <OpEyebrow>Review &amp; submit</OpEyebrow>
            <div className="mt-3">
              <OpRow
                label="Sealed"
                value={sealed ? 'Yes' : 'No'}
                onEdit={() => setStep('condition')}
              />
              <OpRow
                label="Contamination"
                value={contamination ? 'Flagged' : 'None'}
                valueTone={contamination ? 'rust' : 'ink'}
                onEdit={() => setStep('condition')}
              />
              <OpRow
                label="Photo"
                value={photo ? 'Captured' : '—'}
                onEdit={() => setStep('photo')}
              />
            </div>
          </OpPaper>
          <OpPrimaryButton onClick={handleConfirm} disabled={!photo || step === 'submitting'}>
            <IconCheck size={18} color={OP_TOK.paper} stroke={2} />
            {step === 'submitting' ? 'Submitting…' : 'Confirm pickup'}
          </OpPrimaryButton>
        </>
      )}

      {error && (
        <p
          style={{
            background: OP_TOK.rustSoft,
            border: `1px solid ${OP_TOK.rust}`,
            color: OP_TOK.rust,
            borderRadius: 10,
            padding: '8px 12px',
            fontFamily: OP_TOK.serif,
            fontSize: 12,
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}

function ScanReticule() {
  type Corner = {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    borderTop?: boolean;
    borderLeft?: boolean;
    borderRight?: boolean;
    borderBottom?: boolean;
  };
  const corners: Corner[] = [
    { top: 0, left: 0, borderTop: true, borderLeft: true },
    { top: 0, right: 0, borderTop: true, borderRight: true },
    { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
    { bottom: 0, right: 0, borderBottom: true, borderRight: true },
  ];
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 28,
            height: 28,
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            borderTop: c.borderTop ? `2px solid ${OP_TOK.paper}` : undefined,
            borderLeft: c.borderLeft ? `2px solid ${OP_TOK.paper}` : undefined,
            borderRight: c.borderRight ? `2px solid ${OP_TOK.paper}` : undefined,
            borderBottom: c.borderBottom ? `2px solid ${OP_TOK.paper}` : undefined,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: '50%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${OP_TOK.green}, transparent)`,
          opacity: 0.7,
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
