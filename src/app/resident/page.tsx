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
  IconArrow,
  IconChevR,
  IconCloud,
  IconDroplet,
  IconFire,
  IconLeaf,
  IconRecycle,
  IconTruck,
} from '@/components/icons/EcoIcons';

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

function formatMastheadDate(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${weekday} · ${month} ${day}`;
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
    ? routeDates.get(headlineOrder.deliveryRouteId) ?? null
    : null;

  const nextPickupDate = scheduledPickups
    .map((p) => routeDates.get(p.routeId))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const pickupIsToday = nextPickupDate ? isSameLocalDay(nextPickupDate, now) : false;
  const totalOpenBags = openOrders.reduce((sum, o) => sum + o.quantity * 10, 0);
  const pct = Math.min(1, pointsBalance / GIFT_CARD_POINTS);
  const ptsToGo = Math.max(0, GIFT_CARD_POINTS - pointsBalance);
  const pickupsCount = ordersSnap.docs.filter(
    (d) => (d.data() as BagOrderDoc).status === 'delivered',
  ).length;

  const pickupCard = nextPickupDate ? (
    <div
      className="mb-4 flex items-center gap-3.5 rounded-[14px] border p-4"
      style={{
        background: pickupIsToday ? '#2D5A3D' : '#FBF7EE',
        borderColor: pickupIsToday ? '#2D5A3D' : '#D9D2C2',
      }}
    >
      <div
        className="flex w-[50px] flex-shrink-0 flex-col items-center overflow-hidden rounded-lg border"
        style={{
          background: '#fff',
          borderColor: pickupIsToday ? 'transparent' : '#D9D2C2',
        }}
      >
        <div
          className="w-full text-center uppercase"
          style={{
            background: '#2D5A3D',
            color: '#fff',
            fontSize: 9,
            padding: '2px 0',
            letterSpacing: 1,
          }}
        >
          {pickupIsToday
            ? 'Today'
            : nextPickupDate.toLocaleDateString('en-US', { month: 'short' })}
        </div>
        <div
          className="py-1 text-center"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 22,
            color: '#1F2A22',
          }}
        >
          {nextPickupDate.getDate()}
        </div>
      </div>
      <div className="flex-1">
        <div
          className="eco-eyebrow"
          style={pickupIsToday ? { color: '#E8EFE6', opacity: 0.85 } : undefined}
        >
          {pickupIsToday ? 'Pickup today' : 'Next pickup'}
        </div>
        <div
          className="mt-0.5"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 17,
            color: pickupIsToday ? '#FBF7EE' : '#1F2A22',
          }}
        >
          {pickupIsToday
            ? 'Have your bags out by 7am.'
            : nextPickupDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
        </div>
      </div>
      <IconChevR size={16} color={pickupIsToday ? '#FBF7EE' : '#5A6358'} />
    </div>
  ) : (
    <div
      className="mb-4 rounded-[14px] border px-4 py-5 text-center"
      style={{ background: '#FBF7EE', borderColor: '#D9D2C2' }}
    >
      <div
        className="italic"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 15,
          color: '#1F2A22',
        }}
      >
        No pickup scheduled.
      </div>
      <div className="mt-1" style={{ fontSize: 11, color: '#5A6358' }}>
        Scan a filled bag at curb to join the next route.
      </div>
    </div>
  );

  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <SignupBonusModal uid={uid} />

      {/* Masthead */}
      <div className="mb-6 flex items-baseline justify-between border-b border-[#D9D2C2] pb-3.5">
        <div>
          <div
            className="italic"
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 14,
              color: '#2D5A3D',
              letterSpacing: 0.5,
            }}
          >
            We Buy Clean Trash
          </div>
          <div
            className="mt-0.5 uppercase"
            style={{ fontSize: 11, color: '#5A6358', letterSpacing: 1.6 }}
          >
            {formatMastheadDate(now)}
          </div>
        </div>
        <Link
          href="/resident/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: '#E8EFE6',
            color: '#2D5A3D',
            fontFamily: 'var(--eco-serif)',
            fontWeight: 600,
          }}
        >
          {initial}
        </Link>
      </div>

      {/* Hero */}
      <section className="mb-7">
        <div style={{ fontSize: 13, color: '#5A6358', marginBottom: 8 }}>
          Hello, {firstName}.
        </div>
        <h1 className="eco-display">
          You&apos;ve turned trash
          <br />
          into <em>{formatDollars(dollarValue)}</em>.
        </h1>
        <div
          className="mt-2.5 italic"
          style={{ fontSize: 12, color: '#5A6358', fontFamily: 'var(--eco-serif)' }}
        >
          {formatPoints(pointsBalance)} points · {pickupsCount} pickup
          {pickupsCount === 1 ? '' : 's'}
        </div>
      </section>

      {/* Reward progress */}
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="eco-eyebrow">Next reward · $10 gift card</div>
          <div style={{ fontSize: 11, color: '#2D5A3D', fontWeight: 600 }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
        <div
          className="h-1 overflow-hidden rounded-sm"
          style={{ background: '#D9D2C2' }}
        >
          <div
            className="h-full"
            style={{ width: `${pct * 100}%`, background: '#2D5A3D' }}
          />
        </div>
        <div
          className="mt-1.5 italic"
          style={{ fontSize: 11, color: '#5A6358', fontFamily: 'var(--eco-serif)' }}
        >
          {pct >= 1 ? 'Ready to redeem.' : `${formatPoints(ptsToGo)} pts to go.`}
        </div>
      </section>

      {/* Campaign */}
      {featuredCampaign && (
        <Link
          href="/resident/calculator"
          className="mb-4 flex items-center gap-3 rounded-[14px] border p-3.5"
          style={{ background: '#F2E8D6', borderColor: 'rgba(160,104,42,0.3)' }}
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: '#fff', color: '#A0682A' }}
          >
            <IconFire size={18} stroke={1.5} />
          </div>
          <div className="flex-1">
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 15,
                color: '#1F2A22',
                fontWeight: 500,
              }}
            >
              ×{featuredCampaign.multiplier} on{' '}
              {featuredCampaign.materialIds
                .map((id) => materialNameById.get(id) ?? id)
                .join(', ')}
            </div>
            <div className="mt-0.5" style={{ fontSize: 11, color: '#A0682A' }}>
              Ends in {endsInLabel(featuredCampaign.endsAt, now)}
            </div>
          </div>
        </Link>
      )}

      {/* Pickup today — surfaced above the order CTA so it's the first thing seen */}
      {pickupIsToday && pickupCard}

      {/* Hero CTA */}
      <Link
        href="/resident/order-bags"
        className="mb-3 block rounded-2xl"
        style={{ background: '#2D5A3D', color: '#FBF7EE', padding: 18 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="uppercase"
              style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1.4 }}
            >
              {hasEverOrdered ? 'Order more bags' : 'Get started'}
            </div>
            <div
              className="mt-1.5"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: -0.3,
              }}
            >
              {hasEverOrdered ? 'Order more bags' : 'Order your first batch'}
            </div>
            <div className="mt-1" style={{ fontSize: 12, opacity: 0.8 }}>
              10 bags per sheet · Free shipping over $20
            </div>
          </div>
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <IconArrow size={14} color="#fff" />
          </div>
        </div>
      </Link>

      {/* Pending order */}
      {headlineOrder && (
        <Link
          href="/resident/order-bags/history"
          className="mb-3 flex items-center gap-3 rounded-[14px] border p-4"
          style={{ background: '#FBF7EE', borderColor: '#D9D2C2' }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: '#E8EFE6', color: '#2D5A3D' }}
          >
            <IconTruck size={20} />
          </div>
          <div className="flex-1">
            <div
              style={{
                fontSize: 13,
                color: '#1F2A22',
                fontWeight: 500,
              }}
            >
              {totalOpenBags} bags arriving
            </div>
            <div className="mt-0.5" style={{ fontSize: 11, color: '#5A6358' }}>
              {headlineOrder.status === 'out_for_delivery'
                ? 'Out for delivery'
                : headlineOrder.status === 'pending'
                  ? 'Payment pending'
                  : headlineRouteDate
                    ? `Arrives ${headlineRouteDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : 'Queued for delivery'}
            </div>
          </div>
          <IconChevR size={16} color="#5A6358" />
        </Link>
      )}

      {/* Next pickup / empty state */}
      {nextPickupDate ? (
        <div
          className="mb-4 flex items-center gap-3.5 rounded-[14px] border p-4"
          style={{
            background: pickupIsToday ? '#2D5A3D' : '#FBF7EE',
            borderColor: pickupIsToday ? '#2D5A3D' : '#D9D2C2',
          }}
        >
          <div
            className="flex w-[50px] flex-shrink-0 flex-col items-center overflow-hidden rounded-lg border"
            style={{
              background: '#fff',
              borderColor: pickupIsToday ? 'transparent' : '#D9D2C2',
            }}
          >
            <div
              className="w-full text-center uppercase"
              style={{
                background: '#2D5A3D',
                color: '#fff',
                fontSize: 9,
                padding: '2px 0',
                letterSpacing: 1,
              }}
            >
              {pickupIsToday
                ? 'Today'
                : nextPickupDate.toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div
              className="py-1 text-center"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 22,
                color: '#1F2A22',
              }}
            >
              {nextPickupDate.getDate()}
            </div>
          </div>
          <div className="flex-1">
            <div
              className="eco-eyebrow"
              style={pickupIsToday ? { color: '#E8EFE6', opacity: 0.85 } : undefined}
            >
              {pickupIsToday ? 'Pickup today' : 'Next pickup'}
            </div>
            <div
              className="mt-0.5"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 17,
                color: pickupIsToday ? '#FBF7EE' : '#1F2A22',
              }}
            >
              {pickupIsToday
                ? 'Have your bags out by 7am.'
                : nextPickupDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
            </div>
          </div>
          <IconChevR size={16} color={pickupIsToday ? '#FBF7EE' : '#5A6358'} />
        </div>
      ) : (
        <div
          className="mb-4 rounded-[14px] border px-4 py-5 text-center"
          style={{ background: '#FBF7EE', borderColor: '#D9D2C2' }}
        >
          <div
            className="italic"
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 15,
              color: '#1F2A22',
            }}
          >
            No pickup scheduled.
          </div>
          <div className="mt-1" style={{ fontSize: 11, color: '#5A6358' }}>
            Scan a filled bag at curb to join the next route.
          </div>
        </div>
      )}

      {/* Contribution */}
      <section
        className="mb-4 py-5"
        style={{ borderTop: '1px solid #D9D2C2', borderBottom: '1px solid #D9D2C2' }}
      >
        <div className="eco-eyebrow mb-3.5">Your contribution</div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { Ic: IconRecycle, value: 0, label: 'lbs recycled' },
            { Ic: IconLeaf, value: 0, label: 'trees saved' },
            { Ic: IconDroplet, value: 0, label: 'gal water' },
            { Ic: IconCloud, value: 0, label: 'lbs CO₂' },
          ].map(({ Ic, value, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Ic size={18} color="#2D5A3D" stroke={1.5} />
              <div>
                <div
                  style={{
                    fontFamily: 'var(--eco-serif)',
                    fontSize: 18,
                    color: '#1F2A22',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
                <div
                  className="mt-1"
                  style={{ fontSize: 10, color: '#5A6358', letterSpacing: 0.3 }}
                >
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Calculator footer link */}
      <Link
        href="/resident/calculator"
        className="flex items-center justify-between py-2"
      >
        <div>
          <div
            className="italic"
            style={{ fontFamily: 'var(--eco-serif)', fontSize: 16, color: '#1F2A22' }}
          >
            What is your trash worth?
          </div>
          <div className="mt-0.5" style={{ fontSize: 11, color: '#5A6358' }}>
            Current rates · 7 commodities
          </div>
        </div>
        <IconArrow size={18} color="#2D5A3D" />
      </Link>
    </main>
  );
}
