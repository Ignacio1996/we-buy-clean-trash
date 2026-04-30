'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import type { ScanResult, ScannedItem } from '@/lib/ai/scan';
import {
  clearPresignupScan,
  readPresignupScan,
  writePresignupScan,
} from '@/lib/presignup/scan-storage';
import { IconArrow, IconScan } from '@/components/icons/EcoIcons';

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
    <div style={shellStyle}>
      <Grain />

      <div style={contentStyle}>
        {/* Masthead — double-rule with VOL · wordmark · EST */}
        <div style={mastheadStyle}>
          <span style={mastheadMetaStyle}>VOL. I · NO. 01</span>
          <span style={mastheadWordmarkStyle}>We Buy Clean Trash</span>
          <span style={mastheadMetaStyle}>EST. 2025</span>
        </div>

        {/* Hero */}
        <div style={eyebrowStyle}>Try before you join</div>
        <h1 style={heroTitleStyle}>
          What is your
          <br />
          trash <em style={{ fontStyle: 'italic', color: 'var(--green)' }}>worth</em>?
        </h1>
        <p style={leadStyle}>
          Point your camera. We&rsquo;ll tally a price. No account needed.
        </p>

        {/* Camera card — three states */}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              border: '1px solid rgba(154,75,38,0.3)',
              background: 'var(--rust-soft)',
              borderRadius: 12,
              fontFamily: 'var(--eco-serif)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--rust)',
            }}
          >
            {error}
          </div>
        )}

        {hasItems ? (
          <>
            {/* Running total — masthead-style */}
            <div style={tallyBlockStyle}>
              <div style={{ ...eyebrowStyle, marginBottom: 6, letterSpacing: 1.6 }}>
                Estimated earnings · {items.length} item{items.length === 1 ? '' : 's'}
              </div>
              <div style={tallyAmountStyle}>
                <em style={{ fontStyle: 'italic' }}>${totalDollars.toFixed(2)}</em>
              </div>
              <div style={tallySubStyle}>
                {formatPoints(totalPoints)} points · saved if you sign up.
              </div>
            </div>

            {/* Itemized ledger */}
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 6,
                }}
              >
                <span style={{ ...eyebrowStyle, marginBottom: 0 }}>Itemized</span>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  style={clearBtnStyle}
                >
                  Clear
                </button>
              </div>
              <div>
                {items.map((it, i) => (
                  <div key={`${it.label}-${i}`} style={ledgerRowStyle}>
                    <span style={ledgerLabelStyle}>{it.label}</span>
                    <span style={ledgerValueStyle}>
                      ${it.estimatedDollars.toFixed(2)} · {formatPoints(it.estimatedPoints)} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          // Almanac fact box — only when empty
          <AlmanacBox />
        )}

        {/* CTA — sign up */}
        <Link href="/signup" style={signUpBtnStyle}>
          <span>{hasItems ? 'Sign up & save these earnings' : 'Sign up to start earning'}</span>
          <IconArrow size={16} color="var(--paper)" />
        </Link>

        <p style={signInLinkStyle}>
          Already a member?{' '}
          <Link href="/login" style={{ color: 'var(--green)', fontWeight: 600, fontStyle: 'normal' }}>
            Sign in
          </Link>
        </p>
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
  if (cameraOn) {
    return (
      <div style={cameraOnCardStyle}>
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
        {/* dim grain overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.03) 1px, transparent 2px)',
            backgroundSize: '8px 8px, 14px 14px',
          }}
        />
        {/* reticule */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '12% 14% 28%',
            border: '1px solid rgba(251,247,238,0.33)',
            borderRadius: 6,
          }}
        >
          <ReticuleCorner pos="tl" />
          <ReticuleCorner pos="tr" />
          <ReticuleCorner pos="bl" />
          <ReticuleCorner pos="br" />
        </div>
        {/* status pill */}
        <div style={scanningChipStyle}>{scanning ? 'ANALYZING…' : 'SCANNING…'}</div>
        {/* capture button */}
        <button
          type="button"
          onClick={onCapture}
          disabled={scanning}
          style={{
            ...captureBtnStyle,
            opacity: scanning ? 0.7 : 1,
            cursor: scanning ? 'default' : 'pointer',
          }}
        >
          <IconScan size={14} color="var(--paper)" />
          <span>{scanning ? 'Scanning…' : 'Capture'}</span>
        </button>
      </div>
    );
  }

  return (
    <div style={cameraEmptyCardStyle}>
      <div style={cameraIconCircleStyle}>
        <IconScan size={26} color="var(--green)" stroke={1.5} />
      </div>
      <div style={cameraEmptyTitleStyle}>Point at any recyclable.</div>
      <div style={cameraEmptyLedeStyle}>
        Cans, bottles, jars — we&rsquo;ll guess the price.
      </div>
      <button type="button" onClick={onOpen} style={openCameraBtnStyle}>
        <IconScan size={14} color="var(--paper)" />
        <span>Open camera</span>
      </button>
      <button type="button" onClick={onPickFile} style={uploadLinkStyle}>
        or upload a photo
      </button>
    </div>
  );
}

