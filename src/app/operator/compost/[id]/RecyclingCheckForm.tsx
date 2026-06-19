'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SSOP,
  SSOpCard,
  SSOpChip,
  SSOpEyebrow,
  SSOpPillButton,
  SSOpToggle,
} from '@/components/operator/SSOp';
import { CONTAMINATION_SEVERITIES, type ContaminationSeverity } from '@/lib/types/material';
import { CART_STATUSES, CART_STATUS_LABELS, type CartStatus } from '@/lib/types/siteCheck';

const MAX_PHOTO_EDGE = 1024;

const CONTAM_LABELS: Record<ContaminationSeverity, string> = {
  none: 'None',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
};

/** Downscale + JPEG-compress a captured photo to base64 for upload. */
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
        resolve({ base64: dataUrl.split(',')[1] ?? '', mime: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('image_load_failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

export function RecyclingCheckForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [cartStatus, setCartStatus] = useState<CartStatus>('collected');
  const [contam, setContam] = useState<ContaminationSeverity>('none');
  const [overflow, setOverflow] = useState(false);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const { base64, mime } = await resizeToBase64(file);
      setPhoto({ base64, mime, preview: `data:${mime};base64,${base64}` });
    } catch {
      setError('Could not read that photo. Try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/process-site-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commercialAccountId: accountId,
          cartStatus,
          contaminationSeverity: contam,
          overflow,
          driverNotes: notes.trim() || null,
          photoBase64: photo?.base64 ?? null,
          photoMime: photo?.mime ?? 'image/jpeg',
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? 'submit_failed');
      router.push(`/operator/compost?recorded=${encodeURIComponent(accountId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SSOpCard color={SSOP.sky}>
        <div style={{ fontSize: 13, fontWeight: 800, color: SSOP.ink, lineHeight: 1.4 }}>
          Recycling cart check — inspect the carts, snap a photo of the cart area, and flag any
          contamination or overflow.
        </div>
      </SSOpCard>

      <SSOpCard>
        <SSOpEyebrow mb={10}>Recycling</SSOpEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {CART_STATUSES.map((s) => (
            <SSOpChip
              key={s}
              on={cartStatus === s}
              onClick={() => setCartStatus(s)}
              tone={s === 'skipped' ? 'brand' : 'sky'}
            >
              {CART_STATUS_LABELS[s]}
            </SSOpChip>
          ))}
        </div>
      </SSOpCard>

      <SSOpCard>
        <SSOpEyebrow mb={10}>Contamination</SSOpEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {CONTAMINATION_SEVERITIES.map((sev) => (
            <SSOpChip
              key={sev}
              on={contam === sev}
              onClick={() => setContam(sev)}
              tone={sev === 'none' ? 'green' : 'amber'}
            >
              {CONTAM_LABELS[sev]}
            </SSOpChip>
          ))}
        </div>
      </SSOpCard>

      <SSOpCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>
            🗑️ Cart(s) overflowing
          </span>
          <SSOpToggle on={overflow} onChange={setOverflow} danger label="Carts overflowing" />
        </div>
      </SSOpCard>

      <SSOpCard>
        <SSOpEyebrow mb={8}>Notes</SSOpEyebrow>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything the admin should know? (optional)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#fff',
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontFamily: SSOP.sans,
            fontSize: 14,
            fontWeight: 700,
            color: SSOP.ink,
            resize: 'vertical',
          }}
        />

        <SSOpEyebrow mb={8} style={{ marginTop: 14 }}>
          Photo
        </SSOpEyebrow>
        {photo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview}
              alt="Cart area"
              style={{ width: 64, height: 64, borderRadius: 12, border: `2px solid ${SSOP.ink}`, objectFit: 'cover' }}
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: SSOP.inkSoft,
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 12,
              border: `2px dashed ${SSOP.ink}`,
              background: '#fff',
              padding: '14px',
              fontSize: 13,
              fontWeight: 900,
              color: SSOP.inkSoft,
            }}
          >
            {photoBusy ? 'Processing…' : '📷 Add photo of cart area'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              disabled={photoBusy}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </SSOpCard>

      <SSOpPillButton type="button" onClick={submit} disabled={busy} variant="green" size="lg" rightIcon="✓">
        {busy ? 'Submitting…' : 'Record check'}
      </SSOpPillButton>

      {error && <ErrorCard>{error}</ErrorCard>}
    </div>
  );
}

function ErrorCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: SSOP.brand,
        border: `2px solid ${SSOP.ink}`,
        borderRadius: 14,
        padding: 14,
        color: '#fff',
        fontFamily: SSOP.sans,
        fontSize: 13,
        fontWeight: 900,
        boxShadow: `0 4px 0 ${SSOP.ink}`,
      }}
    >
      {children}
    </div>
  );
}
