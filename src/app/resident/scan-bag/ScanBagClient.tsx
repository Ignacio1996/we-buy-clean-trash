'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import type { DeclaredBagType } from '@/lib/types/bag';

type Step = 'scan' | 'choose_type' | 'photo' | 'submitting' | 'done';

const MAX_PHOTO_EDGE = 1024;

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
      <section className="mt-6 space-y-4">
        <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-5 text-center">
          <div className="text-3xl">✅</div>
          <div className="mt-1 font-semibold text-white">Bag marked for pickup</div>
          <div className="mt-1 text-xs text-gray-400">
            Leave it at your doorstep before your pickup time.
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
        >
          Scan another bag
        </button>
        <button
          type="button"
          onClick={() => router.replace('/resident')}
          className="w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-black"
        >
          Back to home
        </button>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Bag code</div>
        {bagCode ? (
          <div className="mt-1 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">{bagCode}</div>
            <button
              type="button"
              onClick={() => {
                setBagCode('');
                setStep('scan');
              }}
              className="text-xs text-gray-400 underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 overflow-hidden rounded-lg border border-white/15 bg-black">
              {cameraOn ? (
                <video ref={videoRef} playsInline className="aspect-video w-full object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCameraOn(true);
                  }}
                  className="flex aspect-video w-full items-center justify-center text-sm text-gray-400"
                >
                  📷 Tap to open camera
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
                className="flex-1 rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="rounded bg-white px-3 text-sm font-semibold text-black disabled:opacity-30"
              >
                Use
              </button>
            </form>
          </>
        )}
      </div>

      {bagCode && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">
            What&rsquo;s in this bag?
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDeclaredType('separated');
                setStep('photo');
              }}
              className={`rounded-xl border px-3 py-3 text-sm ${
                declaredType === 'separated'
                  ? 'border-green-500 bg-green-500/15 text-white'
                  : 'border-white/15 bg-white/5 text-gray-200'
              }`}
            >
              ⭐ Separated
              <div className="mt-0.5 text-[10px] text-gray-400">2× points</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeclaredType('mixed');
                setStep('photo');
              }}
              className={`rounded-xl border px-3 py-3 text-sm ${
                declaredType === 'mixed'
                  ? 'border-white bg-white/10 text-white'
                  : 'border-white/15 bg-white/5 text-gray-200'
              }`}
            >
              🔀 Mixed
              <div className="mt-0.5 text-[10px] text-gray-400">Base points</div>
            </button>
          </div>
        </div>
      )}

      {declaredType && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Doorstep photo</div>
          {photo ? (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt=""
                className="aspect-video w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="mt-2 text-xs text-gray-400 underline"
              >
                Retake
              </button>
            </div>
          ) : (
            <label className="mt-2 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/20 bg-black/30 text-sm text-gray-400">
              📸 Tap to take photo
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {bagCode && declaredType && photo && (
        <button
          type="button"
          onClick={submit}
          disabled={step === 'submitting'}
          className="w-full rounded-xl bg-green-500 px-3 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {step === 'submitting' ? 'Submitting…' : 'Mark bag ready for pickup'}
        </button>
      )}
    </section>
  );
}
