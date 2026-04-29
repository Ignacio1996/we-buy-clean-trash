'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { DeclaredBagType } from '@/lib/types/bag';
import { IconScan, IconArrow, IconLeaf } from '@/components/icons/EcoIcons';

type Step = 'scan' | 'choose_type' | 'photo' | 'submitting' | 'done';

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
      .catch((err) =>
        setError(`camera_failed: ${err instanceof Error ? err.message : String(err)}`),
      );

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
      setStep('photo');
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

  if (step === 'done') {
    return (
      <section className="mt-2 space-y-3">
        <div
          className="rounded-[14px] border px-5 py-6 text-center"
          style={{ background: '#E8EFE6', borderColor: 'rgba(45,90,61,0.3)' }}
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#FBF7EE]">
            <IconLeaf size={20} color="#2D5A3D" stroke={1.5} />
          </div>
          <div
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 18,
              fontWeight: 500,
              color: '#1F2A22',
              letterSpacing: -0.2,
            }}
          >
            Bag marked for pickup.
          </div>
          <div className="mt-1.5" style={{ fontSize: 12, color: '#5A6358' }}>
            Leave it at your doorstep before your pickup time.
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-full border border-[#D9D2C2] bg-[#FBF7EE] px-5 py-3 text-[13px] font-semibold tracking-[0.3px] text-[#1F2A22] transition-colors hover:bg-[#F8F3E5]"
        >
          Scan another bag
        </button>
        <button
          type="button"
          onClick={() => router.replace('/resident')}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D5A3D] px-5 py-3 text-[13px] font-semibold tracking-[0.3px] text-[#FBF7EE] transition-colors hover:bg-[#1F4029]"
        >
          Back to home <IconArrow size={14} color="#FBF7EE" />
        </button>
      </section>
    );
  }

  return (
    <section className="mt-2 space-y-3">
      <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow">Bag code</div>
        {bagCode ? (
          <div className="mt-1.5 flex items-center justify-between">
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 20,
                fontWeight: 500,
                color: '#1F2A22',
                letterSpacing: -0.2,
              }}
            >
              {bagCode}
            </div>
            <button
              type="button"
              onClick={() => {
                setBagCode('');
                setStep('scan');
              }}
              className="text-[12px] text-[#5A6358] underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 overflow-hidden rounded-[12px] border border-[#D9D2C2] bg-black">
              {cameraOn ? (
                <video ref={videoRef} playsInline className="aspect-video w-full object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCameraOn(true);
                  }}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-[13px] text-[#FBF7EE]"
                >
                  <IconScan size={28} color="#FBF7EE" stroke={1.5} />
                  <span>Tap to open camera</span>
                </button>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Or type the printed number"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 rounded-[10px] border border-[#D9D2C2] bg-[#FBF7EE] px-3 py-2 text-[13px] text-[#1F2A22] placeholder:text-[#8A8A7A] focus:border-[#2D5A3D] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="rounded-full bg-[#2D5A3D] px-4 text-[13px] font-semibold text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Use
              </button>
            </form>
          </>
        )}
      </div>

      {bagCode && (
        <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
          <div className="eco-eyebrow">What&rsquo;s in this bag?</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDeclaredType('separated');
                setStep('photo');
              }}
              className={`rounded-[12px] border px-3 py-3 text-left transition-colors ${
                declaredType === 'separated'
                  ? 'border-[rgba(45,90,61,0.5)] bg-[#E8EFE6]'
                  : 'border-[#D9D2C2] bg-[#FBF7EE] hover:bg-[#F8F3E5]'
              }`}
            >
              <div
                style={{
                  fontFamily: 'var(--eco-serif)',
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#1F2A22',
                }}
              >
                Separated
              </div>
              <div className="mt-0.5" style={{ fontSize: 11, color: '#2D5A3D' }}>
                2× points
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeclaredType('mixed');
                setStep('photo');
              }}
              className={`rounded-[12px] border px-3 py-3 text-left transition-colors ${
                declaredType === 'mixed'
                  ? 'border-[#1F2A22] bg-[#F8F3E5]'
                  : 'border-[#D9D2C2] bg-[#FBF7EE] hover:bg-[#F8F3E5]'
              }`}
            >
              <div
                style={{
                  fontFamily: 'var(--eco-serif)',
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#1F2A22',
                }}
              >
                Mixed
              </div>
              <div className="mt-0.5" style={{ fontSize: 11, color: '#5A6358' }}>
                Base points
              </div>
            </button>
          </div>
        </div>
      )}

      {declaredType && (
        <div className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
          <div className="flex items-center justify-between">
            <div className="eco-eyebrow">Doorstep photo</div>
            {STORAGE_MOCKED && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: '#F2E8D6',
                  borderColor: 'rgba(160,104,42,0.3)',
                  color: '#A0682A',
                }}
              >
                Demo mode · upload simulated
              </span>
            )}
          </div>
          {photo ? (
            <div className="mt-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt=""
                className="aspect-video w-full rounded-[12px] object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="mt-2 text-[12px] text-[#5A6358] underline"
              >
                Retake
              </button>
            </div>
          ) : (
            <label className="mt-2.5 flex aspect-video w-full cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-[#D9D2C2] bg-[#F8F3E5] text-[13px] text-[#5A6358] transition-colors hover:bg-[#E8E2D0]">
              <span className="italic" style={{ fontFamily: 'var(--eco-serif)' }}>
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
        </div>
      )}

      {error && (
        <p className="text-[13px]" style={{ color: '#9A4B26' }}>
          {error}
        </p>
      )}

      {bagCode && declaredType && photo && (
        <button
          type="button"
          onClick={submit}
          disabled={step === 'submitting'}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D5A3D] px-5 py-3 text-[14px] font-semibold tracking-[0.3px] text-[#FBF7EE] transition-colors hover:bg-[#1F4029] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step === 'submitting' ? 'Submitting…' : 'Mark bag ready for pickup'}
          {step !== 'submitting' && <IconArrow size={14} color="#FBF7EE" />}
        </button>
      )}
    </section>
  );
}
