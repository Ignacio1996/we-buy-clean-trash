'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { loadJsQR } from '@/lib/scanner/loadJsQR';
import {
  SS,
  SSEyebrow,
  SSPillButton,
} from '@/components/resident/ss/SS';

// The post-scan flow (choose type → photo → submit → done/error) only renders
// after a successful scan. Splitting it out of the initial bundle drops the
// page's first-paint JS by roughly half. The chunk preloads as soon as the
// user starts the camera so it's ready by the time they need it.
const PostScanFlow = dynamic(() => import('./PostScanFlow'), {
  ssr: false,
  loading: () => null,
});

type Step = 'scan' | 'manual' | 'post_scan' | 'camera_error';

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
        fontSize: 20,
        fontWeight: 900,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        fontFamily: SS.sans,
        lineHeight: 1,
      }}
    >
      ×
    </Link>
  );
}

function ScanHeader({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div>
        <SSEyebrow>{eyebrow}</SSEyebrow>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: -1.2,
            lineHeight: 0.95,
            color: SS.ink,
            marginTop: 8,
          }}
        >
          {title}
        </div>
      </div>
      <CloseChip />
    </div>
  );
}

export function ScanBagClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [bagCode, setBagCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-warm jsqr + the PostScanFlow chunk on mount. Both are network-bound,
  // so kicking them off here means they'll be cached in the browser long
  // before the user finishes lining up a QR code.
  useEffect(() => {
    void loadJsQR();
    void import('./PostScanFlow');
  }, []);

  useEffect(() => {
    if (!cameraOn || step !== 'scan') return;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    Promise.all([
      loadJsQR(),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
    ])
      .then(([jsQR, s]) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        const scan = () => {
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (!v || !canvas) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, {
                inversionAttempts: 'dontInvert',
              });
              if (code && code.data) {
                setBagCode(code.data.trim());
                setStep('post_scan');
                setCameraOn(false);
                return;
              }
            }
          }
          if (!cancelled) rafId = requestAnimationFrame(scan);
        };
        rafId = requestAnimationFrame(scan);
      })
      .catch((err) => {
        setCameraError(err instanceof Error ? err.message : String(err));
        setStep('camera_error');
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
    setStep('post_scan');
  }

  function reset() {
    setBagCode('');
    setManualInput('');
    setCameraError(null);
    setStep('scan');
  }

  if (step === 'post_scan') {
    return (
      <PostScanFlow
        bagCode={bagCode}
        onReset={reset}
        onBackHome={() => router.replace('/resident')}
      />
    );
  }

  if (step === 'camera_error') {
    return (
      <>
        <ScanHeader eyebrow="Couldn't open camera" title="Try again, or enter it." />
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
              {cameraError ?? 'Something went wrong.'}
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
              setCameraError(null);
            }}
            arrow={false}
          >
            Enter bag # manually
          </SSPillButton>
        </div>
      </>
    );
  }

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
              }}
            />
          </label>
          <SSPillButton variant="primary" type="submit">
            Confirm bag
          </SSPillButton>
        </form>
      </>
    );
  }

  // SCAN (camera / idle)
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
              setCameraError(null);
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
