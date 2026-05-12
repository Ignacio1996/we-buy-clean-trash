import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import { SignupBonusModal } from '@/components/resident/SignupBonusModal';
import { loadActiveCampaigns } from '@/lib/admin/loadActiveCampaigns';
import { loadActiveMaterials } from '@/lib/admin/loadActiveMaterials';
import type { BagOrderDoc, BagOrderStatus } from '@/lib/types/bagOrder';
import type { PickupDoc } from '@/lib/types/pickup';
import type { RouteDoc } from '@/lib/types/route';
import { resolveAccountType } from '@/lib/types/user';
import { CommercialResidentHome } from './CommercialResidentHome';
import {
  SS,
  SSEyebrow,
  SSHeader,
  SSPillLink,
  SSScreen,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';

const GIFT_CARD_POINTS = 100_000;

const OPEN_ORDER_STATUSES: readonly BagOrderStatus[] = [
  'pending',
  'queued',
  'out_for_delivery',
];

function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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

function formatPickupDay(date: Date, now: Date): string {
  if (isSameLocalDay(date, now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default async function ResidentHome() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  if (!user.onboardingCompletedAt) redirect('/resident/welcome');
  if (resolveAccountType(user) === 'commercial_site') {
    return (
      <CommercialResidentHome
        commercialAccountId={
          typeof user.commercialAccountId === 'string' ? user.commercialAccountId : null
        }
        userName={typeof user.name === 'string' ? user.name : null}
      />
    );
  }
  const pointsBalance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const fullName = typeof user.name === 'string' ? user.name : 'there';
  const firstName = fullName.split(' ')[0] || 'there';
  const initial = firstName.charAt(0).toUpperCase() || '·';
  const dollarValue = pointsToDollars(pointsBalance);

  const ordersSnap = await adminDb
    .collection('bagOrders')
    .where('residentId', '==', uid)
    .get();
  const hasEverOrdered = ordersSnap.size > 0;
  const openOrders = ordersSnap.docs
    .map((d) => d.data() as BagOrderDoc)
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status))
    .sort((a, b) => {
      const am = a.createdAt?.toMillis?.() ?? 0;
      const bm = b.createdAt?.toMillis?.() ?? 0;
      return bm - am;
    });

  const [activeCampaigns, allMaterials] = await Promise.all([
    loadActiveCampaigns(),
    loadActiveMaterials(),
  ]);
  const now = new Date();
  const liveCampaigns = activeCampaigns.filter((c) => c.startsAt <= now);
  const materialNameById = new Map(allMaterials.map((m) => [m.id, m.name]));
  const featuredCampaign = liveCampaigns[0];

  const pickupsSnap = await adminDb
    .collection('pickups')
    .where('residentId', '==', uid)
    .where('status', '==', 'pending')
    .get();
  const scheduledPickups = pickupsSnap.docs
    .map((d) => d.data() as PickupDoc)
    .filter((p): p is PickupDoc & { routeId: string } => !!p.routeId);

  const deliveryRouteIds = openOrders
    .map((o) => o.deliveryRouteId)
    .filter((id): id is string => !!id);
  const pickupRouteIds = scheduledPickups.map((p) => p.routeId);
  const routeIds = Array.from(new Set([...deliveryRouteIds, ...pickupRouteIds]));
  const routeDates = new Map<string, Date>();
  if (routeIds.length > 0) {
    const routeSnaps = await adminDb.getAll(
      ...routeIds.map((id) => adminDb.collection('routes').doc(id)),
    );
    for (const snap of routeSnaps) {
      if (!snap.exists) continue;
      const route = snap.data() as RouteDoc;
      const ts = route.date?.toDate?.();
      if (ts) routeDates.set(snap.id, ts);
    }
  }

  const headlineOrder = openOrders[0];
  const headlineRouteDate = headlineOrder?.deliveryRouteId
    ? (routeDates.get(headlineOrder.deliveryRouteId) ?? null)
    : null;

  const nextPickupDate =
    scheduledPickups
      .map((p) => routeDates.get(p.routeId))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const totalOpenBags = openOrders.reduce((sum, o) => sum + o.quantity * 10, 0);
  const pct = Math.min(1, pointsBalance / GIFT_CARD_POINTS);
  const ptsToGo = Math.max(0, GIFT_CARD_POINTS - pointsBalance);

  return (
    <SSScreen>
      <SignupBonusModal uid={uid} />

      <SSStatusBarSpacer />
      <SSHeader initial={initial} />

      {/* Yellow points hero */}
      <div style={{ background: SS.yellow, padding: '24px 20px' }}>
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7, marginBottom: 6 }}>
          Hello, {firstName}
        </SSEyebrow>
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 0.95,
            color: SS.ink,
          }}
        >
          {formatDollars(dollarValue)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: SS.ink, marginTop: 6 }}>
          {formatPoints(pointsBalance)} points earned
        </div>
      </div>

      {/* Action stack — Scan + Order */}
      <div style={{ background: '#fff', padding: '20px 20px 8px' }}>
        <SSPillLink
          href="/resident/scan-bag"
          variant="red"
          style={{ fontSize: 22, padding: '22px 24px' }}
        >
          Scan bags
        </SSPillLink>
        <div style={{ height: 12 }} />
        <SSPillLink
          href="/resident/order-bags"
          variant="outline"
          style={{ fontSize: 20, padding: '20px 24px' }}
        >
          {hasEverOrdered ? 'Order more bags' : 'Order bags'}
        </SSPillLink>
      </div>

      {/* Featured campaign — small yellow banner under CTAs */}
      {featuredCampaign && (
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
            <div style={{ fontSize: 24, fontWeight: 900 }}>×{featuredCampaign.multiplier}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.2 }}>
                ×{featuredCampaign.multiplier} on{' '}
                {featuredCampaign.materialIds
                  .map((id) => materialNameById.get(id) ?? id)
                  .join(', ')}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: SS.inkSoft, marginTop: 2 }}>
                Ends in {endsInLabel(featuredCampaign.endsAt, now)}
              </div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 900 }}>→</span>
          </Link>
        </div>
      )}

      {/* Next delivery / pickup */}
      <div
        style={{
          background: '#fff',
          padding: '20px 20px 22px',
          borderTop: `1px solid ${SS.line}`,
          marginTop: 12,
        }}
      >
        <SSEyebrow style={{ marginBottom: 8 }}>Next delivery</SSEyebrow>
        {headlineOrder ? (
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
              {totalOpenBags} bags ·{' '}
              {headlineOrder.status === 'out_for_delivery'
                ? 'Out for delivery'
                : headlineOrder.status === 'pending'
                  ? 'Payment pending'
                  : headlineRouteDate
                    ? formatPickupDay(headlineRouteDate, now)
                    : 'Queued'}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS.inkSoft,
                marginTop: 6,
              }}
            >
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
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS.inkSoft,
                marginTop: 6,
              }}
            >
              Set bags at the curb by 5:30 PM.
            </div>
          </>
        ) : (
          <>
            <div
              style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.7, color: SS.ink }}
            >
              Nothing scheduled
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS.inkSoft,
                marginTop: 6,
              }}
            >
              Order bags to join the next route.
            </div>
          </>
        )}
      </div>

      {/* Sky — reward progress */}
      <div style={{ background: SS.sky, padding: '24px 20px' }}>
        <SSEyebrow style={{ marginBottom: 8 }}>Next $10 gift card</SSEyebrow>
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
          {pct >= 1 ? 'Tap rewards to cash out.' : 'points to your next $10 gift card'}
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
      </div>

      {/* Mint — how it works */}
      <div style={{ background: SS.mint, padding: '28px 20px' }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: -0.8,
            marginBottom: 18,
            color: SS.ink,
          }}
        >
          How it works
        </div>
        {[
          ['Order bags', 'Pick a sheet of 10 bags. Free shipping over $20.'],
          ['Fill & set out', 'Clean recyclables. Place bags at the curb by 5:30pm.'],
          ['Return & redeem', 'Points convert to gift cards. Cash out anytime.'],
        ].map(([t, sub], i) => (
          <div
            key={t}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: SS.ink,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: SS.ink,
                  letterSpacing: -0.3,
                }}
              >
                {t}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: SS.ink,
                  marginTop: 2,
                  lineHeight: 1.35,
                  opacity: 0.7,
                }}
              >
                {sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SSScreen>
  );
}
