'use client';

import { useState } from 'react';
import type { DeclaredBagType } from '@/lib/types/bag';
import {
  SS,
  SSEyebrow,
  SSPillButton,
  SSStickerCard,
} from '@/components/resident/ss/SS';

const MAX_PHOTO_EDGE = 1024;
const STORAGE_MOCKED =
  (process.env.NEXT_PUBLIC_STORAGE_MODE ?? 'mock').toLowerCase() !== 'firebase';

type Step = 'choose_type' | 'photo' | 'submitting' | 'done' | 'error';

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

function ScanHeader({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px 0' }}>
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
  );
}

interface Props {
  bagCode: string;
  onReset: () => void;
  onBackHome: () => void;
}

export default function PostScanFlow({ bagCode, onReset, onBackHome }: Props) {
  const [step, setStep] = useState<Step>('choose_type');
  const [declaredType, setDeclaredType] = useState<DeclaredBagType | null>(null);
  const [photo, setPhoto] = useState<{ base64: string; mime: string; previewUrl: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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
      setStep('error');
    }
  }

  if (step === 'done') {
    return (
      <>
        <div style={{ padding: '24px 24px 0' }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: SS.green,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 900,
              margin: '0 auto 24px',
              border: `4px solid ${SS.ink}`,
              boxShadow: `0 6px 0 ${SS.ink}`,
            }}
          >
            ✓
          </div>
          <SSEyebrow style={{ textAlign: 'center', marginBottom: 8 }}>
            Bag {bagCode} logged
          </SSEyebrow>
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.8,
              lineHeight: 0.95,
              color: SS.ink,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Ready for pickup.
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: SS.inkSoft,
              textAlign: 'center',
              marginBottom: 22,
              padding: '0 12px',
            }}
          >
            Leave it at your doorstep before your pickup time. Points credit after our depot weighs the bag.
          </div>
        </div>
        <div
          style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <SSPillButton variant="primary" onClick={onReset}>
            Scan next bag
          </SSPillButton>
          <SSPillButton variant="outline" onClick={onBackHome} arrow={false}>
            Done — back home
          </SSPillButton>
        </div>
      </>
    );
  }

  if (step === 'error') {
    return (
      <>
        <ScanHeader eyebrow="Submit failed" title="Try again, or rescan." />
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
              {error ?? 'Something went wrong.'}
            </div>
          </div>
          <SSPillButton variant="primary" onClick={() => setStep('choose_type')}>
            Try again
          </SSPillButton>
          <SSPillButton variant="outline" onClick={onReset} arrow={false}>
            Rescan a different bag
          </SSPillButton>
        </div>
      </>
    );
  }

  // choose_type / photo / submitting
  return (
    <>
      <ScanHeader eyebrow="Bag detected" title="Confirm this is yours." />
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
            background: SS.sky,
            border: `2px solid ${SS.ink}`,
            borderRadius: 22,
            padding: 20,
            boxShadow: `0 6px 0 ${SS.ink}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <div>
              <SSEyebrow>Bag #</SSEyebrow>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: -0.8,
                  color: SS.ink,
                  marginTop: 2,
                }}
              >
                {bagCode}
              </div>
            </div>
            <button
              type="button"
              onClick={onReset}
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: SS.sans,
                fontSize: 13,
                fontWeight: 900,
                color: SS.ink,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Change
            </button>
          </div>
        </div>

        <SSStickerCard>
          <SSEyebrow style={{ marginBottom: 10 }}>What&rsquo;s in this bag?</SSEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(
              [
                { k: 'separated' as const, label: 'Separated', sub: '×2 points' },
                { k: 'mixed' as const, label: 'Mixed', sub: 'Base points' },
              ] satisfies { k: DeclaredBagType; label: string; sub: string }[]
            ).map(({ k, label, sub }) => {
              const active = declaredType === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setDeclaredType(k);
                    setStep('photo');
                  }}
                  style={{
                    background: active ? SS.yellow : '#fff',
                    border: `2px solid ${SS.ink}`,
                    borderRadius: 14,
                    padding: '14px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: SS.sans,
                    boxShadow: active ? `0 4px 0 ${SS.ink}` : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: SS.inkSoft, marginTop: 4 }}>
                    {sub}
                  </div>
                </button>
              );
            })}
          </div>
        </SSStickerCard>

        {declaredType && (
          <SSStickerCard>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <SSEyebrow>Doorstep photo</SSEyebrow>
              {STORAGE_MOCKED && (
                <span
                  style={{
                    background: SS.peach,
                    border: `2px solid ${SS.ink}`,
                    borderRadius: 999,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Demo mode
                </span>
              )}
            </div>
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt=""
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 10',
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `2px solid ${SS.ink}`,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  style={{
                    marginTop: 10,
                    background: 'transparent',
                    border: 'none',
                    fontFamily: SS.sans,
                    fontSize: 13,
                    fontWeight: 900,
                    color: SS.ink,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Retake
                </button>
              </>
            ) : (
              <label
                style={{
                  display: 'flex',
                  aspectRatio: '16 / 10',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px dashed ${SS.ink}`,
                  borderRadius: 12,
                  background: SS.line,
                  cursor: 'pointer',
                  fontFamily: SS.sans,
                  fontSize: 15,
                  fontWeight: 900,
                  color: SS.ink,
                }}
              >
                Tap to take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </SSStickerCard>
        )}

        {bagCode && declaredType && photo && (
          <SSPillButton variant="primary" onClick={submit} disabled={step === 'submitting'}>
            {step === 'submitting' ? 'Submitting…' : 'Set out for pickup'}
          </SSPillButton>
        )}
      </div>
    </>
  );
}
