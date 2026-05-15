'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { DeclaredBagType } from '@/lib/types/bag';
import {
  SS,
  SSEyebrow,
  SSPillButton,
  SSStickerCard,
} from '@/components/resident/ss/SS';

type Step = 'scan' | 'manual' | 'choose_type' | 'photo' | 'submitting' | 'done' | 'error';

const MAX_PHOTO_EDGE = 1024;
const STORAGE_MOCKED =
  (process.env.NEXT_PUBLIC_STORAGE_MODE ?? 'mock').toLowerCase() !== 'firebase';

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

function CloseChip({ href = '/resident' }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Close"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: SS.ink,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 900,
        textDecoration: 'none',
      }}
    >
      ×
    </Link>
  );
}

function ScanHeader({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
        }}
      >
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7 }}>{eyebrow}</SSEyebrow>
        <CloseChip />
      </div>
      <div
        style={{
          padding: '0 20px',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.8,
          color: SS.ink,
          lineHeight: 1.05,
        }}
      >
        {title}
      </div>
    </>
  );
}

export function ScanBagClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [bagCode, setBagCode] = useState('');
  const [declaredType, setDeclaredType] = useState<DeclaredBagType | null>(null);
  const [photo, setPhoto] = useState<{ base64: string; mime: string; previewUrl: string } | null>(
    null,
  );
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!cameraOn || step !== 'scan') return;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
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
            setBagCode(code.data.trim());
            setStep('choose_type');
            setCameraOn(false);
            return;
          }
        }
      }
      if (!cancelled) rafId = requestAnimationFrame(scan);
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
        rafId = requestAnimationFrame(scan);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStep('error');
        setCameraOn(false);
      });

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, step]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code) return;
    setBagCode(code);
    setStep('choose_type');
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { base64, mime } = await resizeToBase64(file);
      setPhoto({ base64, mime, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'photo_failed');
    }
  }

  async function submit() {
    if (!bagCode || !declaredType || !photo) return;
    setStep('submitting');
    setError(null);
    try {
      const res = await fetch('/api/pickups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bagCode,
          declaredType,
          photoBase64: photo.base64,
          photoMime: photo.mime,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'submit_failed');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('error');
    }
  }

  function reset() {
    setBagCode('');
    setDeclaredType(null);
    setPhoto(null);
    setManualInput('');
    setError(null);
    setStep('scan');
  }

  // ---- DONE ----
  if (step === 'done') {
    return (
      <>
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <CloseChip />
        </div>
        <div style={{ padding: '24px 24px 0' }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: SS.green,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 900,
              margin: '0 auto 24px',
              border: `4px solid ${SS.ink}`,
              boxShadow: `0 6px 0 ${SS.ink}`,
            }}
          >
            ✓
          </div>
          <SSEyebrow style={{ textAlign: 'center', marginBottom: 8 }}>
            Bag {bagCode} logged
          </SSEyebrow>
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.8,
              lineHeight: 0.95,
              color: SS.ink,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Ready for pickup.
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: SS.inkSoft,
              textAlign: 'center',
              marginBottom: 22,
              padding: '0 12px',
            }}
          >
            Leave it at your doorstep before your pickup time. Points credit after our depot weighs the bag.
          </div>
        </div>
        <div
          style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <SSPillButton variant="primary" onClick={reset}>
            Scan next bag
          </SSPillButton>
          <SSPillButton variant="outline" onClick={() => router.replace('/resident')} arrow={false}>
            Done — back home
          </SSPillButton>
        </div>
      </>
    );
  }

  // ---- ERROR ----
  if (step === 'error') {
    return (
      <>
        <ScanHeader
          eyebrow={bagCode ? 'Submit failed' : "Couldn't open camera"}
          title="Try again, or enter it."
        />
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              background: SS.brand,
              border: `2px solid ${SS.ink}`,
              borderRadius: 22,
              padding: 22,
              color: '#fff',
              boxShadow: `0 6px 0 ${SS.ink}`,
            }}
          >
            <SSEyebrow style={{ color: '#fff', opacity: 0.85, marginBottom: 6 }}>Error</SSEyebrow>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.1 }}>
              {error ?? 'Something went wrong.'}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                opacity: 0.9,
                marginTop: 8,
                lineHeight: 1.4,
              }}
            >
              Try moving 6–8 inches away from the QR, or type the printed number below.
            </div>
          </div>
          <SSPillButton variant="primary" onClick={reset}>
            Try again
          </SSPillButton>
          <SSPillButton
            variant="outline"
            onClick={() => {
              setStep('manual');
              setError(null);
            }}
            arrow={false}
          >
            Enter bag # manually
          </SSPillButton>
        </div>
      </>
    );
  }

  // ---- MANUAL ENTRY ----
  if (step === 'manual') {
    return (
      <>
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setStep('scan')}
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: SS.ink,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: SS.sans,
            }}
          >
            ← Scan
          </button>
          <SSEyebrow>Manual entry</SSEyebrow>
        </div>
        <div style={{ padding: '12px 24px 4px' }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 0.95 }}>
            Type the bag #
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 8 }}>
            Printed under the QR code, format like A24-104.
          </div>
        </div>
        <form
          onSubmit={handleManualSubmit}
          style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <label
            style={{
              display: 'block',
              background: SS.yellow,
              border: `2px solid ${SS.ink}`,
              borderRadius: 18,
              padding: '18px 18px',
              boxShadow: `0 4px 0 ${SS.ink}`,
            }}
          >
            <input
              autoFocus
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value.toUpperCase())}
              placeholder="A24-104"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: 1,
                color: SS.ink,
                textAlign: 'center',
              }}
            />
          </label>
          <SSPillButton type="submit" variant="primary" disabled={!manualInput.trim()}>
            Confirm bag
          </SSPillButton>
        </form>
      </>
    );
  }

  // ---- CHOOSE TYPE / PHOTO (combined into one screen, sticker-card style) ----
  if (step === 'choose_type' || step === 'photo' || step === 'submitting') {
    return (
      <>
        <ScanHeader eyebrow="Bag detected" title="Confirm this is yours." />
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              background: SS.sky,
              border: `2px solid ${SS.ink}`,
              borderRadius: 22,
              padding: 20,
              boxShadow: `0 6px 0 ${SS.ink}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <SSEyebrow>Bag #</SSEyebrow>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: -0.8,
                    color: SS.ink,
                    marginTop: 2,
                  }}
                >
                  {bagCode}
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontFamily: SS.sans,
                  fontSize: 13,
                  fontWeight: 900,
                  color: SS.ink,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Change
              </button>
            </div>
          </div>

          <SSStickerCard>
            <SSEyebrow style={{ marginBottom: 10 }}>What&rsquo;s in this bag?</SSEyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(
                [
                  { k: 'separated' as const, label: 'Separated', sub: '×2 points' },
                  { k: 'mixed' as const, label: 'Mixed', sub: 'Base points' },
                ] satisfies { k: DeclaredBagType; label: string; sub: string }[]
              ).map(({ k, label, sub }) => {
                const active = declaredType === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setDeclaredType(k);
                      setStep('photo');
                    }}
                    style={{
                      background: active ? SS.yellow : '#fff',
                      border: `2px solid ${SS.ink}`,
                      borderRadius: 14,
                      padding: '14px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: SS.sans,
                      boxShadow: active ? `0 4px 0 ${SS.ink}` : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: SS.ink,
                        letterSpacing: -0.3,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ fontSize: 12, fontWeight: 800, color: SS.inkSoft, marginTop: 4 }}
                    >
                      {sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </SSStickerCard>

          {declaredType && (
            <SSStickerCard>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <SSEyebrow>Doorstep photo</SSEyebrow>
                {STORAGE_MOCKED && (
                  <span
                    style={{
                      background: SS.peach,
                      border: `2px solid ${SS.ink}`,
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Demo mode
                  </span>
                )}
              </div>
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 10',
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: `2px solid ${SS.ink}`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    style={{
                      marginTop: 10,
                      background: 'transparent',
                      border: 'none',
                      fontFamily: SS.sans,
                      fontSize: 13,
                      fontWeight: 900,
                      color: SS.ink,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Retake
                  </button>
                </>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    aspectRatio: '16 / 10',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px dashed ${SS.ink}`,
                    borderRadius: 12,
                    background: SS.line,
                    cursor: 'pointer',
                    fontFamily: SS.sans,
                    fontSize: 15,
                    fontWeight: 900,
                    color: SS.ink,
                  }}
                >
                  Tap to take photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </SSStickerCard>
          )}

          {bagCode && declaredType && photo && (
            <SSPillButton
              variant="primary"
              onClick={submit}
              disabled={step === 'submitting'}
            >
              {step === 'submitting' ? 'Submitting…' : 'Set out for pickup'}
            </SSPillButton>
          )}
        </div>
      </>
    );
  }

  // ---- SCAN (camera / idle) ----
  return (
    <>
      <ScanHeader
        eyebrow="Scan bag tag"
        title={
          <>
            Center the QR <br />
            on the bag.
          </>
        }
      />
      <div
        style={{
          margin: '24px auto',
          width: 'min(70%, 260px)',
          borderRadius: 24,
          overflow: 'hidden',
          background: '#222',
          position: 'relative',
          aspectRatio: '1 / 1',
        }}
      >
        {cameraOn ? (
          <video
            ref={videoRef}
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(45deg, #2c2c2c 0 12px, #292929 12px 24px)',
            }}
          />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 150,
            height: 150,
          }}
        >
          {[
            { top: 0, left: 0 },
            { top: 0, right: 0 },
            { bottom: 0, left: 0 },
            { bottom: 0, right: 0 },
          ].map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...p,
                width: 28,
                height: 28,
                borderTop: p.top === 0 ? `4px solid ${SS.yellow}` : undefined,
                borderBottom: p.bottom === 0 ? `4px solid ${SS.yellow}` : undefined,
                borderLeft: p.left === 0 ? `4px solid ${SS.yellow}` : undefined,
                borderRight: p.right === 0 ? `4px solid ${SS.yellow}` : undefined,
              }}
            />
          ))}
          {cameraOn && (
            <div
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                top: '50%',
                height: 3,
                background: SS.brand,
                boxShadow: `0 0 16px ${SS.brand}`,
              }}
            />
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 18,
            right: 18,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
            {cameraOn ? 'Looking for QR…' : 'Tap to start camera'}
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cameraOn ? SS.yellow : SS.inkSoft,
            }}
          />
        </div>
        {!cameraOn && (
          <button
            type="button"
            aria-label="Start camera"
            onClick={() => {
              setError(null);
              setCameraOn(true);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          />
        )}
      </div>
      <div
        style={{
          padding: '0 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <SSPillButton
          variant="primary"
          onClick={() => setStep('manual')}
          style={{ fontSize: 17, padding: '18px 24px' }}
        >
          Enter bag # manually
        </SSPillButton>
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 800,
            color: SS.inkSoft,
          }}
        >
          Bag tags are on the back of every bag.
        </div>
      </div>
    </>
  );
}
