'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      router.push('/operator/compost');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-blue-100">
        Recycling cart check — inspect the carts, snap a photo of the cart area, and flag any
        contamination or overflow.
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Recycling</div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {CART_STATUSES.map((s) => {
            const on = cartStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setCartStatus(s)}
                className={`rounded-md border px-2 py-2 text-[12px] font-semibold ${
                  on
                    ? s === 'skipped'
                      ? 'border-red-500/50 bg-red-500/15 text-red-100'
                      : 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                    : 'border-white/10 bg-black/30 text-gray-400'
                }`}
              >
                {CART_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Contamination</div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {CONTAMINATION_SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setContam(sev)}
              className={`rounded-md border px-2 py-1.5 text-[11px] ${
                contam === sev
                  ? sev === 'none'
                    ? 'border-green-500/40 bg-green-500/15 text-green-100'
                    : 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                  : 'border-white/10 bg-black/30 text-gray-400'
              }`}
            >
              {CONTAM_LABELS[sev]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <button
          type="button"
          onClick={() => setOverflow((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
            overflow
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-100'
              : 'border-white/10 bg-black/30 text-gray-300'
          }`}
        >
          <span>🗑️ Cart(s) overflowing</span>
          <span className="text-[11px] font-semibold">{overflow ? 'YES' : 'No'}</span>
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the admin should know? (optional)"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </label>

        <div className="mt-3">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Photo</span>
          {photo ? (
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.preview}
                alt="Cart area"
                className="h-16 w-16 rounded-lg border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="text-[11px] text-gray-400 underline hover:text-gray-200"
              >
                Remove photo
              </button>
            </div>
          ) : (
            <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/30 px-3 py-3 text-xs text-gray-400 hover:bg-white/5">
              {photoBusy ? 'Processing…' : '📷 Add photo of cart area'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                disabled={photoBusy}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Submitting…' : '✓ Record check'}
      </button>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
