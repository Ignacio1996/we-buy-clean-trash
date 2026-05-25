import Link from 'next/link';
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
import {
  IconArrow,
  IconBag,
  IconCoin,
  IconGift,
  IconRecycle,
  IconScan,
  IconSparkle,
  IconTruck,
} from '@/components/icons/EcoIcons';

const GIFT_CARD_POINTS = 1_000;

// `pending` is intentionally excluded — those are unpaid bagOrders sitting
// between /api/bag-orders and the Stripe confirm. Surfacing them on the
// dashboard would make abandoned checkouts look like real deliveries.
const OPEN_ORDER_STATUSES: readonly BagOrderStatus[] = ['queued', 'out_for_delivery'];

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

export default async function ResidentHome() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
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
  const routeWindows = new Map<string, { start: string | null; end: string | null }>();
  if (routeIds.length > 0) {
    const routeSnaps = await adminDb.getAll(
      ...routeIds.map((id) => adminDb.collection('routes').doc(id)),
    );
    for (const snap of routeSnaps) {
      if (!snap.exists) continue;
      const route = snap.data() as RouteDoc;
      const ts = route.date?.toDate?.();
      if (ts) routeDates.set(snap.id, ts);
      routeWindows.set(snap.id, {
        start: route.deliveryWindowStart ?? null,
        end: route.deliveryWindowEnd ?? null,
      });
    }
  }

  const headlineOrder = openOrders[0];
  const headlineRouteDate = headlineOrder?.deliveryRouteId
    ? (routeDates.get(headlineOrder.deliveryRouteId) ?? null)
    : null;
  const headlineRouteWindow = headlineOrder?.deliveryRouteId
    ? (routeWindows.get(headlineOrder.deliveryRouteId) ?? null)
    : null;
  const headlineWindowLabel =
    headlineRouteWindow?.start && headlineRouteWindow.end
      ? `${formatTime12(headlineRouteWindow.start)}–${formatTime12(headlineRouteWindow.end)}`
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
        <SSEyebrow
          icon={<IconSparkle size={13} stroke={2.5} />}
          style={{ color: SS.ink, opacity: 0.7, marginBottom: 6 }}
        >
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          <IconCoin size={16} stroke={2.25} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {formatPoints(pointsBalance)} points earned
          </div>
        </div>
      </div>

      {/* Action stack — Scan + Order */}
      <div style={{ background: '#fff', padding: '20px 20px 8px' }}>
        <SSPillLink
          href="/resident/scan-bag"
          variant="red"
          leadingIcon={<IconScan size={24} stroke={2.5} />}
          iconArrow={<IconArrow size={24} stroke={2.5} />}
          style={{ fontSize: 22, padding: '22px 24px' }}
        >
          Scan bags
        </SSPillLink>
        <div style={{ height: 12 }} />
        <SSPillLink
          href="/resident/order-bags"
          variant="outline"
          leadingIcon={<IconBag size={22} stroke={2.5} />}
          iconArrow={<IconArrow size={22} stroke={2.5} />}
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
        <SSEyebrow
          icon={<IconTruck size={14} stroke={2.25} />}
          style={{ marginBottom: 8 }}
        >
          Next delivery
        </SSEyebrow>
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
            {headlineWindowLabel && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: SS.ink,
                  marginTop: 6,
                }}
              >
                Between {headlineWindowLabel}
              </div>
            )}
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
              Leave bags at your designated pickup area.
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
        <SSEyebrow
          icon={<IconGift size={14} stroke={2.25} />}
          style={{ marginBottom: 8 }}
        >
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
          {
            Icon: IconBag,
            title: 'Order bags',
            body: 'Pick a sheet of 10 bags. Free delivery over $20.',
          },
          {
            Icon: IconRecycle,
            title: 'Fill & set out',
            body: 'Clean recyclables. Leave bags at your designated pickup area.',
          },
          {
            Icon: IconCoin,
            title: 'Return & redeem',
            body: 'Points convert to gift cards. Cash out anytime.',
          },
        ].map(({ Icon, title, body }, i) => (
          <div
            key={title}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: SS.ink,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Icon size={22} stroke={2.25} color="#fff" />
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: SS.brand,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  border: '2px solid #fff',
                }}
              >
                {i + 1}
              </div>
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
                {title}
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
                {body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SSScreen>
  );
}
