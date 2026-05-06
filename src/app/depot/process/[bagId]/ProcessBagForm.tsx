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
import {
  DP_TOK,
  DpAlert,
  DpEyebrow,
  DpPaper,
  DpPrimaryButton,
  DpRow,
} from '@/components/depot/Dp';
import { IconCheck, IconFire } from '@/components/icons/EcoIcons';

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
      <div
        className="px-5 py-8 text-center"
        style={{
          background: DP_TOK.greenSoft,
          border: `1px solid rgba(45,90,61,0.3)`,
          borderRadius: 14,
        }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: DP_TOK.green }}
        >
          <IconCheck size={20} color={DP_TOK.paper} stroke={2.5} />
        </div>
        <div
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 22,
            color: DP_TOK.ink,
            letterSpacing: -0.4,
            fontFeatureSettings: '"lnum","tnum"',
          }}
        >
          +{(awarded ?? 0).toLocaleString()} points
        </div>
        <div
          className="mt-1 italic"
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 13,
            color: DP_TOK.green,
          }}
        >
          Awarded. Returning to route…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DpPaper>
        <DpRow label="Resident" value={props.residentName} />
        <DpRow label="Bag" value={`#${props.printedNumber}`} valueTone="mono" />
        <div
          className="flex items-baseline justify-between pt-2.5"
          style={{ borderBottom: 'none' }}
        >
          <DpEyebrow>Declared</DpEyebrow>
          <span
            style={{
              fontFamily: DP_TOK.serif,
              fontSize: 15,
              color:
                props.declaredType === 'separated' ? DP_TOK.green : DP_TOK.ink,
            }}
          >
            {props.declaredType === 'separated'
              ? 'Separated · 2× multiplier'
              : props.declaredType === 'mixed'
                ? 'Commingled'
                : '—'}
          </span>
        </div>
      </DpPaper>

      <label
        className="flex cursor-pointer items-start gap-3"
        style={{
          background: commingled ? DP_TOK.amberSoft : DP_TOK.paper,
          border: `1px solid ${commingled ? 'rgba(160,104,42,0.4)' : DP_TOK.line}`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <input
          type="checkbox"
          checked={commingled}
          onChange={(e) => setCommingled(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer"
          style={{ accentColor: DP_TOK.amber }}
        />
        <div>
          <div
            style={{ fontFamily: DP_TOK.serif, fontSize: 14, color: DP_TOK.ink }}
          >
            Commingled bag
          </div>
          <div
            className="mt-1 italic"
            style={{
              fontFamily: DP_TOK.serif,
              fontSize: 12,
              color: DP_TOK.inkSoft,
              lineHeight: 1.5,
            }}
          >
            Contents can&rsquo;t be sorted (mixed plastic + glass, etc.). Weights
            are still recorded for landfill-diversion reporting, but no points are
            paid.
          </div>
        </div>
      </label>

      {props.activeCampaignNotices.length > 0 && (
        <div
          className="px-4 py-3"
          style={{
            background: DP_TOK.amberSoft,
            border: `1px solid rgba(160,104,42,0.3)`,
            borderRadius: 12,
          }}
        >
          <div className="flex items-center gap-2">
            <IconFire size={14} color={DP_TOK.amber} stroke={1.8} />
            <DpEyebrow color={DP_TOK.amber}>
              Active campaign{props.activeCampaignNotices.length === 1 ? '' : 's'}
            </DpEyebrow>
          </div>
          <ul
            className="mt-2 space-y-1"
            style={{
              fontFamily: DP_TOK.serif,
              fontSize: 13,
              color: DP_TOK.amber,
              lineHeight: 1.4,
            }}
          >
            {props.activeCampaignNotices.map((c) => (
              <li key={c.id}>
                <strong style={{ fontWeight: 500 }}>×{c.multiplier}</strong> on{' '}
                {c.materialNames.join(', ')}
                <span
                  className="italic"
                  style={{ color: DP_TOK.inkSoft, marginLeft: 4 }}
                >
                  · {c.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DpPaper>
        <DpEyebrow>Contamination</DpEyebrow>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {CONTAMINATION_SEVERITIES.map((sev) => {
            const active = sev === contamination;
            const isClean = sev === 'none';
            const palette = active
              ? isClean
                ? { bg: DP_TOK.green, fg: DP_TOK.paper, border: DP_TOK.green }
                : { bg: DP_TOK.rust, fg: DP_TOK.paper, border: DP_TOK.rust }
              : { bg: 'transparent', fg: DP_TOK.ink, border: DP_TOK.line };
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setContamination(sev)}
                className="cursor-pointer transition-colors"
                style={{
                  background: palette.bg,
                  color: palette.fg,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  padding: '8px 4px',
                }}
              >
                <div
                  style={{
                    fontFamily: DP_TOK.serif,
                    fontSize: 14,
                    letterSpacing: -0.2,
                  }}
                >
                  {CONTAMINATION_LABEL[sev]}
                </div>
                <div
                  style={{
                    fontFamily: DP_TOK.sans,
                    fontSize: 10,
                    letterSpacing: 0.4,
                    opacity: 0.85,
                    marginTop: 1,
                  }}
                >
                  {CONTAMINATION_SUBLABEL[sev]}
                </div>
              </button>
            );
          })}
        </div>
      </DpPaper>

      <DpPaper
        style={{
          background: DP_TOK.paper,
          border: `1px solid ${DP_TOK.line}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden style={{ fontSize: 14 }}>
            ⚖️
          </span>
          <DpEyebrow color={DP_TOK.green}>Weigh each material</DpEyebrow>
        </div>
        <div
          className="mt-1 italic"
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 11.5,
            color: DP_TOK.inkSoft,
          }}
        >
          Open bag, sort on the table, weigh separately.
        </div>
        <div className="mt-3">
          {props.materialList.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2.5"
              style={{
                borderBottom:
                  i < props.materialList.length - 1
                    ? `1px solid ${DP_TOK.lineSoft}`
                    : 'none',
              }}
            >
              <span
                className="flex items-center gap-2"
                style={{
                  fontFamily: DP_TOK.serif,
                  fontSize: 14,
                  color: DP_TOK.ink,
                }}
              >
                <span aria-hidden>{emojiFor(m.id)}</span>
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
                  className="text-right"
                  style={{
                    width: 64,
                    background: DP_TOK.paperTint,
                    border: `1px solid ${DP_TOK.line}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontFamily: DP_TOK.mono,
                    fontSize: 14,
                    color: DP_TOK.ink,
                    fontFeatureSettings: '"lnum","tnum"',
                  }}
                />
                <span
                  style={{
                    fontFamily: DP_TOK.sans,
                    fontSize: 11,
                    color: DP_TOK.inkFaint,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  lbs
                </span>
              </div>
            </div>
          ))}
        </div>
      </DpPaper>

      <div
        className="px-4 py-4 text-center"
        style={{
          background: commingled ? DP_TOK.paperTint : DP_TOK.greenSoft,
          border: `1px solid ${commingled ? DP_TOK.line : 'rgba(45,90,61,0.25)'}`,
          borderRadius: 14,
        }}
      >
        <DpEyebrow color={commingled ? DP_TOK.inkSoft : DP_TOK.green}>
          Total {totalWeight.toFixed(1)} lbs
        </DpEyebrow>
        <div
          className="mt-1.5"
          style={{
            fontFamily: DP_TOK.serif,
            fontSize: 22,
            color: commingled ? DP_TOK.inkSoft : DP_TOK.green,
            letterSpacing: -0.4,
            fontFeatureSettings: '"lnum","tnum"',
          }}
        >
          {commingled
            ? 'Diversion only — 0 pts'
            : `+${previewPoints.toLocaleString()} pts`}
        </div>
        {!commingled && (
          <div
            className="mt-0.5 italic"
            style={{
              fontFamily: DP_TOK.serif,
              fontSize: 11,
              color: DP_TOK.inkSoft,
            }}
          >
            For {props.residentName}
          </div>
        )}
      </div>

      {error && <DpAlert tone="rust">{error}</DpAlert>}

      <DpPrimaryButton
        onClick={handleSubmit}
        disabled={totalWeight <= 0 || step === 'submitting'}
      >
        {step === 'submitting' ? (
          'Submitting…'
        ) : (
          <>
            <IconCheck size={16} color={DP_TOK.paper} stroke={2.5} />
            Submit &amp; next bag
          </>
        )}
      </DpPrimaryButton>
    </div>
  );
}
