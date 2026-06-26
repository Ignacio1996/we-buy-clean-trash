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
import {
  COMPOST_SKIP_REASONS,
  COMPOST_SKIP_REASON_LABELS,
  type CompostSkipReason,
} from '@/lib/types/binPickup';
import type { BinView, MaterialChoice } from './BinPickupForm';

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

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  border: `2px solid ${SSOP.ink}`,
  borderRadius: 12,
  padding: '12px 12px',
  fontFamily: SSOP.sans,
  fontSize: 18,
  fontWeight: 900,
  color: SSOP.ink,
};

function toNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function WeighedPickupForm({
  accountId,
  materials,
  bins,
}: {
  accountId: string;
  materials: MaterialChoice[];
  bins: BinView[];
}) {
  const router = useRouter();
  const [materialId, setMaterialId] = useState<string>(materials[0]?.id ?? '');
  const [bagId, setBagId] = useState<string | null>(bins.length === 1 ? bins[0].bagId : null);
  const [collected, setCollected] = useState(true);
  const [skipReason, setSkipReason] = useState<CompostSkipReason>('facility_closed');
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [contam, setContam] = useState<ContaminationSeverity>('none');
  const [needsCleaning, setNeedsCleaning] = useState(false);
  const [damaged, setDamaged] = useState(false);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grossN = toNum(gross);
  const tareN = toNum(tare);
  const net =
    grossN !== null && tareN !== null && grossN >= tareN
      ? Math.round((grossN - tareN) * 10) / 10
      : null;

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
    if (!materialId) {
      setError('Pick a material.');
      return;
    }
    if (collected) {
      if (grossN === null) {
        setError('Enter the full (gross) weight.');
        return;
      }
      if (tareN === null) {
        setError('Enter the empty-tote (tare) weight.');
        return;
      }
      if (tareN > grossN) {
        setError('Tare can’t be more than the gross weight.');
        return;
      }
      if (net !== null && net <= 0) {
        setError('Net weight is zero — check the numbers.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/process-weighed-pickup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commercialAccountId: accountId,
          materialId,
          collected,
          skipReason: collected ? null : skipReason,
          grossWeightLbs: collected ? grossN : 0,
          tareWeightLbs: collected ? tareN : 0,
          binBagId: bagId,
          contaminationSeverity: contam,
          needsCleaning,
          damaged,
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
          Weighed recycling — collect the recyclables into the tote, then weigh it. Enter the full
          weight and the empty-tote weight; we record the difference.
        </div>
      </SSOpCard>

      {/* Tote / bin */}
      <SSOpCard>
        <SSOpEyebrow mb={10}>Tote</SSOpEyebrow>
        {bins.length === 0 ? (
          <div style={{ fontSize: 13, fontWeight: 800, color: SSOP.inkSoft }}>
            No QR tote provisioned for this site yet — recording without one. Ask the office to
            print a permanent tote label.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bins.map((b) => (
              <SSOpChip
                key={b.bagId}
                on={bagId === b.bagId}
                onClick={() => setBagId(b.bagId)}
                tone="sky"
              >
                {b.printedNumber}
              </SSOpChip>
            ))}
          </div>
        )}
      </SSOpCard>

      {materials.length > 1 && (
        <SSOpCard>
          <SSOpEyebrow mb={10}>Material</SSOpEyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {materials.map((m) => (
              <SSOpChip
                key={m.id}
                on={materialId === m.id}
                onClick={() => setMaterialId(m.id)}
                tone="sky"
              >
                {m.name}
              </SSOpChip>
            ))}
          </div>
        </SSOpCard>
      )}

      {/* Collected vs skipped */}
      <SSOpCard>
        <SSOpEyebrow mb={10}>Pickup</SSOpEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <SSOpChip on={collected} onClick={() => setCollected(true)} tone="green">
            Collected
          </SSOpChip>
          <SSOpChip on={!collected} onClick={() => setCollected(false)} tone="brand">
            Skipped
          </SSOpChip>
        </div>
      </SSOpCard>

      {collected ? (
        <SSOpCard>
          <SSOpEyebrow mb={10}>Weight</SSOpEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: SSOP.inkSoft, textTransform: 'uppercase', letterSpacing: 1 }}>
                Full (gross) lbs
              </span>
              <input
                inputMode="decimal"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                placeholder="0"
                style={{ ...numberInputStyle, marginTop: 6 }}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: SSOP.inkSoft, textTransform: 'uppercase', letterSpacing: 1 }}>
                Empty tote (tare) lbs
              </span>
              <input
                inputMode="decimal"
                value={tare}
                onChange={(e) => setTare(e.target.value)}
                placeholder="0"
                style={{ ...numberInputStyle, marginTop: 6 }}
              />
            </label>
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: net !== null && net > 0 ? SSOP.mint : '#fff',
              border: `2px solid ${SSOP.ink}`,
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, color: SSOP.inkSoft, textTransform: 'uppercase', letterSpacing: 1 }}>
              Net collected
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: SSOP.ink }}>
              {net !== null ? `${net.toLocaleString()} lbs` : '—'}
            </span>
          </div>
        </SSOpCard>
      ) : (
        <SSOpCard>
          <SSOpEyebrow mb={10}>Why skipped?</SSOpEyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COMPOST_SKIP_REASONS.map((r) => (
              <SSOpChip key={r} on={skipReason === r} onClick={() => setSkipReason(r)} tone="amber">
                {COMPOST_SKIP_REASON_LABELS[r]}
              </SSOpChip>
            ))}
          </div>
        </SSOpCard>
      )}

      {collected && (
        <>
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
              <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>🧼 Tote needs cleaning</span>
              <SSOpToggle on={needsCleaning} onChange={setNeedsCleaning} label="Needs cleaning" />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>🛠️ Tote damaged</span>
              <SSOpToggle on={damaged} onChange={setDamaged} danger label="Damaged" />
            </div>
          </SSOpCard>
        </>
      )}

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
              alt="Tote"
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
            {photoBusy ? 'Processing…' : '📷 Add photo of tote'}
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
        {busy ? 'Submitting…' : collected ? 'Record pickup' : 'Record skip'}
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
