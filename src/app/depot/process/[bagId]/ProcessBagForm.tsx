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
import { SS, SSPillButton } from '@/components/resident/ss/SS';

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
  none: 'Clean',
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
        style={{
          background: SS.mint,
          border: `2px solid ${SS.ink}`,
          borderRadius: 18,
          padding: '28px 18px',
          textAlign: 'center',
          boxShadow: `0 4px 0 ${SS.ink}`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: SS.green,
            color: '#fff',
            border: `3px solid ${SS.ink}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            fontWeight: 900,
            fontSize: 26,
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          ✓
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            fontFeatureSettings: '"lnum","tnum"',
          }}
        >
          +{(awarded ?? 0).toLocaleString()} pts
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.75,
          }}
        >
          Awarded. Returning to route…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Bag info card — sky sticker */}
      <div
        style={{
          background: SS.sky,
          border: `2px solid ${SS.ink}`,
          borderRadius: 18,
          padding: 14,
          boxShadow: `0 4px 0 ${SS.ink}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: SS.inkSoft,
              }}
            >
              Bag #
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 0.4,
                color: SS.ink,
                marginTop: 2,
              }}
            >
              {props.printedNumber}
            </div>
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: SS.green,
              color: '#fff',
              border: `2px solid ${SS.ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            ✓
          </div>
        </div>
        <div
          style={{
            borderTop: `1.5px dashed ${SS.ink}`,
            marginTop: 12,
            paddingTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
              }}
            >
              Resident
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: -0.2,
                color: SS.ink,
                marginTop: 2,
              }}
            >
              {props.residentName}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: SS.inkSoft,
              }}
            >
              Declared
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: -0.2,
                color:
                  props.declaredType === 'separated' ? SS.green : SS.ink,
                marginTop: 2,
              }}
            >
              {props.declaredType === 'separated'
                ? 'Separated · 2×'
                : props.declaredType === 'mixed'
                  ? 'Commingled'
                  : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign banner — yellow */}
      {props.activeCampaignNotices.length > 0 && (
        <div
          style={{
            background: SS.yellow,
            border: `2px solid ${SS.ink}`,
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            boxShadow: `0 3px 0 ${SS.ink}`,
          }}
        >
          <div style={{ fontSize: 18 }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: SS.brand,
              }}
            >
              Active campaign
              {props.activeCampaignNotices.length === 1 ? '' : 's'}
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '4px 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {props.activeCampaignNotices.map((c) => (
                <li
                  key={c.id}
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: SS.ink,
                    lineHeight: 1.3,
                  }}
                >
                  ×{c.multiplier} on {c.materialNames.join(', ')}
                  <span
                    style={{
                      fontWeight: 800,
                      color: SS.inkSoft,
                      marginLeft: 4,
                    }}
                  >
                    · {c.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Commingled toggle — peach */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: commingled ? SS.peach : '#fff',
          border: `2px solid ${SS.ink}`,
          borderRadius: 12,
          padding: '12px 14px',
          boxShadow: commingled ? `0 3px 0 ${SS.ink}` : 'none',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={commingled}
          onChange={(e) => setCommingled(e.target.checked)}
          style={{
            width: 18,
            height: 18,
            marginTop: 2,
            accentColor: SS.ink,
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: -0.2,
              color: SS.ink,
            }}
          >
            Commingled bag
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SS.inkSoft,
              lineHeight: 1.4,
              marginTop: 2,
            }}
          >
            Mixed plastic + glass, etc. Weight is recorded for diversion but no
            points are paid.
          </div>
        </div>
      </label>

      {/* Contamination 4-tile picker */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
            marginBottom: 8,
          }}
        >
          Contamination
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          {CONTAMINATION_SEVERITIES.map((sev) => {
            const active = sev === contamination;
            const isClean = sev === 'none';
            const bg = active
              ? isClean
                ? SS.green
                : SS.brand
              : '#fff';
            const fg = active ? '#fff' : SS.ink;
            const sub = active ? '#fff' : SS.inkSoft;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setContamination(sev)}
                style={{
                  background: bg,
                  color: fg,
                  border: `2px solid ${SS.ink}`,
                  borderRadius: 10,
                  padding: '8px 4px',
                  cursor: 'pointer',
                  boxShadow: active
                    ? `0 3px 0 ${isClean ? SS.greenDark : SS.brandDark}`
                    : 'none',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    letterSpacing: -0.2,
                  }}
                >
                  {CONTAMINATION_LABEL[sev]}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    opacity: active ? 0.9 : 1,
                    color: sub,
                    marginTop: 1,
                  }}
                >
                  {CONTAMINATION_SUBLABEL[sev]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-commodity weighing — mint section with sticker chip rows */}
      <div
        style={{
          background: SS.mint,
          border: `2px solid ${SS.ink}`,
          borderRadius: 16,
          padding: 14,
          boxShadow: `0 4px 0 ${SS.ink}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.ink,
            marginBottom: 4,
          }}
        >
          Weigh each material
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.7,
            marginBottom: 10,
          }}
        >
          Open bag, sort on the table, weigh separately.
        </div>
        <div
          style={{
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {props.materialList.map((m, i) => {
            const multiplier = props.materialMultipliers[m.id] ?? 1;
            const hasMultiplier = multiplier > 1;
            const last = i === props.materialList.length - 1;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: last ? 'none' : `1px solid ${SS.line}`,
                  background: hasMultiplier ? '#FFFCEA' : '#fff',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 18 }}>
                    {emojiFor(m.id)}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {m.name}
                  </span>
                  {hasMultiplier && (
                    <span
                      style={{
                        background: SS.yellow,
                        border: `1.5px solid ${SS.ink}`,
                        borderRadius: 6,
                        padding: '1px 5px',
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: 1,
                        color: SS.ink,
                      }}
                    >
                      ×{multiplier}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
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
                    style={{
                      width: 60,
                      background: hasMultiplier ? SS.yellow : '#fff',
                      border: `2px solid ${SS.ink}`,
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontFamily:
                        'ui-monospace, "SF Mono", Menlo, monospace',
                      fontSize: 15,
                      fontWeight: 900,
                      color: SS.ink,
                      textAlign: 'right',
                      outline: 'none',
                      fontFeatureSettings: '"lnum","tnum"',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: SS.inkSoft,
                      letterSpacing: 0.4,
                    }}
                  >
                    lbs
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total + points — mint result */}
      <div
        style={{
          background: commingled ? SS.peach : SS.mint,
          border: `2px solid ${SS.ink}`,
          borderRadius: 16,
          padding: 16,
          textAlign: 'center',
          boxShadow: `0 4px 0 ${SS.ink}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
          }}
        >
          Total · {totalWeight.toFixed(1)} lbs
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            marginTop: 6,
            fontFeatureSettings: '"lnum","tnum"',
          }}
        >
          {commingled
            ? 'Diversion only'
            : `+${previewPoints.toLocaleString()} pts`}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            fontWeight: 800,
            color: SS.ink,
            opacity: 0.7,
          }}
        >
          {commingled ? '0 points awarded' : `credited to ${props.residentName}`}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: SS.brand,
            color: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            boxShadow: `0 4px 0 ${SS.ink}`,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <SSPillButton
        variant="primary"
        onClick={handleSubmit}
        disabled={totalWeight <= 0 || step === 'submitting'}
      >
        {step === 'submitting' ? 'Submitting…' : 'Submit & next bag'}
      </SSPillButton>
    </div>
  );
}
