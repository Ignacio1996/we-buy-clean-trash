'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QrScannerProps {
  onDetected: (value: string) => void;
  manualPlaceholder?: string;
  scanInstructions?: string;
}

export function QrScanner({
  onDetected,
  manualPlaceholder = 'Or type the printed number',
  scanInstructions = '📷 Tap to scan QR',
}: QrScannerProps) {
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled || detectedRef.current) return;
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
            detectedRef.current = true;
            setCameraOn(false);
            onDetected(code.data.trim());
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
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
  }, [cameraOn, onDetected]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    detectedRef.current = true;
    setCameraOn(false);
    onDetected(v);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black p-3">
      {cameraOn ? (
        <div className="relative">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => setCameraOn(false)}
            className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            detectedRef.current = false;
            setCameraOn(true);
          }}
          className="flex aspect-[4/3] w-full items-center justify-center text-sm text-gray-400"
        >
          {scanInstructions}
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder={manualPlaceholder}
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
      {error && (
        <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
