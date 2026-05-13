'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PickupIssue } from '@/lib/types/pickup';
import type { RouteView, StopView } from './page';
import {
  SSOP,
  SSOpBadge,
  SSOpCard,
  SSOpError,
  SSOpEyebrow,
  SSOpGhostButton,
  SSOpPillButton,
  SSOpPillLink,
  SSOpProgress,
} from '@/components/operator/SSOp';

export function TodaysRouteClient({ route }: { route: RouteView; operatorLabel: string }) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const openStops = route.stops.filter((s) => !s.allDone);
  const visibleStops = openStops.filter((s) => !skipped.has(s.addressId));
  const currentStop = visibleStops[0] ?? openStops[0] ?? null;
  const nextStops = useMemo(() => {
    if (!currentStop) return [] as StopView[];
    return openStops.filter((s) => s.addressId !== currentStop.addressId).slice(0, 2);
  }, [currentStop, openStops]);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(typeof json.error === 'string' ? json.error : 'request_failed');
    }
    return res;
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/routes/${route.id}/start`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start_failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleNotOut(stop: StopView) {
    if (!confirm(`Mark all ${pendingCount(stop)} bag(s) at ${stop.street} as not out?`)) return;
    await batchPost(stop, (pickupId) => post(`/api/pickups/${pickupId}/not-out`), 'not_out_failed');
  }

  async function handleIssue(stop: StopView, issue: PickupIssue, note: string) {
    await batchPost(
      stop,
      (pickupId) => post(`/api/pickups/${pickupId}/issue`, { issue, note }),
      'issue_failed',
    );
    setIssueOpen(false);
  }

  async function handleNotify(stop: StopView) {
    const first = stop.pickups.find((p) => p.status === 'pending');
    if (!first) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post(`/api/pickups/${first.id}/notify-on-way`);
      const json = await res.json().catch(() => ({}));
      if (json?.phoneKnown === false) {
        setError('Heads up: this resident has no phone on file — logged to smsLog only.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'notify_failed');
    } finally {
      setBusy(false);
    }
  }

  async function batchPost(
    stop: StopView,
    fn: (pickupId: string) => Promise<unknown>,
    errLabel: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const pending = stop.pickups.filter((p) => p.status === 'pending').map((p) => p.id);
      await Promise.all(pending.map(fn));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : errLabel);
    } finally {
      setBusy(false);
    }
  }

  const routeFinished =
    route.stats.stopsDone === route.stats.stopsTotal &&
    route.stats.deliveriesPending === 0;
  const firstPending = currentStop?.pickups.find((p) => p.status === 'pending');

  return (
    <>
      <SSOpProgress
        stopsDone={route.stats.stopsDone}
        stopsTotal={route.stats.stopsTotal}
        bagsDone={route.stats.bagsDone}
        bagsTotal={route.stats.bagsTotal}
        deliveriesDone={route.stats.deliveriesDone}
        deliveriesTotal={route.stats.deliveriesTotal}
      />

      {route.status === 'assigned' && (
        <>
          <div style={{ background: '#fff', padding: '22px 20px 14px' }}>
            <SSOpEyebrow>Manifest preview</SSOpEyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {route.stops.slice(0, 4).map((stop, i) => (
                <ManifestRow
                  key={stop.addressId}
                  index={i + 1}
                  color={[SSOP.yellow, SSOP.sky, SSOP.mint, SSOP.peach][i % 4]}
                  street={stop.street}
                  unitLine={stop.unitLine}
                  who={stop.residentName}
                  meta={summarizeStop(stop)}
                />
              ))}
              {route.stops.length > 4 && (
                <ManifestRow
                  index={null}
                  color={SSOP.peach}
                  street={`+ ${route.stops.length - 4} more stops`}
                  unitLine=""
                  who="Auto-routed"
                  meta="shortest path"
                />
              )}
            </div>
          </div>

          <div style={{ background: SSOP.peach, padding: '24px 20px 28px' }}>
            <SSOpPillButton
              variant="brand"
              size="lg"
              leftIcon={<span style={{ fontSize: 18 }}>▶</span>}
              onClick={handleStart}
              disabled={busy}
            >
              {busy ? 'Starting…' : 'Start route'}
            </SSOpPillButton>
            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: SSOP.ink,
                opacity: 0.7,
                marginTop: 12,
                fontStyle: 'italic',
              }}
            >
              You can&rsquo;t complete stops until the route is started.
            </div>
          </div>
        </>
      )}

      {route.status === 'in_progress' && currentStop && !routeFinished && (
        <>
          {/* Current stop card — white */}
          <div style={{ background: '#fff', padding: '22px 20px 12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
              }}
            >
              <SSOpEyebrow mb={0}>Bags to scan</SSOpEyebrow>
              <SSOpBadge bg={SSOP.mint}>
                {pendingCount(currentStop)} pending
              </SSOpBadge>
            </div>

            <SSOpCard pad={0}>
              {currentStop.pickups.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: SSOP.inkSoft,
                    fontStyle: 'italic',
                  }}
                >
                  No bags expected at this stop.
                </div>
              ) : (
                currentStop.pickups.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderBottom:
                        i < currentStop.pickups.length - 1
                          ? `1px solid ${SSOP.line}`
                          : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: p.declaredType === 'separated' ? SSOP.mint : '#fff',
                        border: `2px solid ${SSOP.ink}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 900,
                      }}
                    >
                      {p.declaredType === 'separated' ? '★' : 'M'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: SSOP.mono,
                          fontSize: 15,
                          fontWeight: 800,
                          color: SSOP.ink,
                          letterSpacing: 0.4,
                        }}
                      >
                        {p.bagCode}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: SSOP.inkSoft,
                          marginTop: 1,
                          textTransform: 'capitalize',
                        }}
                      >
                        {p.declaredType ?? '—'}
                      </div>
                    </div>
                    <SSOpBadge bg={pillForStatus(p.status).bg} fg={pillForStatus(p.status).fg}>
                      {pillForStatus(p.status).label}
                    </SSOpBadge>
                  </div>
                ))
              )}
            </SSOpCard>

            {/* Stop address — compact line */}
            <div style={{ marginTop: 12 }}>
              <SSOpEyebrow color={SSOP.brand} style={{ marginBottom: 4 }}>
                Current stop
              </SSOpEyebrow>
              <div style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink, letterSpacing: -0.2 }}>
                {currentStop.street}
                {currentStop.unitLine ? ` · ${currentStop.unitLine}` : ''}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SSOP.inkSoft,
                  marginTop: 1,
                }}
              >
                {currentStop.residentName} · {currentStop.cityLine}
              </div>
            </div>

            {firstPending && (
              <div style={{ marginTop: 14 }}>
                <SSOpPillLink
                  href={`/operator/stop/${firstPending.id}`}
                  variant="brand"
                  size="lg"
                  leftIcon={<span>📷</span>}
                >
                  Scan &amp; complete
                </SSOpPillLink>
              </div>
            )}

            {/* Secondary tray */}
            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}
            >
              <SSOpGhostButton
                onClick={() => {
                  setSkipped((prev) => new Set(prev).add(currentStop.addressId));
                  setError(null);
                }}
                disabled={busy}
              >
                Skip
              </SSOpGhostButton>
              <SSOpGhostButton
                onClick={() => handleNotOut(currentStop)}
                disabled={busy || pendingCount(currentStop) === 0}
              >
                Not out
              </SSOpGhostButton>
              <SSOpGhostButton
                onClick={() => setIssueOpen(true)}
                disabled={busy || pendingCount(currentStop) === 0}
                tone="brand"
              >
                Issue
              </SSOpGhostButton>
            </div>

            {/* Notify resident */}
            <button
              type="button"
              onClick={() => handleNotify(currentStop)}
              disabled={busy || pendingCount(currentStop) === 0}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'transparent',
                border: `2px dashed ${SSOP.line}`,
                borderRadius: 14,
                padding: '12px 14px',
                fontFamily: SSOP.sans,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: SSOP.inkSoft,
                cursor:
                  busy || pendingCount(currentStop) === 0 ? 'not-allowed' : 'pointer',
                opacity: busy || pendingCount(currentStop) === 0 ? 0.4 : 1,
              }}
            >
              🔔 Text resident: driver on the way
            </button>
          </div>

          {/* Bag delivery sub-task — mint */}
          {currentStop.bagOrdersToDeliver.length > 0 && (
            <div style={{ background: SSOP.mint, padding: '20px 20px' }}>
              <SSOpEyebrow>Also deliver</SSOpEyebrow>
              {currentStop.bagOrdersToDeliver.map((o) => (
                <Link
                  key={o.id}
                  href={`/operator/deliver/${o.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#fff',
                    border: `2px solid ${SSOP.ink}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    boxShadow: `0 4px 0 ${SSOP.ink}`,
                    textDecoration: 'none',
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: SSOP.yellow,
                      border: `2px solid ${SSOP.ink}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 900,
                    }}
                  >
                    📦
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: SSOP.ink,
                        letterSpacing: -0.3,
                      }}
                    >
                      {o.quantity} sheet{o.quantity === 1 ? '' : 's'} · {o.quantity * 10} bags
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: SSOP.inkSoft,
                        marginTop: 1,
                      }}
                    >
                      Scan first sticker to claim sheet
                    </div>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 900, color: SSOP.ink }}>›</span>
                </Link>
              ))}
            </div>
          )}

          {/* Next stops — peach */}
          {nextStops.length > 0 && (
            <div style={{ background: SSOP.peach, padding: '20px 20px 24px' }}>
              <SSOpEyebrow>
                Next {nextStops.length} stop{nextStops.length === 1 ? '' : 's'}
              </SSOpEyebrow>
              {nextStops.map((s, i) => (
                <div
                  key={s.addressId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: i === 0 ? 0 : 10,
                    background: '#fff',
                    border: `2px solid ${SSOP.ink}`,
                    borderRadius: 14,
                    padding: '10px 12px',
                    boxShadow: `0 3px 0 ${SSOP.ink}`,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: SSOP.ink,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    {String(s.order + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: SSOP.ink,
                        letterSpacing: -0.2,
                      }}
                    >
                      {s.street}
                      {s.unitLine ? ` · ${s.unitLine}` : ''}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: SSOP.inkSoft,
                        marginTop: 1,
                      }}
                    >
                      {s.residentName} · {summarizeStop(s)}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: SSOP.ink }}>›</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {route.status === 'in_progress' && routeFinished && (
        <div style={{ background: SSOP.mint, padding: '32px 20px 28px' }}>
          <SSOpCard color={SSOP.green} style={{ color: '#fff' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: '#fff',
                opacity: 0.85,
              }}
            >
              All handled
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: -1,
                color: '#fff',
                marginTop: 6,
              }}
            >
              Route handled.
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#fff',
                opacity: 0.85,
                marginTop: 6,
              }}
            >
              Head back to the depot, then close it out.
            </div>
          </SSOpCard>
          <div style={{ marginTop: 16 }}>
            <SSOpPillLink href="/operator/summary" variant="brand" size="lg">
              End-of-route summary
            </SSOpPillLink>
          </div>
        </div>
      )}

      {error && <SSOpError>{error}</SSOpError>}

      {issueOpen && currentStop && (
        <IssueSheet
          stop={currentStop}
          busy={busy}
          onCancel={() => setIssueOpen(false)}
          onSubmit={(issue, note) => handleIssue(currentStop, issue, note)}
        />
      )}
    </>
  );
}

function pendingCount(stop: StopView): number {
  return stop.pickups.filter((p) => p.status === 'pending').length;
}

function summarizeStop(stop: StopView): string {
  const bags = stop.pickups.length;
  const deliv = stop.bagOrdersToDeliver.length;
  const parts = [];
  if (bags > 0) parts.push(`${bags} bag${bags === 1 ? '' : 's'}`);
  if (deliv > 0) parts.push(`${deliv} delivery`);
  return parts.join(' · ') || '—';
}

function pillForStatus(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case 'completed':
      return { bg: SSOP.green, fg: '#fff', label: 'Done' };
    case 'missed':
    case 'not_out':
      return { bg: SSOP.peach, fg: SSOP.ink, label: 'Missed' };
    case 'issue':
      return { bg: SSOP.brand, fg: '#fff', label: 'Issue' };
    case 'skipped':
      return { bg: '#fff', fg: SSOP.inkSoft, label: 'Skipped' };
    default:
      return { bg: SSOP.yellow, fg: SSOP.ink, label: 'Pending' };
  }
}

function ManifestRow({
  index,
  color,
  street,
  unitLine,
  who,
  meta,
}: {
  index: number | null;
  color: string;
  street: string;
  unitLine: string;
  who: string;
  meta: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        border: `2px solid ${SSOP.ink}`,
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: `0 3px 0 ${SSOP.ink}`,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: color,
          border: `2px solid ${SSOP.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        {index !== null ? String(index).padStart(2, '0') : '⋯'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: SSOP.ink,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {street}
          {unitLine ? ` · ${unitLine}` : ''}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: SSOP.inkSoft, marginTop: 1 }}>
          {who} · {meta}
        </div>
      </div>
    </div>
  );
}

function IssueSheet({
  stop,
  busy,
  onCancel,
  onSubmit,
}: {
  stop: StopView;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (issue: PickupIssue, note: string) => void;
}) {
  const [issue, setIssue] = useState<PickupIssue>('contaminated');
  const [note, setNote] = useState('');
  const pending = pendingCount(stop);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(17,17,17,0.55)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderTop: `2px solid ${SSOP.ink}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '22px 20px 28px',
        }}
      >
        <SSOpEyebrow color={SSOP.brand}>Flag an issue</SSOpEyebrow>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SSOP.ink,
            letterSpacing: -0.6,
            marginTop: 6,
          }}
        >
          {stop.street}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: SSOP.inkSoft, marginTop: 4 }}>
          {pending} pending bag{pending === 1 ? '' : 's'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
          {(['contaminated', 'other'] as const).map((opt) => {
            const sel = issue === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setIssue(opt)}
                style={{
                  padding: '14px 0',
                  textAlign: 'center',
                  border: `2px solid ${SSOP.ink}`,
                  background: sel ? SSOP.yellow : '#fff',
                  color: SSOP.ink,
                  borderRadius: 14,
                  fontFamily: SSOP.sans,
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: sel ? `0 4px 0 ${SSOP.ink}` : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What did you see? (optional)"
          style={{
            width: '100%',
            background: '#fff',
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 14,
            padding: '12px 14px',
            fontFamily: SSOP.sans,
            fontSize: 14,
            fontWeight: 700,
            color: SSOP.ink,
            outline: 'none',
            marginTop: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <SSOpGhostButton onClick={onCancel} disabled={busy}>
            Cancel
          </SSOpGhostButton>
          <SSOpPillButton
            variant="brand"
            onClick={() => onSubmit(issue, note.trim())}
            disabled={busy}
            rightIcon={null}
          >
            {busy ? 'Flagging…' : 'Flag issue'}
          </SSOpPillButton>
        </div>
      </div>
    </div>
  );
}
