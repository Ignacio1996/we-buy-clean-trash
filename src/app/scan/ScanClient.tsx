'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ScanResult, ScannedItem } from '@/lib/ai/scan';
import {
  clearPresignupScan,
  readPresignupScan,
  writePresignupScan,
} from '@/lib/presignup/scan-storage';

const MAX_PHOTO_EDGE = 1024;

function frameToBase64(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return dataUrl.split(',')[1] ?? null;
}

function fileToBase64(file: File): Promise<string> {
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
        resolve(dataUrl.split(',')[1] ?? '');
      };
      img.onerror = () => reject(new Error('image_load_failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatPoints(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

export function ScanClient() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const stored = readPresignupScan();
    if (stored) setItems(stored.items);
  }, []);

  useEffect(() => {
    const totalDollars = items.reduce((sum, it) => sum + it.estimatedDollars, 0);
    const totalPoints = items.reduce((sum, it) => sum + it.estimatedPoints, 0);
    if (items.length === 0) clearPresignupScan();
    else writePresignupScan({ items, totalDollars, totalPoints });
  }, [items]);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
      })
      .catch((err) => {
        setError(`Camera unavailable: ${err instanceof Error ? err.message : 'unknown'}`);
        setCameraOn(false);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn]);

  async function sendToApi(imageBase64: string) {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<ScanResult> & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'scan_failed');
      const newItems = Array.isArray(body.items) ? body.items : [];
      setItems((prev) => [...prev, ...newItems]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'scan_failed');
    } finally {
      setScanning(false);
    }
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;
    const base64 = frameToBase64(video);
    if (!base64) {
      setError('Camera not ready yet — try again in a second.');
      return;
    }
    void sendToApi(base64);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      await sendToApi(base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'photo_failed');
    }
  }

  const totalDollars = items.reduce((sum, it) => sum + it.estimatedDollars, 0);
  const totalPoints = items.reduce((sum, it) => sum + it.estimatedPoints, 0);

  return (
    <section className="mt-6 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-green-500/25 bg-black">
        {cameraOn ? (
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
            />
            <button
              type="button"
              onClick={captureFromCamera}
              disabled={scanning}
              className="absolute inset-x-0 bottom-3 mx-auto w-4/5 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-black shadow-lg disabled:opacity-60"
            >
              {scanning ? 'Scanning…' : '📸 Scan this'}
            </button>
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="text-2xl">📸</div>
            <div className="text-sm text-gray-300">Point your camera at any recyclable item</div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCameraOn(true);
              }}
              className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-black"
            >
              Open camera
            </button>
            <label className="cursor-pointer text-xs text-gray-400 underline">
              or upload a photo
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-gray-400">Scanned items</div>
            <button
              type="button"
              onClick={() => setItems([])}
              className="text-xs text-gray-400 underline"
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 divide-y divide-white/5">
            {items.map((item, idx) => (
              <li
                key={`${item.label}-${idx}`}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-white">{item.label}</span>
                <span className="text-gray-400">
                  {formatMoney(item.estimatedDollars)} · {formatPoints(item.estimatedPoints)} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border border-green-500/25 bg-green-500/10 p-5 text-center">
          <div className="text-xs text-gray-400">Your estimated earnings</div>
          <div className="mt-1 text-3xl font-extrabold text-white">
            {formatMoney(totalDollars)} · {formatPoints(totalPoints)} pts
          </div>
          <div className="mt-1 text-xs text-green-400">
            Recycle ~100 cans/week ≈ $10 gift card every month
          </div>
        </div>
      )}

      <Link
        href="/signup"
        className="block w-full rounded-xl bg-green-500 px-4 py-3 text-center text-sm font-semibold text-black"
      >
        {items.length > 0 ? 'Sign Up & Start Earning →' : 'Sign up to start earning →'}
      </Link>

      {items.length > 0 && (
        <p className="text-center text-xs text-gray-500">
          Scan more items above, or sign up to save your earnings.
        </p>
      )}

      <p className="pt-2 text-center text-xs text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
