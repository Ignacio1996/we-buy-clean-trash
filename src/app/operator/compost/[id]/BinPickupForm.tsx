'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrScanner } from '@/components/scanner/QrScanner';
import {
  BIN_DISPLAY_NAMES,
  BIN_SIZES,
  BIN_WEIGHT_TABLE,
  FULLNESS_BUCKETS,
  type BinSize,
  type FullnessBucket,
} from '@/lib/logic/binWeightTable';
import {
  CONTAMINATION_SEVERITIES,
  type ContaminationSeverity,
  type MaterialId,
} from '@/lib/types/material';
import {
  COMPOST_SKIP_REASONS,
  COMPOST_SKIP_REASON_LABELS,
  type BinPickupAction,
  type CompostSkipReason,
} from '@/lib/types/binPickup';

export interface BinView {
  bagId: string;
  printedNumber: string;
  qrCode: string;
  binSize: BinSize;
}

export interface MaterialChoice {
  id: MaterialId;
  name: string;
}

interface RowState {
  /** Stable key for React. Either the bagId (provisioned bins) or 'manual_<n>' (ad-hoc). */
  key: string;
  bagId: string | null;
  binSize: BinSize;
  fullness: FullnessBucket;
  /** QR code scanned for an ad-hoc bin not on this site's provisioned list. */
  scannedCode?: string;
}

/** Normalize a scanned/typed bin code for matching (e.g. ' bin-1234 ' → 'BIN-1234'). */
function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

const MAX_PHOTO_EDGE = 1024;

/** Downscale + JPEG-compress a captured photo to a base64 string for upload. */
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

const FULLNESS_LABELS: Record<FullnessBucket, string> = {
  0: 'Empty',
  0.25: '¼ full',
  0.5: '½ full',
  0.75: '¾ full',
  1: 'Full',
};

const CONTAM_LABELS: Record<ContaminationSeverity, string> = {
  none: 'None',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
};

const ACTION_LABELS: Record<BinPickupAction, string> = {
  swapped: 'Collected',
  loaded: 'Loaded',
  skipped: 'Skipped',
};

const ACTION_HINTS: Record<BinPickupAction, string> = {
  swapped: 'Bins collected this stop',
  loaded: 'Dumped into the truck, set the same bins back',
  skipped: 'Nothing collected this stop',
};

/**
 * Actions shown to the driver. The swap-vs-loaded distinction is no longer
 * tracked in the field (City of Columbus now collects everything every run), so
 * the picker is just Collected / Skipped. "Collected" stores as `swapped` so the
 * existing reporting (cartsSwapped, weights) keeps working.
 */
const VISIBLE_ACTIONS: readonly BinPickupAction[] = ['swapped', 'skipped'];

/**
 * Bin QR scanning is hidden for the pilot — Tia's drivers enter bins manually.
 * The scanner + handlers stay wired so this can flip back on if QR labels (or
 * yard-sign QRs) get used later.
 */
const SHOW_BIN_SCANNER = false;

