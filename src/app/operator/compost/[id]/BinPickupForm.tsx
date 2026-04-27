'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  const [materialId, setMaterialId] = useState<MaterialId>(materials[0]?.id ?? '');
  const [contam, setContam] = useState<ContaminationSeverity>('none');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const anyInterpolated = rows.some(
    (r) => BIN_WEIGHT_TABLE[r.binSize][r.fullness].interpolated === true,
  );
  const filledCount = rows.filter((r) => r.fullness > 0).length;

  function setRow(key: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addManualRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `manual_${prev.length + 1}_${Date.now()}`,
        bagId: null,
        binSize: defaultBinSize,
        fullness: 0 as FullnessBucket,
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  async function submit() {
    if (!materialId) {
      setError('Pick a material.');
      return;
    }
    if (filledCount === 0) {
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
          bins: rows
            .filter((r) => r.fullness > 0)
            .map((r) => ({ bagId: r.bagId, binSize: r.binSize, fullness: r.fullness })),
          contaminationSeverity: contam,
          driverNotes: notes.trim() || null,
          photoBase64: null,
          photoMime: 'image/jpeg',
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
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Material</span>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Bins</div>
            <div className="text-[11px] text-gray-500">
              {bins.length > 0
                ? `${bins.length} bin${bins.length === 1 ? '' : 's'} provisioned`
                : 'Manual entry — no bins provisioned yet'}
            </div>
          </div>
          <button
            type="button"
            onClick={addManualRow}
            className="text-[11px] text-blue-300 underline hover:text-blue-200"
          >
            + Manual bin
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((r) => {
            const bin = r.bagId ? bins.find((b) => b.bagId === r.bagId) : null;
            return (
              <div
                key={r.key}
                className="rounded-lg border border-white/10 bg-black/30 p-3"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    {bin ? (
                      <span className="font-mono text-white">{bin.printedNumber}</span>
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
                  {BIN_WEIGHT_TABLE[r.binSize][r.fullness].interpolated && (
                    <span className="ml-1 text-amber-300/80">(estimated)</span>
                  )}
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

        <label className="mt-3 block">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the admin should know? (optional)"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </label>
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] uppercase tracking-wide text-blue-200/70">Total weight</div>
          <div className="text-2xl font-bold text-white">{totalLbs} lbs</div>
        </div>
        <div className="mt-1 text-[11px] text-blue-200/70">
          {filledCount} of {rows.length} bin{rows.length === 1 ? '' : 's'} with content
          {anyInterpolated && ' · contains interpolated 48-gal estimates'}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || filledCount === 0}
        className="w-full rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? 'Submitting…' : '✓ Record pickup'}
      </button>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
