'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PickupIssue } from '@/lib/types/pickup';
import type { RouteView, StopView } from './page';
import {
  OP_TOK,
  OpEyebrow,
  OpGhostButton,
  OpPaper,
  OpPrimaryButton,
  OpSheet,
  ProgressStrip,
  StatusPill,
  type StatusKey,
} from '@/components/operator/Op';
import {
  IconArrow,
  IconBag,
  IconBell,
  IconCheck,
  IconChevR,
  IconPin,
  IconScan,
  IconStar,
} from '@/components/icons/EcoIcons';

export function TodaysRouteClient({
  route,
  operatorLabel,
}: {
  route: RouteView;
  operatorLabel: string;
}) {
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
    return openStops
      .filter((s) => s.addressId !== currentStop.addressId)
      .slice(0, 2);
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
      <ProgressStrip
        cells={[
          { label: 'Stops', done: route.stats.stopsDone, total: route.stats.stopsTotal },
          { label: 'Bags', done: route.stats.bagsDone, total: route.stats.bagsTotal },
          {
            label: 'Deliver',
            done: route.stats.deliveriesDone,
            total: route.stats.deliveriesTotal,
          },
        ]}
      />

      {route.status === 'assigned' && (
        <section className="mt-6">
          <OpPaper>
            <div
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 18,
                color: OP_TOK.ink,
                letterSpacing: -0.3,
              }}
            >
              Begin the route.
            </div>
            <p
              className="mt-1 italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 12,
                color: OP_TOK.inkSoft,
                lineHeight: 1.5,
              }}
            >
              Tap below to clock in. You can&rsquo;t complete stops until the route is started.
            </p>
            <div className="mt-4">
              <OpPrimaryButton onClick={handleStart} disabled={busy}>
                <IconCheck size={18} color={OP_TOK.paper} stroke={2} />
                {busy ? 'Starting…' : 'Start route'}
              </OpPrimaryButton>
            </div>
          </OpPaper>
        </section>
      )}

      {route.status === 'in_progress' && currentStop && !routeFinished && (
        <section className="mt-6">
          <OpPaper style={{ padding: 0, overflow: 'hidden' }}>
            {/* Address header */}
            <div
              style={{
                padding: '18px 18px 14px',
                borderBottom: `1px solid ${OP_TOK.lineSoft}`,
              }}
            >
              <div className="flex items-center gap-2">
                <IconPin size={14} color={OP_TOK.green} stroke={1.5} />
                <OpEyebrow color={OP_TOK.green}>Current stop</OpEyebrow>
              </div>
              <div
                className="mt-2"
                style={{
                  fontFamily: OP_TOK.serif,
                  fontSize: 22,
                  color: OP_TOK.ink,
                  letterSpacing: -0.3,
                  lineHeight: 1.15,
                }}
              >
                {currentStop.street}
                {currentStop.unitLine ? (
                  <span style={{ color: OP_TOK.inkSoft }}>, {currentStop.unitLine}</span>
                ) : null}
              </div>
              <div
                className="mt-1"
                style={{ fontFamily: OP_TOK.sans, fontSize: 12, color: OP_TOK.inkSoft }}
              >
                {currentStop.cityLine}
              </div>
              <div
                className="mt-1.5 italic"
                style={{ fontFamily: OP_TOK.serif, fontSize: 12, color: OP_TOK.inkSoft }}
              >
                {currentStop.residentName}
              </div>
            </div>

            {/* Bag list */}
            {currentStop.pickups.length > 0 && (
              <div style={{ padding: '14px 18px' }}>
                <OpEyebrow className="mb-2">
                  Bags to scan ({currentStop.pickups.length})
                </OpEyebrow>
                <ul>
                  {currentStop.pickups.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between"
                      style={{
                        padding: '10px 0',
                        borderBottom:
                          i < currentStop.pickups.length - 1
                            ? `1px solid ${OP_TOK.lineSoft}`
                            : 'none',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: OP_TOK.mono,
                            fontSize: 13,
                            color: OP_TOK.ink,
                          }}
                        >
                          {p.bagCode}
                        </div>
                        <div
                          className="mt-0.5 flex items-center gap-1 italic"
                          style={{
                            fontFamily: OP_TOK.serif,
                            fontSize: 11,
                            color: OP_TOK.inkSoft,
                          }}
                        >
                          {p.declaredType === 'separated' ? (
                            <>
                              <IconStar size={10} color={OP_TOK.green} stroke={1.5} />
                              Separated
                            </>
                          ) : p.declaredType === 'mixed' ? (
                            <>Mixed</>
                          ) : (
                            <>—</>
                          )}
                        </div>
                      </div>
                      <StatusPill status={p.status as StatusKey} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Primary scan action */}
            {firstPending && (
              <div style={{ padding: '0 18px 14px' }}>
                <OpPrimaryButton href={`/operator/stop/${firstPending.id}`}>
                  <IconScan size={18} color={OP_TOK.paper} stroke={1.75} />
                  Scan &amp; complete
                </OpPrimaryButton>
              </div>
            )}

            {/* Secondary tray */}
            <div
              style={{
                padding: '0 18px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              <OpGhostButton
                onClick={() => {
                  setSkipped((prev) => new Set(prev).add(currentStop.addressId));
                  setError(null);
                }}
                disabled={busy}
              >
                Skip
              </OpGhostButton>
              <OpGhostButton
                onClick={() => handleNotOut(currentStop)}
                disabled={busy || pendingCount(currentStop) === 0}
              >
                Not out
              </OpGhostButton>
              <OpGhostButton
                onClick={() => setIssueOpen(true)}
                disabled={busy || pendingCount(currentStop) === 0}
                tone="rust"
              >
                Issue
              </OpGhostButton>
            </div>

            {/* Notify resident */}
            <div style={{ padding: '0 18px 16px' }}>
              <button
                type="button"
                onClick={() => handleNotify(currentStop)}
                disabled={busy || pendingCount(currentStop) === 0}
                className="flex w-full cursor-pointer items-center justify-center gap-2 italic disabled:opacity-40"
                style={{
                  background: 'transparent',
                  border: `1px dashed ${OP_TOK.line}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: OP_TOK.serif,
                  fontSize: 12,
                  color: OP_TOK.inkSoft,
                }}
              >
                <IconBell size={14} stroke={1.5} />
                Text resident: driver on the way
              </button>
            </div>

            {/* Bag delivery sub-task */}
            {currentStop.bagOrdersToDeliver.length > 0 && (
              <div
                style={{
                  padding: '14px 18px 18px',
                  background: OP_TOK.greenSoft,
                  borderTop: `1px solid ${OP_TOK.line}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <IconBag size={14} color={OP_TOK.green} stroke={1.5} />
                  <OpEyebrow color={OP_TOK.green}>Also deliver</OpEyebrow>
                </div>
                {currentStop.bagOrdersToDeliver.map((o) => (
                  <Link
                    key={o.id}
                    href={`/operator/deliver/${o.id}`}
                    className="mt-2.5 flex items-center justify-between"
                    style={{
                      background: OP_TOK.paper,
                      border: `1px solid ${OP_TOK.green}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: OP_TOK.serif,
                          fontSize: 14,
                          color: OP_TOK.ink,
                        }}
                      >
                        {o.quantity} sheet{o.quantity === 1 ? '' : 's'}{' '}
                        <span
                          className="italic"
                          style={{ color: OP_TOK.inkFaint }}
                        >
                          · {o.quantity * 10} bags
                        </span>
                      </div>
                      <div
                        className="mt-0.5 italic"
                        style={{
                          fontFamily: OP_TOK.serif,
                          fontSize: 11,
                          color: OP_TOK.green,
                        }}
                      >
                        Scan first sticker to claim sheet
                      </div>
                    </div>
                    <IconChevR size={14} color={OP_TOK.green} />
                  </Link>
                ))}
              </div>
            )}
          </OpPaper>
        </section>
      )}

      {route.status === 'in_progress' && nextStops.length > 0 && !routeFinished && (
        <section className="mt-6">
          <OpEyebrow className="mb-2.5">
            Next {nextStops.length} stop{nextStops.length === 1 ? '' : 's'}
          </OpEyebrow>
          <div style={{ borderTop: `1px solid ${OP_TOK.line}` }}>
            {nextStops.map((s) => (
              <div
                key={s.addressId}
                className="flex items-center justify-between"
                style={{
                  padding: '14px 0',
                  borderBottom: `1px solid ${OP_TOK.lineSoft}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: OP_TOK.serif,
                      fontSize: 15,
                      color: OP_TOK.ink,
                    }}
                  >
                    {s.street}
                  </div>
                  <div
                    className="mt-0.5 italic"
                    style={{
                      fontFamily: OP_TOK.serif,
                      fontSize: 11,
                      color: OP_TOK.inkSoft,
                    }}
                  >
                    {s.pickups.length} bag{s.pickups.length === 1 ? '' : 's'}
                    {s.bagOrdersToDeliver.length > 0 && ` · ${s.bagOrdersToDeliver.length} delivery`}
                  </div>
                </div>
                <IconChevR size={14} color={OP_TOK.inkFaint} />
              </div>
            ))}
          </div>
        </section>
      )}

      {route.status === 'in_progress' && routeFinished && (
        <section className="mt-6">
          <OpPaper
            style={{
              background: OP_TOK.greenSoft,
              border: `1px solid ${OP_TOK.green}`,
            }}
          >
            <div
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 20,
                color: OP_TOK.green,
                letterSpacing: -0.3,
              }}
            >
              Route handled.
            </div>
            <p
              className="mt-1 italic"
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 12,
                color: OP_TOK.green,
                opacity: 0.85,
              }}
            >
              Head back to the depot, then close it out.
            </p>
            <div className="mt-4">
              <OpPrimaryButton href="/operator/summary">
                End-of-route summary
                <IconArrow size={16} color={OP_TOK.paper} />
              </OpPrimaryButton>
            </div>
          </OpPaper>
        </section>
      )}

      {error && (
        <p
          className="mt-3"
          style={{
            background: OP_TOK.rustSoft,
            border: `1px solid ${OP_TOK.rust}`,
            color: OP_TOK.rust,
            borderRadius: 10,
            padding: '8px 12px',
            fontFamily: OP_TOK.serif,
            fontSize: 12,
          }}
        >
          {error}
        </p>
      )}

      {issueOpen && currentStop && (
        <IssueSheet
          stop={currentStop}
          busy={busy}
          onCancel={() => setIssueOpen(false)}
          onSubmit={(issue, note) => handleIssue(currentStop, issue, note)}
        />
      )}

      <footer
        className="mt-8 text-center"
        style={{
          fontFamily: OP_TOK.serif,
          fontStyle: 'italic',
          fontSize: 11,
          color: OP_TOK.inkFaint,
        }}
      >
        Signed in as {operatorLabel}
      </footer>
    </>
  );
}

