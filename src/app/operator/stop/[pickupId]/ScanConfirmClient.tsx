'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';

const MAX_PHOTO_EDGE = 1024;

type Step = 'scan' | 'details' | 'submitting' | 'done';

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
    // handleScanned references stable props (expectedCode) — the effect only
    // needs to re-run when the camera toggles on/off or the step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, step]);

  function handleScanned(code: string) {
    if (!codeMatches(code, expectedCode)) {
      setError(`Scanned ${code}, expected ${expectedCode}. Double-check the bag.`);
      return;
    }
    setScannedCode(code);
    setCameraOn(false);
    setStep('details');
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
      // Let the UI show the success state briefly, then bounce back — the route
      // loader will advance to the next pending pickup (or next stop) automatically.
      setTimeout(() => {
        router.replace('/operator');
        router.refresh();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('details');
    }
  }

  if (step === 'done') {
    return (
      <section className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
        <div className="text-3xl">✅</div>
        <div className="mt-1 text-sm font-semibold text-white">Pickup confirmed</div>
        <div className="mt-1 text-xs text-gray-400">Loading next stop…</div>
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Expected bag</div>
        <div className="mt-1 font-mono text-sm text-white">{expectedCode}</div>
      </div>

      {step === 'scan' && (
        <div className="rounded-xl border border-white/10 bg-black p-3">
          {cameraOn ? (
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full rounded-lg object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCameraOn(true);
              }}
              className="flex aspect-[4/3] w-full items-center justify-center text-sm text-gray-400"
            >
              📷 Tap to scan QR
            </button>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Or type the printed number"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="flex-1 rounded border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
            <button
              type="submit"
              disabled={!manual.trim()}
              className="rounded bg-white px-3 text-sm font-semibold text-black disabled:opacity-30"
            >
              Use
            </button>
          </form>
        </div>
      )}

      {step !== 'scan' && scannedCode && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Scanned</div>
          <div className="mt-1 flex items-center justify-between">
            <div className="font-mono text-white">{scannedCode}</div>
            <button
              type="button"
              onClick={() => {
                setStep('scan');
                setScannedCode('');
                setPhoto(null);
              }}
              className="text-xs text-gray-400 underline"
            >
              Rescan
            </button>
          </div>
        </div>
      )}

      {step !== 'scan' && (
        <>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Condition check</div>
            <label className="mt-3 flex items-center justify-between">
              <span>Bag sealed properly?</span>
              <Toggle value={sealed} onChange={setSealed} />
            </label>
            <label className="mt-3 flex items-center justify-between">
              <span>Visible contamination?</span>
              <Toggle value={contamination} onChange={setContamination} tone="warn" />
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Doorstep photo</div>
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

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!photo || step === 'submitting'}
            className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {step === 'submitting' ? 'Submitting…' : '✓ Confirm pickup'}
          </button>
        </>
      )}

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}

function codeMatches(scanned: string, expected: string): boolean {
  if (!expected) return false;
  const norm = (s: string) => s.trim().toUpperCase();
  return norm(scanned) === norm(expected);
}

function Toggle({
  value,
  onChange,
  tone = 'ok',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  tone?: 'ok' | 'warn';
}) {
  const on = tone === 'warn' ? value : value;
  const bg = tone === 'warn'
    ? (value ? 'bg-red-500' : 'bg-white/20')
    : (value ? 'bg-green-500' : 'bg-white/20');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 rounded-full transition-colors ${bg}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`}
      />
    </button>
  );
}
