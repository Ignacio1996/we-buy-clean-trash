'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { ScanResult, ScannedItem } from '@/lib/ai/scan';
import {
  clearPresignupScan,
  readPresignupScan,
  writePresignupScan,
} from '@/lib/presignup/scan-storage';
import {
  SS,
  SSEyebrow,
  SSPillLink,
  SSStickerCard,
} from '@/components/resident/ss/SS';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const hasItems = items.length > 0;

  return (
    <div
      style={{
        flex: 1,
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — eyebrow + close chip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
        }}
      >
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7 }}>Try before you join</SSEyebrow>
        <Link
          href="/"
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
      </div>

      {/* Title */}
      <div style={{ padding: '4px 20px 0' }}>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: -1.2,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          What&rsquo;s your <br />
          <span style={{ color: SS.brand }}>trash worth?</span>
        </h1>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 10,
            lineHeight: 1.4,
          }}
        >
          Point your camera at any recyclable. We&rsquo;ll tally a price. No account needed.
        </div>
      </div>

      {/* Camera card */}
      <div style={{ padding: '20px 20px 0' }}>
        <CameraCard
          cameraOn={cameraOn}
          scanning={scanning}
          videoRef={videoRef}
          onOpen={() => {
            setError(null);
            setCameraOn(true);
          }}
          onCapture={captureFromCamera}
          onPickFile={() => fileInputRef.current?.click()}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {error && (
        <div style={{ padding: '14px 20px 0' }}>
          <div
            role="alert"
            style={{
              background: SS.brand,
              border: `2px solid ${SS.ink}`,
              borderRadius: 18,
              padding: 16,
              color: '#fff',
              boxShadow: `0 4px 0 ${SS.ink}`,
            }}
          >
            <SSEyebrow style={{ color: '#fff', opacity: 0.85, marginBottom: 4 }}>Error</SSEyebrow>
            <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>{error}</div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '20px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {hasItems ? (
          <>
            {/* Running total */}
            <SSStickerCard background={SS.sky}>
              <SSEyebrow style={{ marginBottom: 8 }}>
                Estimated earnings · {items.length} item{items.length === 1 ? '' : 's'}
              </SSEyebrow>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 900,
                  letterSpacing: -2.4,
                  lineHeight: 0.9,
                  color: SS.ink,
                }}
              >
                ${totalDollars.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: SS.ink,
                  opacity: 0.75,
                  marginTop: 6,
                }}
              >
                {formatPoints(totalPoints)} points · saved if you sign up.
              </div>
            </SSStickerCard>

            {/* Itemized breakdown */}
            <SSStickerCard>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <SSEyebrow>Itemized</SSEyebrow>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontFamily: SS.sans,
                    fontSize: 12,
                    fontWeight: 900,
                    color: SS.brand,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              </div>
              {items.map((it, i) => (
                <div
                  key={`${it.label}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${SS.line}`,
                    fontSize: 14,
                    fontWeight: 800,
                    color: SS.ink,
                  }}
                >
                  <span>{it.label}</span>
                  <span>
                    ${it.estimatedDollars.toFixed(2)}
                    <span style={{ color: SS.inkSoft, marginLeft: 8, fontWeight: 700 }}>
                      +{formatPoints(it.estimatedPoints)} pts
                    </span>
                  </span>
                </div>
              ))}
            </SSStickerCard>
          </>
        ) : (
          // Empty-state example card
          <SSStickerCard background={SS.mint}>
            <SSEyebrow style={{ marginBottom: 10 }}>What we pay</SSEyebrow>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: -0.4,
                color: SS.ink,
                lineHeight: 1.25,
                marginBottom: 14,
              }}
            >
              About 100 cans a week earns a $10 gift card every month.
            </div>
            {(
              [
                ['Aluminum', '$0.05 / can'],
                ['PET (32oz)', '$0.10 / bottle'],
                ['Glass', '$0.06 / bottle'],
              ] as Array<[string, string]>
            ).map(([l, v], i) => (
              <div
                key={l}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderTop: i === 0 ? `1px solid ${SS.ink}` : `1px solid ${SS.line}`,
                  fontSize: 14,
                  fontWeight: 800,
                  color: SS.ink,
                }}
              >
                <span>{l}</span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontWeight: 800,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </SSStickerCard>
        )}
      </div>

      {/* CTA */}
      <div
        style={{
          padding: '20px 20px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <SSPillLink href="/signup" variant="primary">
          {hasItems ? 'Sign up & save these earnings' : 'Sign up to start earning'}
        </SSPillLink>
        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: SS.inkSoft,
          }}
        >
          Already a member?{' '}
          <Link
            href="/login"
            style={{
              color: SS.ink,
              fontWeight: 900,
              textDecoration: 'underline',
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function CameraCard({
  cameraOn,
  scanning,
  videoRef,
  onOpen,
  onCapture,
  onPickFile,
}: {
  cameraOn: boolean;
  scanning: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onOpen: () => void;
  onCapture: () => void;
  onPickFile: () => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        background: '#222',
        border: `2px solid ${SS.ink}`,
        boxShadow: `0 6px 0 ${SS.ink}`,
        aspectRatio: '3 / 4',
      }}
    >
      {cameraOn ? (
        <video
          ref={videoRef}
          playsInline
          muted
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
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(45deg, #2c2c2c 0 12px, #292929 12px 24px)',
          }}
        />
      )}

      {/* Reticule corners */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 220,
          height: 220,
        }}
      >
        {(
          [
            { top: 0, left: 0 },
            { top: 0, right: 0 },
            { bottom: 0, left: 0 },
            { bottom: 0, right: 0 },
          ] as CSSProperties[]
        ).map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...p,
              width: 40,
              height: 40,
              borderTop: p.top === 0 ? `4px solid ${SS.yellow}` : undefined,
              borderBottom: p.bottom === 0 ? `4px solid ${SS.yellow}` : undefined,
              borderLeft: p.left === 0 ? `4px solid ${SS.yellow}` : undefined,
              borderRight: p.right === 0 ? `4px solid ${SS.yellow}` : undefined,
            }}
          />
        ))}
        {cameraOn && (
          <div
            aria-hidden
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

      {/* Status pill — only when camera is on */}
      {cameraOn && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            {scanning ? 'Analyzing…' : 'Looking for items…'}
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: scanning ? SS.brand : SS.yellow,
            }}
          />
        </div>
      )}

      {/* Bottom controls */}
      {cameraOn ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onCapture}
            disabled={scanning}
            style={{
              flex: 1,
              background: SS.green,
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '16px 22px',
              fontFamily: SS.sans,
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: -0.2,
              boxShadow: `0 4px 0 ${SS.greenDark}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: scanning ? 'not-allowed' : 'pointer',
              opacity: scanning ? 0.7 : 1,
            }}
          >
            <span>{scanning ? 'Scanning…' : 'Capture'}</span>
            <span style={{ fontSize: 20 }}>→</span>
          </button>
          <button
            type="button"
            onClick={onPickFile}
            aria-label="Upload photo"
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: '#fff',
              border: `2px solid ${SS.ink}`,
              boxShadow: `0 4px 0 ${SS.ink}`,
              fontSize: 22,
              fontWeight: 900,
              cursor: 'pointer',
              fontFamily: SS.sans,
              color: SS.ink,
              flexShrink: 0,
            }}
          >
            ⤴
          </button>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 20px 22px',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onOpen}
            style={{
              width: '100%',
              background: SS.yellow,
              color: SS.ink,
              border: `2px solid ${SS.ink}`,
              borderRadius: 999,
              padding: '16px 22px',
              fontFamily: SS.sans,
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: -0.2,
              boxShadow: `0 4px 0 ${SS.ink}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <span>Open camera</span>
            <span style={{ fontSize: 20 }}>→</span>
          </button>
          <button
            type="button"
            onClick={onPickFile}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: SS.sans,
              fontSize: 12,
              fontWeight: 900,
              color: '#fff',
              opacity: 0.85,
              cursor: 'pointer',
              padding: 6,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            or upload a photo
          </button>
        </div>
      )}
    </div>
  );
}
