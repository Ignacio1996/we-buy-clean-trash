'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SS,
  SSEyebrow,
  SSPillLink,
} from '@/components/resident/ss/SS';
import {
  IconArrow,
  IconBag,
  IconGift,
  IconTruck,
} from '@/components/icons/EcoIcons';
import type { ResidentHomePayload } from '@/app/api/resident/home/route';

const GIFT_CARD_POINTS = 1_000;

function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function endsInLabel(endsAt: Date, now: Date): string {
  const diffMs = endsAt.getTime() - now.getTime();
  if (diffMs <= 0) return 'Ending now';
  const diffH = diffMs / 3_600_000;
  if (diffH < 24) {
    const h = Math.max(1, Math.round(diffH));
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(diffH / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${mStr} ${period}`;
}

function formatPickupDay(date: Date, now: Date): string {
  if (isSameLocalDay(date, now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const SECTION_BORDER = `1px solid ${SS.line}`;

export function DashboardCards({ pointsBalance }: { pointsBalance: number }) {
  const [data, setData] = useState<ResidentHomePayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/resident/home', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ResidentHomePayload | null) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        // Leave skeletons / fallbacks in place on transient errors. The
        // server-rendered chrome (points hero, action stack) stays usable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pct = Math.min(1, pointsBalance / GIFT_CARD_POINTS);
  const ptsToGo = Math.max(0, GIFT_CARD_POINTS - pointsBalance);
  const canRedeem = data ? pointsBalance >= GIFT_CARD_POINTS && !data.hasRedeemed : false;

  return (
    <>
      <FeaturedCampaign data={data?.featuredCampaign ?? null} loaded={data !== null} />
      <NextDeliverySection
        order={data?.headlineOrder ?? null}
        nextPickupDateMs={data?.nextPickupDateMs ?? null}
        loaded={data !== null}
      />
      <RewardProgressSection
        pointsBalance={pointsBalance}
        pct={pct}
        ptsToGo={ptsToGo}
        hasRedeemed={data?.hasRedeemed ?? false}
        canRedeem={canRedeem}
      />
    </>
  );
}

function FeaturedCampaign({
  data,
  loaded,
}: {
  data: ResidentHomePayload['featuredCampaign'];
  loaded: boolean;
}) {
  if (!loaded) {
    return (
      <div style={{ padding: '8px 20px 0' }}>
        <div
          style={{
            background: '#f3f3f3',
            borderRadius: 18,
            height: 64,
          }}
          aria-hidden
        />
      </div>
    );
  }
  if (!data) return null;
  const now = new Date();
  return (
    <div style={{ padding: '8px 20px 0' }}>
      <Link
        href="/resident/calculator"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: SS.yellow,
          border: `2px solid ${SS.ink}`,
          borderRadius: 18,
          padding: '14px 16px',
          textDecoration: 'none',
          color: SS.ink,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900 }}>×{data.multiplier}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.2 }}>
            ×{data.multiplier} on {data.materialNames.join(', ')}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: SS.inkSoft, marginTop: 2 }}>
            Ends in {endsInLabel(new Date(data.endsAtMs), now)}
          </div>
        </div>
        <span style={{ fontSize: 18, fontWeight: 900 }}>→</span>
      </Link>
    </div>
  );
}

function NextDeliverySection({
  order,
  nextPickupDateMs,
  loaded,
}: {
  order: ResidentHomePayload['headlineOrder'];
  nextPickupDateMs: number | null;
  loaded: boolean;
}) {
  const now = new Date();
  const headlineRouteDate = order?.routeDateMs ? new Date(order.routeDateMs) : null;
  const headlineWindowLabel =
    order?.windowStart && order?.windowEnd
      ? `${formatTime12(order.windowStart)}–${formatTime12(order.windowEnd)}`
      : null;
  const nextPickupDate = nextPickupDateMs ? new Date(nextPickupDateMs) : null;

  // The eyebrow header should describe what's actually happening: an order on
  // its way is a delivery, a scheduled route is a pickup, and an empty state
  // shouldn't claim a delivery is coming.
  const eyebrow =
    !loaded || order
      ? { label: 'Next delivery', icon: <IconTruck size={14} stroke={2.25} /> }
      : nextPickupDate
        ? { label: 'Next pickup', icon: <IconTruck size={14} stroke={2.25} /> }
        : { label: 'Order bags', icon: <IconBag size={14} stroke={2.25} /> };

  const content = !loaded ? (
    <>
      <div
        style={{
          height: 28,
          width: '60%',
          background: '#f3f3f3',
          borderRadius: 6,
        }}
        aria-hidden
      />
      <div
        style={{
          height: 14,
          width: '40%',
          background: '#f3f3f3',
          borderRadius: 4,
          marginTop: 8,
        }}
        aria-hidden
      />
    </>
  ) : order ? (
    <Link
      href="/resident/order-bags/history"
      style={{ display: 'block', textDecoration: 'none', color: SS.ink }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: -0.7,
          color: SS.ink,
          lineHeight: 1.1,
        }}
      >
        {order.totalOpenBags} bags ·{' '}
        {order.status === 'out_for_delivery'
          ? 'Out for delivery'
          : order.status === 'pending'
            ? 'Payment pending'
            : headlineRouteDate
              ? formatPickupDay(headlineRouteDate, now)
              : 'Queued'}
      </div>
      {headlineWindowLabel && (
        <div style={{ fontSize: 14, fontWeight: 800, color: SS.ink, marginTop: 6 }}>
          Between {headlineWindowLabel}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>
        {nextPickupDate
          ? `Pickup ${formatPickupDay(nextPickupDate, now)}`
          : 'No pickup scheduled yet.'}
      </div>
    </Link>
  ) : nextPickupDate ? (
    <>
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: -0.7,
          color: SS.ink,
          lineHeight: 1.1,
        }}
      >
        Pickup {formatPickupDay(nextPickupDate, now)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>
        Leave bags at your designated pickup area.
      </div>
    </>
  ) : (
    <>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS.ink }}>
        Nothing scheduled
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: SS.inkSoft, marginTop: 6 }}>
        Order bags to join the next route.
      </div>
    </>
  );

  return (
    <div
      style={{
        background: '#fff',
        padding: '20px 20px 22px',
        borderTop: SECTION_BORDER,
        marginTop: 12,
      }}
    >
      <SSEyebrow icon={eyebrow.icon} style={{ marginBottom: 8 }}>
        {eyebrow.label}
      </SSEyebrow>
      {content}
    </div>
  );
}

function RewardProgressSection({
  pointsBalance,
  pct,
  ptsToGo,
  hasRedeemed,
  canRedeem,
}: {
  pointsBalance: number;
  pct: number;
  ptsToGo: number;
  hasRedeemed: boolean;
  canRedeem: boolean;
}) {
  return (
    <div style={{ background: SS.sky, padding: '24px 20px' }}>
      <SSEyebrow icon={<IconGift size={14} stroke={2.25} />} style={{ marginBottom: 8 }}>
        Next $10 gift card
      </SSEyebrow>
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: -2,
          color: SS.ink,
          lineHeight: 0.95,
          marginBottom: 4,
        }}
      >
        {pct >= 1 ? 'Ready!' : formatPoints(ptsToGo)}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: SS.ink,
          marginBottom: 14,
          opacity: 0.75,
        }}
      >
        {pct >= 1
          ? hasRedeemed
            ? 'Pilot limit reached — keep earning, more redemptions coming soon.'
            : 'Tap below to cash out.'
          : 'points to your next $10 gift card'}
      </div>
      <div
        style={{
          height: 14,
          background: '#fff',
          borderRadius: 999,
          overflow: 'hidden',
          border: `2px solid ${SS.ink}`,
        }}
      >
        <div style={{ height: '100%', width: `${pct * 100}%`, background: SS.brand }} />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink, opacity: 0.7 }}>
          {formatPoints(pointsBalance)} / {formatPoints(GIFT_CARD_POINTS)} pts
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: SS.brand }}>
          {Math.round(pct * 100)}%
        </div>
      </div>
      {canRedeem && (
        <div style={{ marginTop: 16 }}>
          <SSPillLink
            href="/resident/rewards"
            variant="red"
            leadingIcon={<IconGift size={22} stroke={2.5} />}
            iconArrow={<IconArrow size={22} stroke={2.5} />}
            style={{ fontSize: 18, padding: '18px 22px' }}
          >
            Redeem $10 gift card
          </SSPillLink>
        </div>
      )}
    </div>
  );
}
