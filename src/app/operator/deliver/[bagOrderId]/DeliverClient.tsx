'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useRouter } from 'next/navigation';
import {
  OP_TOK,
  OpEyebrow,
  OpPaper,
  OpPrimaryButton,
} from '@/components/operator/Op';
import { IconCheck, IconScan } from '@/components/icons/EcoIcons';

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
      <section className="space-y-4">
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
            {summary.bagCount} bags issued.
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
            Returning to route…
          </div>
        </OpPaper>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <OpPaper
        style={{
          background: OP_TOK.greenSoft,
          border: `1px solid rgba(45,90,61,0.3)`,
        }}
      >
        <OpEyebrow color={OP_TOK.green}>How this works</OpEyebrow>
        <p
          className="mt-1.5 italic"
          style={{
            fontFamily: OP_TOK.serif,
            fontSize: 13,
            color: OP_TOK.green,
            lineHeight: 1.5,
          }}
        >
          Scan <strong>one sticker</strong> (the first — ending in{' '}
          <code style={{ fontFamily: OP_TOK.mono }}>-01</code>) from the sheet you’re handing
          over. The app claims all 10 for this resident automatically.
        </p>
      </OpPaper>

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
              style={{ background: 'transparent', border: 'none', color: OP_TOK.paper }}
            >
              <span
                className="italic"
                style={{ fontFamily: OP_TOK.serif, fontSize: 14, opacity: 0.85 }}
              >
                Tap to scan first sticker
              </span>
            </button>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div style={{ padding: 14 }}>
          <OpPrimaryButton
            onClick={() => {
              setError(null);
              setCameraOn(true);
            }}
            disabled={cameraOn || step === 'submitting'}
          >
            <IconScan size={18} color={OP_TOK.paper} stroke={1.75} />
            {cameraOn ? 'Scanning…' : 'Tap to scan'}
          </OpPrimaryButton>
          <div className="mt-3.5 flex items-center gap-2">
            <div style={{ flex: 1, height: 1, background: OP_TOK.lineSoft }} />
            <span
              className="italic"
              style={{ fontFamily: OP_TOK.serif, fontSize: 11, color: OP_TOK.inkSoft }}
            >
              or type the code
            </span>
            <div style={{ flex: 1, height: 1, background: OP_TOK.lineSoft }} />
          </div>
          <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="BAG-xxxx-01"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
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
              disabled={!manual.trim() || step === 'submitting'}
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

      {step === 'submitting' && (
        <p
          className="text-center italic"
          style={{
            fontFamily: OP_TOK.serif,
            fontSize: 12,
            color: OP_TOK.inkSoft,
          }}
        >
          Claiming sheet…
        </p>
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
