'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { calculatePoints } from '@/lib/logic/calculatePoints';
import {
  CONTAMINATION_SEVERITIES,
  type ContaminationSeverity,
  type MaterialId,
  type MaterialPricing,
} from '@/lib/types/material';
import type { DeclaredBagType } from '@/lib/types/bag';

export interface MaterialDescriptor {
  id: MaterialId;
  name: string;
}

export interface CampaignNotice {
  id: string;
  name: string;
  multiplier: number;
  materialNames: string[];
}

export interface ProcessBagFormProps {
  bagId: string;
  printedNumber: string;
  residentName: string;
  declaredType: DeclaredBagType | null;
  separated: boolean;
  materials: Record<MaterialId, MaterialPricing>;
  /** Ordered list of materials to render in the weight table — already filtered to depot's accepted + active set. */
  materialList: MaterialDescriptor[];
  /** Per-material campaign multipliers (e.g. { aluminum: 2 }). */
  materialMultipliers: Record<MaterialId, number>;
  /** Live campaigns to surface in the form so the worker knows why points are higher. */
  activeCampaignNotices: CampaignNotice[];
  returnHref: string;
}

const SEED_EMOJI: Record<string, string> = {
  aluminum: '🥫',
  tin_steel: '🥫',
  cardboard: '📦',
  paper: '📄',
  pet: '🧴',
  hdpe: '🧴',
  mixed_plastic: '🛍️',
  compost: '🌱',
  textile: '👕',
  electronics: '🔌',
  glass: '🍾',
};

function emojiFor(id: MaterialId): string {
  return SEED_EMOJI[id] ?? '♻️';
}

const CONTAMINATION_LABEL: Record<ContaminationSeverity, string> = {
  none: 'None',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
};

const CONTAMINATION_SUBLABEL: Record<ContaminationSeverity, string> = {
  none: '0%',
  minor: '−30%',
  major: '−60%',
  severe: '−90%',
};

type Step = 'form' | 'submitting' | 'done';

export function ProcessBagForm(props: ProcessBagFormProps) {
  const router = useRouter();
  const visibleIds = useMemo(() => props.materialList.map((m) => m.id), [props.materialList]);

  const [weights, setWeights] = useState<Record<MaterialId, string>>(() => {
    const init: Record<string, string> = {};
    for (const id of visibleIds) init[id] = '';
    return init;
  });
  const [contamination, setContamination] = useState<ContaminationSeverity>('none');
  const [commingled, setCommingled] = useState<boolean>(props.declaredType === 'mixed');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [awarded, setAwarded] = useState<number | null>(null);

  const numericWeights = useMemo(() => {
    const out: Record<string, number> = {};
    for (const id of visibleIds) {
      const n = Number(weights[id]);
      out[id] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return out;
  }, [weights, visibleIds]);

  const totalWeight = useMemo(
    () => visibleIds.reduce((sum, id) => sum + (numericWeights[id] ?? 0), 0),
    [numericWeights, visibleIds],
  );

  const previewPoints = useMemo(() => {
    if (totalWeight <= 0 || commingled) return 0;
    return calculatePoints({
      weights: numericWeights,
      materials: props.materials,
      separated: props.separated,
      contaminationSeverity: contamination,
      materialMultipliers: props.materialMultipliers,
    }).pointsAwarded;
  }, [
    numericWeights,
    totalWeight,
    props.materials,
    props.separated,
    contamination,
    commingled,
    props.materialMultipliers,
  ]);

  async function handleSubmit() {
    if (totalWeight <= 0) return;
    setStep('submitting');
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        bagId: props.bagId,
        weights: Object.fromEntries(
          visibleIds
            .filter((id) => (numericWeights[id] ?? 0) > 0)
            .map((id) => [id, numericWeights[id]]),
        ),
        contaminationSeverity: contamination,
        commingled,
      };
      const res = await fetch('/api/process-bag', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        pointsAwarded?: number;
      };
      if (!res.ok) throw new Error(body.error ?? 'submit_failed');
      setAwarded(body.pointsAwarded ?? previewPoints);
      setStep('done');
      setTimeout(() => {
        router.replace(props.returnHref);
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('form');
    }
  }

  if (step === 'done') {
    return (
      <section className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
        <div className="text-3xl">✅</div>
        <div className="mt-1 text-sm font-semibold text-white">
          +{(awarded ?? 0).toLocaleString()} points awarded
        </div>
        <div className="mt-1 text-xs text-gray-300">Returning to route…</div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
        <Row label="Resident" value={props.residentName} />
        <Row label="Bag" value={`#${props.printedNumber}`} />
        <Row
          label="Declared"
          value={
            props.declaredType === 'separated'
              ? 'Separated (2× multiplier)'
              : props.declaredType === 'mixed'
                ? 'Commingled'
                : '—'
          }
        />
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
          commingled
            ? 'border-blue-400/40 bg-blue-500/10'
            : 'border-white/10 bg-white/5'
        }`}
      >
        <input
          type="checkbox"
          checked={commingled}
          onChange={(e) => setCommingled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40"
        />
        <div className="text-xs">
          <div className="font-semibold text-white">Commingled bag</div>
          <div className="mt-0.5 text-gray-400">
            Contents can&apos;t be sorted (mixed plastic + glass, etc.). Weights are still
            recorded for landfill-diversion reporting, but no points are paid.
          </div>
        </div>
      </label>

      {props.activeCampaignNotices.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            🔥 Active campaign{props.activeCampaignNotices.length === 1 ? '' : 's'}
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-100">
            {props.activeCampaignNotices.map((c) => (
              <li key={c.id}>
                <span className="font-semibold">×{c.multiplier}</span> on{' '}
                {c.materialNames.join(', ')} · {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Contamination</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {CONTAMINATION_SEVERITIES.map((sev) => {
            const active = sev === contamination;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setContamination(sev)}
                className={`rounded-lg px-2 py-2 text-center transition-colors ${
                  active
                    ? sev === 'none'
                      ? 'bg-green-500 text-black'
                      : 'bg-red-500 text-black'
                    : 'border border-white/10 bg-black/30 text-gray-300 hover:bg-white/10'
                }`}
              >
                <div className="text-xs font-semibold">{CONTAMINATION_LABEL[sev]}</div>
                <div className="text-[10px] opacity-80">{CONTAMINATION_SUBLABEL[sev]}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-green-500/20 bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-wide text-green-400">
          ⚖️ Weigh each material
        </div>
        <div className="mt-1 text-[10px] text-gray-500">
          Open bag, sort on the table, weigh separately.
        </div>
        <div className="mt-3 divide-y divide-white/5">
          {props.materialList.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-200">
                <span className="mr-1">{emojiFor(m.id)}</span>
                {m.name}
              </span>
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  type="text"
                  value={weights[m.id] ?? ''}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [m.id]: e.target.value.replace(/[^0-9.]/g, ''),
                    }))
                  }
                  placeholder="0.0"
                  className="w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-right text-sm text-white"
                />
                <span className="text-[11px] text-gray-500">lbs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">
          Total {totalWeight.toFixed(1)} lbs
        </div>
        <div className="mt-1 text-base font-semibold text-white">
          {commingled
            ? 'Diversion-only — 0 points (commingled)'
            : `Auto-calculated: +${previewPoints.toLocaleString()} points`}
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={totalWeight <= 0 || step === 'submitting'}
        className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {step === 'submitting' ? 'Submitting…' : '✓ Submit & next bag'}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}
