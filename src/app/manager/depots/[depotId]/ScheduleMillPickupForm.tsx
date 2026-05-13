'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_IDS,
  type MaterialId,
} from '@/lib/types/material';
import {
  SSMG,
  SSMgCard,
  SSMgError,
  SSMgEyebrow,
  SSMgPillButton,
} from '@/components/manager/SSMg';

interface Props {
  depotId: string;
  inventory: Record<MaterialId, number>;
}

type Step = 'collapsed' | 'form' | 'submitting';

function todayPlus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateChipParts(iso: string): { d: string; n: string; m: string } {
  const date = new Date(iso + 'T00:00:00');
  const d = date.toLocaleDateString('en-US', { weekday: 'short' });
  const n = String(date.getDate());
  const m = date.toLocaleDateString('en-US', { month: 'short' });
  return { d, n, m };
}

export function ScheduleMillPickupForm({ depotId, inventory }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('collapsed');
  const [mill, setMill] = useState('');
  const [scheduledFor, setScheduledFor] = useState(todayPlus(1));
  const [weights, setWeights] = useState<Record<MaterialId, string>>(() => {
    const init = {} as Record<MaterialId, string>;
    for (const id of MATERIAL_IDS) init[id] = '';
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const numericWeights = useMemo(() => {
    const out = {} as Record<MaterialId, number>;
    for (const id of MATERIAL_IDS) {
      const n = Number(weights[id]);
      out[id] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return out;
  }, [weights]);

  const totalWeight = useMemo(
    () => MATERIAL_IDS.reduce((sum, id) => sum + numericWeights[id], 0),
    [numericWeights],
  );

  const overLimits: MaterialId[] = useMemo(
    () => MATERIAL_IDS.filter((id) => numericWeights[id] > (inventory[id] ?? 0)),
    [numericWeights, inventory],
  );

  const canSubmit =
    mill.trim().length > 0 && scheduledFor && totalWeight > 0 && overLimits.length === 0;

  function fillAll() {
    const next = {} as Record<MaterialId, string>;
    for (const id of MATERIAL_IDS) {
      next[id] = (inventory[id] ?? 0) > 0 ? String(inventory[id]) : '';
    }
    setWeights(next);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setStep('submitting');
    setError(null);
    try {
      const payload = {
        depotId,
        mill: mill.trim(),
        scheduledFor,
        weights: Object.fromEntries(
          MATERIAL_IDS.filter((id) => numericWeights[id] > 0).map((id) => [
            id,
            numericWeights[id],
          ]),
        ),
      };
      const res = await fetch('/api/mill-shipments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        materialId?: string;
      };
      if (!res.ok) {
        if (body.error === 'insufficient_inventory') {
          throw new Error(
            `Not enough ${body.materialId ? MATERIAL_DISPLAY_NAMES[body.materialId as MaterialId] : 'material'} in stock.`,
          );
        }
        throw new Error(body.error ?? 'submit_failed');
      }
      setStep('collapsed');
      setMill('');
      setWeights(() => {
        const init = {} as Record<MaterialId, string>;
        for (const id of MATERIAL_IDS) init[id] = '';
        return init;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
      setStep('form');
    }
  }

  if (step === 'collapsed') {
    return (
      <div style={{ marginTop: 8 }}>
        <SSMgPillButton
          variant="brand"
          size="lg"
          leftIcon={<span>🚛</span>}
          onClick={() => setStep('form')}
        >
          Schedule mill pickup
        </SSMgPillButton>
      </div>
    );
  }

  const dateOptions = [0, 1, 2, 3].map((n) => todayPlus(n));

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mill picker */}
      <div>
        <SSMgEyebrow>Mill</SSMgEyebrow>
        <input
          type="text"
          value={mill}
          onChange={(e) => setMill(e.target.value)}
          placeholder="Cascade Fiber Co."
          style={{
            width: '100%',
            background: '#fff',
            border: `2px solid ${SSMG.ink}`,
            borderRadius: 14,
            padding: '14px 16px',
            fontFamily: SSMG.sans,
            fontSize: 16,
            fontWeight: 800,
            color: SSMG.ink,
            outline: 'none',
            boxShadow: `0 3px 0 ${SSMG.ink}`,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Pickup date chips */}
      <div>
        <SSMgEyebrow>Pickup date</SSMgEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {dateOptions.map((iso) => {
            const sel = scheduledFor === iso;
            const { d, n, m } = dateChipParts(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setScheduledFor(iso)}
                style={{
                  background: sel ? SSMG.brand : '#fff',
                  color: sel ? '#fff' : SSMG.ink,
                  border: `2px solid ${sel ? SSMG.brand : SSMG.ink}`,
                  borderRadius: 14,
                  padding: '10px 0',
                  textAlign: 'center',
                  boxShadow: `0 4px 0 ${sel ? SSMG.brandDark : SSMG.ink}`,
                  fontFamily: SSMG.sans,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    opacity: 0.8,
                  }}
                >
                  {d}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: -0.6,
                    lineHeight: 1,
                    marginTop: 2,
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    opacity: 0.7,
                    marginTop: 2,
                  }}
                >
                  {m}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weights */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <SSMgEyebrow mb={0}>Load weights · lbs</SSMgEyebrow>
          <button
            type="button"
            onClick={fillAll}
            style={{
              background: SSMG.yellow,
              border: `2px solid ${SSMG.ink}`,
              color: SSMG.ink,
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontFamily: SSMG.sans,
              boxShadow: `0 3px 0 ${SSMG.ink}`,
              cursor: 'pointer',
            }}
          >
            Fill max
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MATERIAL_IDS.map((id) => {
            const onHand = inventory[id] ?? 0;
            const val = weights[id];
            const over = numericWeights[id] > onHand;
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: val ? '#fff' : '#FAFAFA',
                  border: `2px solid ${over ? SSMG.brand : SSMG.ink}`,
                  borderRadius: 14,
                  padding: '10px 12px',
                  boxShadow: `0 4px 0 ${over ? SSMG.brand : SSMG.ink}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: SSMG.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {MATERIAL_DISPLAY_NAMES[id]}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: over ? SSMG.brand : SSMG.inkSoft,
                      marginTop: 1,
                    }}
                  >
                    on hand · {onHand.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <input
                  inputMode="decimal"
                  type="text"
                  value={val}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [id]: e.target.value.replace(/[^0-9.]/g, ''),
                    }))
                  }
                  placeholder="—"
                  style={{
                    minWidth: 90,
                    background: val ? SSMG.ink : '#fff',
                    color: val ? '#fff' : SSMG.inkSoft,
                    border: `2px solid ${SSMG.ink}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 17,
                    fontWeight: 900,
                    fontFamily: SSMG.mono,
                    letterSpacing: -0.2,
                    textAlign: 'right',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <SSMgCard>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div>
            <SSMgEyebrow mb={4}>Total load</SSMgEyebrow>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -1.2,
                lineHeight: 1,
                color: SSMG.ink,
              }}
            >
              {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
            </div>
          </div>
        </div>
      </SSMgCard>

      {error && <SSMgError>{error}</SSMgError>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => {
            setStep('collapsed');
            setError(null);
          }}
          style={{
            flex: 1,
            background: '#fff',
            border: `2px solid ${SSMG.ink}`,
            color: SSMG.ink,
            borderRadius: 999,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: -0.2,
            fontFamily: SSMG.sans,
            boxShadow: `0 4px 0 ${SSMG.ink}`,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <div style={{ flex: 2 }}>
          <SSMgPillButton
            variant="brand"
            onClick={handleSubmit}
            disabled={!canSubmit || step === 'submitting'}
          >
            {step === 'submitting' ? 'Scheduling…' : 'Confirm pickup'}
          </SSMgPillButton>
        </div>
      </div>
    </div>
  );
}