export function BinPickupForm({
  accountId,
  defaultBinSize,
  bins,
  materials,
}: {
  accountId: string;
  defaultBinSize: BinSize;
  bins: BinView[];
  materials: MaterialChoice[];
}) {
  const router = useRouter();

  // Always the site's single food-scrap material — no picker shown to the driver.
  const materialId: MaterialId = materials[0]?.id ?? '';
  const [action, setAction] = useState<BinPickupAction>('swapped');
  const [skipReason, setSkipReason] = useState<CompostSkipReason | null>(null);
  const [needsCleaning, setNeedsCleaning] = useState(false);
  const [damaged, setDamaged] = useState(false);
  const [contam, setContam] = useState<ContaminationSeverity>('none');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<
    { tone: 'ok' | 'warn'; text: string } | null
  >(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
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

  // Seed rows: one per provisioned bin, fullness defaults to empty so the
  // driver actively picks. If no bins are provisioned, start with one manual row.
  const initialRows = useMemo<RowState[]>(() => {
    if (bins.length > 0) {
      return bins.map((b) => ({
        key: b.bagId,
        bagId: b.bagId,
        binSize: b.binSize,
        fullness: 0 as FullnessBucket,
      }));
    }
    return [
      {
        key: 'manual_1',
        bagId: null,
        binSize: defaultBinSize,
        fullness: 0 as FullnessBucket,
      },
    ];
  }, [bins, defaultBinSize]);
  const [rows, setRows] = useState<RowState[]>(initialRows);

  const totalLbs = rows.reduce(
    (sum, r) => sum + BIN_WEIGHT_TABLE[r.binSize][r.fullness].weightLbs,
    0,
  );
  const filledCount = rows.filter((r) => r.fullness > 0).length;

  function setRow(key: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addManualRow(scannedCode?: string) {
    const key = `manual_${Date.now()}`;
    setRows((prev) => [
      ...prev,
      {
        key,
        bagId: null,
        binSize: defaultBinSize,
        fullness: 0 as FullnessBucket,
        scannedCode,
      },
    ]);
    return key;
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  /** Briefly highlight a row and scroll it into view so the driver sets fullness. */
  function focusRow(key: string) {
    setHighlightKey(key);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`binrow-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      window.setTimeout(() => setHighlightKey((cur) => (cur === key ? null : cur)), 2500);
    }
  }

  function handleScan(raw: string) {
    const code = normalizeCode(raw);
    if (!code) return;

    // 1. Match a provisioned bin (printed label QR == bin's qrCode/printedNumber).
    const bin = bins.find(
      (b) => normalizeCode(b.qrCode) === code || normalizeCode(b.printedNumber) === code,
    );
    if (bin) {
      focusRow(bin.bagId);
      setScanMessage({ tone: 'ok', text: `✓ ${bin.printedNumber} — set its fullness below.` });
      return;
    }

    // 2. Already added as an ad-hoc row this session — just re-focus it.
    const existing = rows.find((r) => r.scannedCode && normalizeCode(r.scannedCode) === code);
    if (existing) {
      focusRow(existing.key);
      setScanMessage({ tone: 'ok', text: `${code} already added — set its fullness below.` });
      return;
    }

    // 3. Unknown code — not provisioned to this site. Add as a manual bin so the
    // stop still records, but warn the driver in case they're at the wrong site.
    const key = addManualRow(code);
    focusRow(key);
    setScanMessage({
      tone: 'warn',
      text: `${code} isn't on this site's bin list — added as a manual bin. Double-check you're at the right stop.`,
    });
  }

  const isSkip = action === 'skipped';

  async function submit() {
    if (!materialId) {
      setError('Pick a material.');
      return;
    }
    if (isSkip) {
      if (!skipReason) {
        setError('Pick a reason for skipping.');
        return;
      }
    } else if (filledCount === 0) {
      setError('Set fullness on at least one bin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/process-bin-pickup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commercialAccountId: accountId,
          materialId,
          action,
          skipReason: isSkip ? skipReason : null,
          bins: isSkip
            ? []
            : rows
                .filter((r) => r.fullness > 0)
                .map((r) => ({ bagId: r.bagId, binSize: r.binSize, fullness: r.fullness })),
          contaminationSeverity: isSkip ? 'none' : contam,
          needsCleaning: isSkip ? false : needsCleaning,
          damaged: isSkip ? false : damaged,
          driverNotes: notes.trim() || null,
          photoBase64: photo?.base64 ?? null,
          photoMime: photo?.mime ?? 'image/jpeg',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'submit_failed');
      }
      router.push('/operator/compost');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
    } finally {
      setBusy(false);
    }
  }

  if (materials.length === 0) {
    return (
      <section className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        No bin-fullness materials are enabled for this site. Ask the admin to add a compost
        material to the site profile.
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-4">
      {/* Stop status — what happened at this stop */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">Status</div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {VISIBLE_ACTIONS.map((a) => {
            const on = action === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`rounded-md border px-2 py-2 text-[12px] font-semibold ${
                  on
                    ? a === 'skipped'
                      ? 'border-red-500/50 bg-red-500/15 text-red-100'
                      : 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                    : 'border-white/10 bg-black/30 text-gray-400'
                }`}
              >
                {ACTION_LABELS[a]}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-gray-500">{ACTION_HINTS[action]}</div>
      </div>

      {isSkip ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-[11px] uppercase tracking-wide text-red-200/80">
            Why was it skipped?
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {COMPOST_SKIP_REASONS.map((reason) => {
              const on = skipReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSkipReason(reason)}
                  className={`rounded-md border px-2 py-2 text-[12px] ${
                    on
                      ? 'border-red-400/60 bg-red-500/25 text-red-50'
                      : 'border-white/10 bg-black/30 text-gray-300'
                  }`}
                >
                  {COMPOST_SKIP_REASON_LABELS[reason]}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
      {SHOW_BIN_SCANNER && (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Scan a bin</div>
            <div className="text-[11px] text-gray-500">
              Point the camera at a bin&apos;s QR label to set its fullness.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setScanMessage(null);
              setScanOpen((v) => !v);
            }}
            className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
              scanOpen
                ? 'border-white/15 bg-black/30 text-gray-300'
                : 'border-blue-400/50 bg-blue-500/20 text-blue-100'
            }`}
          >
            {scanOpen ? 'Close scanner' : '📷 Scan bin'}
          </button>
        </div>

        {scanOpen && (
          <div className="mt-3">
            <QrScanner
              onDetected={handleScan}
              manualPlaceholder="Or type the bin number (BIN-1234)"
              scanInstructions="📷 Tap to scan a bin QR"
            />
          </div>
        )}

        {scanMessage && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              scanMessage.tone === 'ok'
                ? 'border-green-500/30 bg-green-500/10 text-green-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
            }`}
          >
            {scanMessage.text}
          </p>
        )}
      </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Bins</div>
            <div className="text-[11px] text-gray-500">
              {bins.length > 0
                ? `${bins.length} bin${bins.length === 1 ? '' : 's'} provisioned`
                : 'Tap a fullness for each bin. Add more bins below.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => addManualRow()}
            className="rounded-md border border-blue-400/50 bg-blue-500/20 px-3 py-1.5 text-[12px] font-semibold text-blue-100"
          >
            + Add bin
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((r) => {
            const bin = r.bagId ? bins.find((b) => b.bagId === r.bagId) : null;
            return (
              <div
                key={r.key}
                id={`binrow-${r.key}`}
                className={`rounded-lg border bg-black/30 p-3 transition-colors ${
                  highlightKey === r.key
                    ? 'border-blue-400/70 ring-2 ring-blue-400/40'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    {bin ? (
                      <span className="font-mono text-white">{bin.printedNumber}</span>
                    ) : r.scannedCode ? (
                      <span className="font-mono text-amber-200">{r.scannedCode}</span>
                    ) : (
                      <span className="text-gray-400">Manual entry</span>
                    )}
                    <span className="ml-2 text-gray-500">{BIN_DISPLAY_NAMES[r.binSize]}</span>
                  </div>
                  {!r.bagId && rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="text-[11px] text-gray-400 hover:text-gray-200"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!r.bagId && (
                  <select
                    value={r.binSize}
                    onChange={(e) => setRow(r.key, { binSize: e.target.value as BinSize })}
                    className="mt-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                  >
                    {BIN_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {BIN_DISPLAY_NAMES[s]}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-3 grid grid-cols-5 gap-1">
                  {FULLNESS_BUCKETS.map((f) => {
                    const active = r.fullness === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setRow(r.key, { fullness: f })}
                        className={`rounded-md border px-1 py-2 text-[10px] transition-colors ${
                          active
                            ? 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                            : 'border-white/10 bg-black/30 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-sm font-semibold">
                          {f === 0 ? '0' : `${f * 100}%`}
                        </div>
                        <div className="mt-0.5">{FULLNESS_LABELS[f]}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-right text-[10px] text-gray-500">
                  ≈ {BIN_WEIGHT_TABLE[r.binSize][r.fullness].weightLbs} lbs
                </div>
              </div>
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

      {/* Bin condition flags — feed the cart-cleaning + replacement queues */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <button
          type="button"
          onClick={() => setNeedsCleaning((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
            needsCleaning
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-100'
              : 'border-white/10 bg-black/30 text-gray-300'
          }`}
        >
          <span>🧼 Bin(s) need cleaning</span>
          <span className="text-[11px] font-semibold">{needsCleaning ? 'YES' : 'No'}</span>
        </button>
        <button
          type="button"
          onClick={() => setDamaged((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
            damaged
              ? 'border-red-500/50 bg-red-500/15 text-red-100'
              : 'border-white/10 bg-black/30 text-gray-300'
          }`}
        >
          <span>🛠️ Bin damaged — needs replacement</span>
          <span className="text-[11px] font-semibold">{damaged ? 'YES' : 'No'}</span>
        </button>
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] uppercase tracking-wide text-blue-200/70">Total weight</div>
          <div className="text-2xl font-bold text-white">{totalLbs} lbs</div>
        </div>
        <div className="mt-1 text-[11px] text-blue-200/70">
          {filledCount} of {rows.length} bin{rows.length === 1 ? '' : 's'} with content
        </div>
      </div>
        </>
      )}

      {/* Notes + photo — shared across collect/skip */}
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
                alt="Pickup"
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
              {photoBusy ? 'Processing…' : '📷 Add photo (optional)'}
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
        disabled={busy || (isSkip ? !skipReason : filledCount === 0)}
        className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-black disabled:opacity-50 ${
          isSkip ? 'bg-red-400' : 'bg-green-500'
        }`}
      >
        {busy ? 'Submitting…' : isSkip ? '✕ Record skip' : '✓ Record pickup'}
      </button>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
