'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrScanner } from '@/components/scanner/QrScanner';
import {
  SSOP,
  SSOpBadge,
  SSOpCard,
  SSOpChip,
  SSOpEyebrow,
  SSOpPillButton,
  SSOpToggle,
} from '@/components/operator/SSOp';
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
  seedBinCount = 1,
}: {
  accountId: string;
  defaultBinSize: BinSize;
  bins: BinView[];
  materials: MaterialChoice[];
  /**
   * How many bin rows to start with when the site has no scannable QR bins —
   * the operative bin count from the site profile. Lets a site running at
   * reduced capacity (e.g. 2 of 5 bins) open with the right number of rows so
   * "mark full" reflects real capacity. Clamped to a sane range.
   */
  seedBinCount?: number;
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
  // driver actively picks. If no bins have QR labels, seed one manual row per
  // operative bin (clamped 1..20) so the driver starts with the right count —
  // and can still add/remove rows on-site.
  const initialRows = useMemo<RowState[]>(() => {
    if (bins.length > 0) {
      return bins.map((b) => ({
        key: b.bagId,
        bagId: b.bagId,
        binSize: b.binSize,
        fullness: 0 as FullnessBucket,
      }));
    }
    const rowCount = Math.max(1, Math.min(20, Math.floor(seedBinCount) || 1));
    return Array.from({ length: rowCount }, (_, i) => ({
      key: `manual_${i + 1}`,
      bagId: null,
      binSize: defaultBinSize,
      fullness: 0 as FullnessBucket,
    }));
  }, [bins, defaultBinSize, seedBinCount]);
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
      router.push(`/operator/compost?recorded=${encodeURIComponent(accountId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
    } finally {
      setBusy(false);
    }
  }

  if (materials.length === 0) {
    return (
      <SSOpCard color={SSOP.yellow}>
        <div style={{ fontSize: 14, fontWeight: 800, color: SSOP.ink, lineHeight: 1.4 }}>
          No bin-fullness materials are enabled for this site. Ask the admin to add a compost
          material to the site profile.
        </div>
      </SSOpCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stop status — what happened at this stop */}
      <SSOpCard>
        <SSOpEyebrow mb={10}>Status</SSOpEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {VISIBLE_ACTIONS.map((a) => (
            <SSOpChip
              key={a}
              on={action === a}
              onClick={() => setAction(a)}
              tone={a === 'skipped' ? 'brand' : 'green'}
            >
              {ACTION_LABELS[a]}
            </SSOpChip>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: SSOP.inkSoft }}>
          {ACTION_HINTS[action]}
        </div>
      </SSOpCard>

      {isSkip ? (
        <SSOpCard>
          <SSOpEyebrow mb={10}>Why was it skipped?</SSOpEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {COMPOST_SKIP_REASONS.map((reason) => (
              <SSOpChip
                key={reason}
                on={skipReason === reason}
                onClick={() => setSkipReason(reason)}
                tone="brand"
              >
                {COMPOST_SKIP_REASON_LABELS[reason]}
              </SSOpChip>
            ))}
          </div>
        </SSOpCard>
      ) : (
        <>
      {SHOW_BIN_SCANNER && (
      <SSOpCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: SSOP.ink }}>Scan a bin</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 2 }}>
              Point the camera at a bin&apos;s QR label to set its fullness.
            </div>
          </div>
          <SSOpChip
            on={scanOpen}
            onClick={() => {
              setScanMessage(null);
              setScanOpen((v) => !v);
            }}
            tone="sky"
            style={{ width: 'auto', whiteSpace: 'nowrap', padding: '10px 14px' }}
          >
            {scanOpen ? 'Close scanner' : '📷 Scan bin'}
          </SSOpChip>
        </div>

        {scanOpen && (
          <div style={{ marginTop: 12 }}>
            <QrScanner
              onDetected={handleScan}
              manualPlaceholder="Or type the bin number (BIN-1234)"
              scanInstructions="📷 Tap to scan a bin QR"
            />
          </div>
        )}

        {scanMessage && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: `2px solid ${SSOP.ink}`,
              background: scanMessage.tone === 'ok' ? SSOP.mint : SSOP.yellow,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 800,
              color: SSOP.ink,
            }}
          >
            {scanMessage.text}
          </div>
        )}
      </SSOpCard>
      )}

      <SSOpCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: SSOP.ink }}>Bins</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 2 }}>
              {bins.length > 0
                ? `${bins.length} bin${bins.length === 1 ? '' : 's'} provisioned`
                : 'Tap a fullness for each bin. Add more bins below.'}
            </div>
          </div>
          <SSOpChip
            on={false}
            onClick={() => addManualRow()}
            tone="sky"
            style={{ width: 'auto', whiteSpace: 'nowrap', padding: '10px 14px' }}
          >
            + Add bin
          </SSOpChip>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => {
            const bin = r.bagId ? bins.find((b) => b.bagId === r.bagId) : null;
            const highlighted = highlightKey === r.key;
            return (
              <div
                key={r.key}
                id={`binrow-${r.key}`}
                style={{
                  borderRadius: 14,
                  border: `2px solid ${highlighted ? SSOP.brand : '#D6D6D6'}`,
                  background: '#fff',
                  padding: 12,
                  boxShadow: `0 3px 0 ${highlighted ? SSOP.brand : '#D6D6D6'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {bin ? (
                      <span style={{ fontFamily: SSOP.mono, fontSize: 13, fontWeight: 900, color: SSOP.ink }}>
                        {bin.printedNumber}
                      </span>
                    ) : r.scannedCode ? (
                      <SSOpBadge bg={SSOP.amber} fg="#fff">
                        {r.scannedCode}
                      </SSOpBadge>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 900, color: SSOP.inkSoft }}>
                        Manual entry
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft }}>
                      {BIN_DISPLAY_NAMES[r.binSize]}
                    </span>
                  </div>
                  {!r.bagId && rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: SSOP.inkSoft,
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!r.bagId && (
                  <select
                    value={r.binSize}
                    onChange={(e) => setRow(r.key, { binSize: e.target.value as BinSize })}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: `2px solid ${SSOP.ink}`,
                      background: '#fff',
                      padding: '8px 10px',
                      fontFamily: SSOP.sans,
                      fontSize: 13,
                      fontWeight: 900,
                      color: SSOP.ink,
                    }}
                  >
                    {BIN_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {BIN_DISPLAY_NAMES[s]}
                      </option>
                    ))}
                  </select>
                )}

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {FULLNESS_BUCKETS.map((f) => (
                    <SSOpChip
                      key={f}
                      on={r.fullness === f}
                      onClick={() => setRow(r.key, { fullness: f })}
                      tone="sky"
                      style={{ padding: '8px 2px' }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 900 }}>{f === 0 ? '0' : `${f * 100}%`}</div>
                      <div style={{ fontSize: 9, fontWeight: 800, marginTop: 2 }}>{FULLNESS_LABELS[f]}</div>
                    </SSOpChip>
                  ))}
                </div>
                <div style={{ marginTop: 8, textAlign: 'right', fontSize: 11, fontWeight: 800, color: SSOP.inkSoft }}>
                  ≈ {BIN_WEIGHT_TABLE[r.binSize][r.fullness].weightLbs} lbs
                </div>
              </div>
            );
          })}
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

      {/* Bin condition flags — feed the cart-cleaning + replacement queues */}
      <SSOpCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>🧼 Bin(s) need cleaning</span>
            <SSOpToggle on={needsCleaning} onChange={setNeedsCleaning} label="Bins need cleaning" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>
              🛠️ Bin damaged — needs replacement
            </span>
            <SSOpToggle on={damaged} onChange={setDamaged} danger label="Bin damaged" />
          </div>
        </div>
      </SSOpCard>

      <SSOpCard color={SSOP.sky}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <SSOpEyebrow mb={0}>Total weight</SSOpEyebrow>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, color: SSOP.ink }}>
            {totalLbs} lbs
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: SSOP.inkSoft }}>
          {filledCount} of {rows.length} bin{rows.length === 1 ? '' : 's'} with content
        </div>
      </SSOpCard>
        </>
      )}

      {/* Notes + photo — shared across collect/skip */}
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
              alt="Pickup"
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
            {photoBusy ? 'Processing…' : '📷 Add photo (optional)'}
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

      <SSOpPillButton
        type="button"
        onClick={submit}
        disabled={busy || (isSkip ? !skipReason : filledCount === 0)}
        variant={isSkip ? 'brand' : 'green'}
        size="lg"
        rightIcon={isSkip ? '✕' : '✓'}
      >
        {busy ? 'Submitting…' : isSkip ? 'Record skip' : 'Record pickup'}
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
