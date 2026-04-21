'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';

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
    // submit references stable props (bagOrderId) — the effect only needs to
    // re-run when the camera toggles on/off or the step changes.
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
      <section className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
        <div className="text-3xl">✅</div>
        <div className="mt-1 text-sm font-semibold text-white">
          {summary.bagCount} bags issued
        </div>
        <div className="mt-1 text-xs text-gray-400">Returning to route…</div>
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-4 text-sm text-green-100">
        <div className="font-semibold">How this works</div>
        <p className="mt-1 text-xs text-green-200/80">
          Scan <strong>one sticker</strong> (the first — ending in <code>-01</code>) from the sheet
          you’re handing over. The app claims all 10 for this resident automatically.
        </p>
      </div>

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
            📷 Tap to scan first sticker
          </button>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Or type it: BAG-xxxx-01"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="flex-1 rounded border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-white"
          />
          <button
            type="submit"
            disabled={!manual.trim() || step === 'submitting'}
            className="rounded bg-white px-3 text-sm font-semibold text-black disabled:opacity-30"
          >
            Use
          </button>
        </form>
      </div>

      {step === 'submitting' && (
        <p className="text-center text-xs text-gray-400">Claiming sheet…</p>
      )}

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {friendlyError(error)}
        </p>
      )}
    </section>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'invalid_sticker':
      return 'That code doesn’t look like a sticker. Expected format: BAG-xxxx-01 (must end in -01).';
    case 'sheet_already_issued':
      return 'This sticker sheet has already been claimed by another resident. Grab a fresh sheet.';
    case 'already_delivered':
      return 'This order is already marked delivered.';
    default:
      return code;
  }
}