function ReticuleCorner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base: CSSProperties = {
    position: 'absolute',
    width: 14,
    height: 14,
  };
  const pe: CSSProperties = {
    ...base,
    ...(pos === 'tl' && {
      top: -1,
      left: -1,
      borderTop: '2px solid var(--green)',
      borderLeft: '2px solid var(--green)',
    }),
    ...(pos === 'tr' && {
      top: -1,
      right: -1,
      borderTop: '2px solid var(--green)',
      borderRight: '2px solid var(--green)',
    }),
    ...(pos === 'bl' && {
      bottom: -1,
      left: -1,
      borderBottom: '2px solid var(--green)',
      borderLeft: '2px solid var(--green)',
    }),
    ...(pos === 'br' && {
      bottom: -1,
      right: -1,
      borderBottom: '2px solid var(--green)',
      borderRight: '2px solid var(--green)',
    }),
  };
  return <div style={pe} aria-hidden />;
}

function AlmanacBox() {
  const rows: Array<[string, string]> = [
    ['Aluminum', '$0.05 / can'],
    ['PET (32oz)', '$0.10 / bottle'],
    ['Glass', '$0.06 / bottle'],
  ];
  return (
    <div style={almanacBoxStyle}>
      <div style={almanacQuoteStyle}>
        &ldquo;About 100 cans a week earns a $10 gift card every month.&rdquo;
      </div>
      <div style={{ borderTop: '1px solid var(--line-soft)' }}>
        {rows.map(([l, v]) => (
          <div key={l} style={almanacRowStyle}>
            <span style={{ ...eyebrowStyle, marginBottom: 0 }}>{l}</span>
            <span style={almanacValueStyle}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Grain(): ReactNode {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.4,
        pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(160,140,100,0.06) 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(160,140,100,0.05) 1px, transparent 2px)',
        backgroundSize: '14px 14px, 22px 22px',
      }}
    />
  );
}

const shellStyle: CSSProperties = {
  width: '100%',
  minHeight: '100dvh',
  background: 'var(--paper-bg)',
  color: 'var(--ink)',
  fontFamily: 'var(--eco-sans)',
  position: 'relative',
  overflow: 'hidden',
};

const contentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '20px 22px 24px',
  maxWidth: 480,
  margin: '0 auto',
  width: '100%',
  boxSizing: 'border-box',
};

const mastheadStyle: CSSProperties = {
  borderTop: '2px solid var(--ink)',
  borderBottom: '1px solid var(--line)',
  padding: '8px 0 10px',
  marginBottom: 14,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 8,
};

const mastheadMetaStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 9,
  color: 'var(--ink-soft)',
  letterSpacing: 2,
};

const mastheadWordmarkStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 14,
  color: 'var(--green)',
  flex: 1,
  textAlign: 'center',
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: 1.6,
  fontWeight: 500,
  fontFamily: 'var(--eco-sans)',
  marginBottom: 8,
};

const heroTitleStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontSize: 26,
  lineHeight: 1.05,
  fontWeight: 400,
  letterSpacing: -0.6,
  margin: '0 0 6px',
  color: 'var(--ink)',
};

const leadStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 13,
  color: 'var(--ink-soft)',
  lineHeight: 1.45,
  margin: '0 0 14px',
};

const cameraEmptyCardStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 14,
  overflow: 'hidden',
  border: '1px dashed var(--line)',
  background: 'var(--paper)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '18px 20px 16px',
  textAlign: 'center',
};

const cameraIconCircleStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'var(--green-soft)',
  color: 'var(--green)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 10,
};

const cameraEmptyTitleStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontSize: 16,
  color: 'var(--ink)',
  marginBottom: 4,
};

const cameraEmptyLedeStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 12,
  color: 'var(--ink-soft)',
  lineHeight: 1.4,
  marginBottom: 12,
};

const openCameraBtnStyle: CSSProperties = {
  background: 'var(--green)',
  color: 'var(--paper)',
  border: 'none',
  padding: '11px 22px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--eco-sans)',
  letterSpacing: 0.4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const uploadLinkStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-soft)',
  marginTop: 12,
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  background: 'transparent',
  border: 'none',
  padding: 4,
  cursor: 'pointer',
};

const cameraOnCardStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 14,
  overflow: 'hidden',
  border: '1px solid var(--line)',
  background: '#1a1f1c',
  aspectRatio: '4 / 3',
};

const scanningChipStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 9,
  color: 'var(--paper)',
  letterSpacing: 1.5,
  background: 'rgba(0,0,0,0.4)',
  padding: '4px 8px',
  borderRadius: 4,
};

const captureBtnStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 16,
  transform: 'translateX(-50%)',
  background: 'var(--green)',
  color: 'var(--paper)',
  border: 'none',
  padding: '12px 28px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--eco-sans)',
  letterSpacing: 0.4,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const tallyBlockStyle: CSSProperties = {
  borderTop: '1px solid var(--line)',
  borderBottom: '1px solid var(--line)',
  padding: '14px 0',
  margin: '20px 0 14px',
  textAlign: 'center',
};

const tallyAmountStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontSize: 44,
  lineHeight: 1,
  color: 'var(--green)',
  fontWeight: 400,
  letterSpacing: -1,
};

const tallySubStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 12,
  color: 'var(--ink-soft)',
  marginTop: 8,
};

const clearBtnStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 11,
  color: 'var(--green)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  padding: 0,
};

const ledgerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '10px 0',
  borderBottom: '1px solid var(--line-soft)',
};

const ledgerLabelStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontSize: 14,
  color: 'var(--ink)',
};

const ledgerValueStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 12,
  color: 'var(--ink-soft)',
};

const almanacBoxStyle: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 14,
  marginTop: 12,
  marginBottom: 14,
};

const almanacQuoteStyle: CSSProperties = {
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
  fontSize: 13,
  color: 'var(--ink)',
  lineHeight: 1.45,
  marginBottom: 12,
};

const almanacRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '8px 0',
  borderBottom: '1px solid var(--line-soft)',
};

const almanacValueStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 12,
  color: 'var(--ink)',
};

const signUpBtnStyle: CSSProperties = {
  width: '100%',
  background: 'var(--green)',
  color: 'var(--paper)',
  border: 'none',
  borderRadius: 14,
  padding: '14px 18px',
  fontFamily: 'var(--eco-sans)',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: 0.3,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  marginTop: 4,
  marginBottom: 10,
  textDecoration: 'none',
  boxSizing: 'border-box',
};

const signInLinkStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 11,
  color: 'var(--ink-soft)',
  fontFamily: 'var(--eco-serif)',
  fontStyle: 'italic',
};