function pendingCount(stop: StopView): number {
  return stop.pickups.filter((p) => p.status === 'pending').length;
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
  return (
    <OpSheet
      title="Flag an issue"
      subtitle={`${stop.street} · ${pendingCount(stop)} pending bag${pendingCount(stop) === 1 ? '' : 's'}`}
      onClose={onCancel}
    >
      <div className="grid grid-cols-2 gap-2">
        {(['contaminated', 'other'] as const).map((opt) => {
          const sel = issue === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setIssue(opt)}
              className="cursor-pointer"
              style={{
                background: sel ? OP_TOK.ink : OP_TOK.paper,
                color: sel ? OP_TOK.paper : OP_TOK.ink,
                border: `1px solid ${sel ? OP_TOK.ink : OP_TOK.line}`,
                borderRadius: 12,
                padding: '12px 10px',
                fontFamily: OP_TOK.serif,
                fontSize: 14,
                letterSpacing: -0.2,
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
        className="mt-3 w-full"
        style={{
          background: OP_TOK.paper,
          border: `1px solid ${OP_TOK.line}`,
          borderRadius: 10,
          padding: '10px 12px',
          fontFamily: OP_TOK.serif,
          fontSize: 14,
          color: OP_TOK.ink,
          outline: 'none',
          resize: 'vertical',
        }}
      />
      <div className="mt-4 flex items-center justify-end gap-2">
        <OpGhostButton onClick={onCancel} disabled={busy}>
          Cancel
        </OpGhostButton>
        <button
          type="button"
          onClick={() => onSubmit(issue, note.trim())}
          disabled={busy}
          className="cursor-pointer disabled:opacity-50"
          style={{
            background: OP_TOK.rust,
            color: OP_TOK.paper,
            border: 'none',
            borderRadius: 12,
            padding: '12px 18px',
            fontFamily: OP_TOK.serif,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {busy ? 'Flagging…' : 'Flag issue'}
        </button>
      </div>
    </OpSheet>
  );
}
