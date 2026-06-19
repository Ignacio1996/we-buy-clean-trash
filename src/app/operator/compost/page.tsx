import type { CSSProperties } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import type { UserDoc } from '@/lib/types/user';
import type { CompostDestinationDoc } from '@/lib/types/compostDestination';
import { columbusDayStart } from '@/lib/logic/columbusDate';
import {
  SSOP,
  SSOpBadge,
  SSOpEyebrow,
  SSOpHeader,
  SSOpShell,
} from '@/components/operator/SSOp';
import { OnTheWayButton, type DestinationChoice } from './OnTheWayButton';

interface SiteRow {
  id: string;
  businessName: string;
  street: string;
  cityLine: string;
  pickupsPerWeek: number;
  affiliationId: string | null;
  binCount: number;
  scheduledToday: boolean;
  paused: boolean;
  scheduledDays: string;
  scheduledDaysShort: string;
  /** Days until the soonest pickup: 0 = today, 1..6 ahead, Infinity = never. */
  nextPickupInDays: number;
  routeOrder: number | null;
  recyclingCheck: boolean;
  /** True when a pickup/check for this site has been recorded on the open run. */
  done: boolean;
}

function todayDay(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/**
 * Soonest pickup relative to today, by calendar proximity — not raw weekday
 * number. From a Friday, Sunday (ISO 7) is only 2 days out, so it must rank
 * ahead of Monday (ISO 1), which raw numeric sorting would get backwards.
 */
function nextPickup(collectionDays: number[], today: number): { inDays: number; day: number | null } {
  let inDays = Number.POSITIVE_INFINITY;
  let day: number | null = null;
  for (const d of collectionDays) {
    const dist = (d - today + 7) % 7; // 0 = today, 1..6 ahead
    if (dist < inDays) {
      inDays = dist;
      day = d;
    }
  }
  return { inDays, day };
}

async function loadSites(operatorUid: string): Promise<SiteRow[]> {
  const operatorSnap = await adminDb.collection('users').doc(operatorUid).get();
  const operator = operatorSnap.exists ? (operatorSnap.data() as UserDoc) : null;
  const operatorZoneId = operator?.zoneId ?? null;

  let query = adminDb.collection('commercialAccounts').where('active', '==', true);
  if (operatorZoneId) query = query.where('zoneId', '==', operatorZoneId);
  const accountsSnap = await query.get();
  const accounts = accountsSnap.docs.map((d) => d.data() as CommercialAccountDoc);

  const today = todayDay();
  const rows: SiteRow[] = accounts.map((a) => {
    const collectionDays = Array.isArray(a.collectionDays) ? a.collectionDays : [];
    const days = collectionDays.map((n) => COLLECTION_DAY_LABELS[n]).filter(Boolean);
    const paused = a.status === 'paused';
    const next = nextPickup(collectionDays, today);
    return {
      id: a.id,
      businessName: a.businessName,
      street: a.street + (a.unit ? `, ${a.unit}` : ''),
      cityLine: `${a.city}, ${a.state} ${a.postalCode}`,
      pickupsPerWeek: a.pickupsPerWeek,
      affiliationId: a.affiliationId,
      // Declared bin count from the Directory sheet ("# of Bins") — not the
      // count of provisioned QR bag docs, which is often 0 for imported sites.
      binCount: typeof a.binsOnSite === 'number' ? a.binsOnSite : 0,
      // Paused sites are never "due today" — keeps summer-closed schools off the route.
      scheduledToday: !paused && collectionDays.includes(today),
      paused,
      scheduledDays: days.join(', ') || '—',
      // Tile shows the SOONEST upcoming day, not just the first one listed — so a
      // Sunday pickup reads "Sun" instead of the lowest-numbered weekday.
      scheduledDaysShort: next.day ? COLLECTION_DAY_LABELS[next.day] : (days[0] ?? '—'),
      nextPickupInDays: next.inDays,
      routeOrder: typeof a.routeOrder === 'number' ? a.routeOrder : null,
      recyclingCheck: a.siteType === 'recycling_check',
      // Filled in by the page once the open run's recorded stops are known.
      done: false,
    };
  });

  rows.sort((a, b) => {
    // Paused last, then today first, then soonest next pickup (calendar
    // proximity — Sunday from a Friday ranks above Monday), then route order
    // (the order Tia drives), then alphabetical as a final tiebreak.
    if (a.paused !== b.paused) return a.paused ? 1 : -1;
    if (a.scheduledToday !== b.scheduledToday) return a.scheduledToday ? -1 : 1;
    if (a.nextPickupInDays !== b.nextPickupInDays) return a.nextPickupInDays - b.nextPickupInDays;
    const ao = a.routeOrder ?? Number.POSITIVE_INFINITY;
    const bo = b.routeOrder ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.businessName.localeCompare(b.businessName);
  });
  return rows;
}

async function loadDestinations(operatorUid: string): Promise<DestinationChoice[]> {
  const operatorSnap = await adminDb.collection('users').doc(operatorUid).get();
  const operatorZoneId = operatorSnap.exists
    ? ((operatorSnap.data() as UserDoc).zoneId ?? null)
    : null;

  const snap = await adminDb
    .collection('compostDestinations')
    .where('active', '==', true)
    .get();
  return snap.docs
    .map((d) => d.data() as CompostDestinationDoc)
    // Show zone-matched destinations (plus zone-less ones) for this operator.
    .filter((d) => !operatorZoneId || !d.zoneId || d.zoneId === operatorZoneId)
    .map((d) => ({ id: d.id, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Commercial-account ids with a stop recorded today (Columbus local day) by this
 * operator — bin pickups and recycling cart checks both count. Drives the "Picked
 * up" state on the site list so the driver sees at a glance what's already done,
 * with no Start Route / End Route run to manage.
 */
async function loadDoneAccountIds(operatorUid: string): Promise<Set<string>> {
  const dayStart = columbusDayStart(new Date());
  const [pickupsSnap, checksSnap] = await Promise.all([
    adminDb
      .collection('binPickups')
      .where('operatorId', '==', operatorUid)
      .where('createdAt', '>=', dayStart)
      .get(),
    adminDb
      .collection('siteChecks')
      .where('operatorId', '==', operatorUid)
      .where('createdAt', '>=', dayStart)
      .get(),
  ]);
  const ids = new Set<string>();
  for (const d of [...pickupsSnap.docs, ...checksSnap.docs]) {
    const accId = d.get('commercialAccountId');
    if (typeof accId === 'string') ids.add(accId);
  }
  return ids;
}

export default async function OperatorCompostPage({
  searchParams,
}: {
  searchParams: Promise<{ recorded?: string }>;
}) {
  const session = await requireRole('operator');
  const { recorded } = await searchParams;
  const [sites, destinations, doneIds] = await Promise.all([
    loadSites(session.uid),
    loadDestinations(session.uid),
    loadDoneAccountIds(session.uid),
  ]);
  // Name of the site just recorded (if any), for the success banner.
  const recordedName = recorded ? (sites.find((s) => s.id === recorded)?.businessName ?? null) : null;
  // Flag the sites already serviced today so they show as done and sink to the bottom.
  for (const s of sites) s.done = doneIds.has(s.id);

  // Done stops sink to the bottom of the today list (stable otherwise) so the
  // driver's next stop is always near the top.
  const todaySites = sites
    .filter((s) => s.scheduledToday)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const upcomingSites = sites.filter((s) => !s.scheduledToday && !s.paused);
  const pausedSites = sites.filter((s) => s.paused);
  const todayCount = todaySites.length;
  const todayDoneCount = todaySites.filter((s) => s.done).length;

  return (
    <SSOpShell active="compost">
      <SSOpHeader
        kicker="Compost route"
        title={
          todayCount > 0 ? (
            <>
              {todayCount} site{todayCount === 1 ? '' : 's'}
              <br />
              on today.
            </>
          ) : (
            <>
              No sites
              <br />
              today.
            </>
          )
        }
        sub={
          todayCount > 0
            ? `${todayDoneCount} of ${todayCount} done · ${sites.length} active site${sites.length === 1 ? '' : 's'} in your zone`
            : `${sites.length} active site${sites.length === 1 ? '' : 's'} in your zone`
        }
        back="Back to route"
        backHref="/operator"
        headerBg={SSOP.mint}
      />

      {recorded && (
        <div style={{ background: '#fff', padding: '14px 20px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: SSOP.mint,
              border: `2px solid ${SSOP.ink}`,
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: `0 3px 0 ${SSOP.ink}`,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: SSOP.green,
                border: `2px solid ${SSOP.ink}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: SSOP.ink }}>
              {recordedName ? `Recorded — ${recordedName}` : 'Stop recorded.'}
            </span>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: SSOP.inkSoft,
              fontStyle: 'italic',
            }}
          >
            No commercial sites in your zone yet.
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '22px 20px' }}>
          <SiteGroup
            title="On today"
            count={todaySites.length}
            accent={SSOP.yellow}
            tint="rgba(255, 235, 82, 0.22)"
            sites={todaySites}
            emptyNote="No sites scheduled for today — nothing due."
          />
          {upcomingSites.length > 0 && (
            <SiteGroup
              title="Rest of the week"
              count={upcomingSites.length}
              accent={SSOP.sky}
              sites={upcomingSites}
            />
          )}
          {pausedSites.length > 0 && (
            <SiteGroup
              title="Paused"
              count={pausedSites.length}
              accent="#E5E5E5"
              sites={pausedSites}
            />
          )}
        </div>
      )}

      <OnTheWayButton destinations={destinations} />
    </SSOpShell>
  );
}

function SiteGroup({
  title,
  count,
  accent,
  sites,
  tint,
  emptyNote,
}: {
  title: string;
  count: number;
  accent: string;
  sites: SiteRow[];
  /** Optional wash that wraps the group in a tinted, bordered card to make it pop. */
  tint?: string;
  emptyNote?: string;
}) {
  return (
    <div
      style={{
        background: tint ?? 'transparent',
        border: tint ? `2px solid ${SSOP.ink}` : 'none',
        borderRadius: tint ? 16 : 0,
        padding: tint ? '14px 14px 16px' : 0,
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: accent,
            border: `2px solid ${SSOP.ink}`,
            flexShrink: 0,
          }}
        />
        <SSOpEyebrow mb={0} color={SSOP.ink}>
          {title}
        </SSOpEyebrow>
        <span
          style={{
            background: accent,
            color: SSOP.ink,
            border: `2px solid ${SSOP.ink}`,
            borderRadius: 999,
            minWidth: 22,
            height: 22,
            padding: '0 7px',
            fontSize: 11,
            fontWeight: 900,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      </div>
      {sites.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      ) : (
        emptyNote && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: SSOP.inkSoft,
              fontStyle: 'italic',
              padding: '6px 2px',
            }}
          >
            {emptyNote}
          </div>
        )
      )}
    </div>
  );
}

function SiteCard({ site }: { site: SiteRow }) {
  const cardStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: site.done ? SSOP.mint : '#fff',
    border: `2px solid ${SSOP.ink}`,
    borderRadius: 14,
    padding: '14px 14px',
    boxShadow: `0 3px 0 ${SSOP.ink}`,
    textDecoration: 'none',
    opacity: site.paused ? 0.65 : 1,
  };

  const inner = (
    <>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: site.done
            ? SSOP.green
            : site.paused
              ? '#e5e5e5'
              : site.scheduledToday
                ? SSOP.yellow
                : SSOP.sky,
          border: `2px solid ${SSOP.ink}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SSOP.sans,
          flexShrink: 0,
        }}
      >
        {site.done ? (
          <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>✓</span>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: SSOP.ink }}>
            {site.paused ? 'Paused' : site.scheduledToday ? 'Today' : site.scheduledDaysShort}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: SSOP.ink,
              letterSpacing: -0.3,
            }}
          >
            {site.businessName}
          </div>
          {site.done && (
            <SSOpBadge bg={SSOP.green} fg="#fff">
              ✓ Picked up
            </SSOpBadge>
          )}
          {site.affiliationId && (
            <SSOpBadge bg={SSOP.amber} fg="#fff">
              {site.affiliationId}
            </SSOpBadge>
          )}
          {site.recyclingCheck && (
            <SSOpBadge bg={SSOP.sky} fg={SSOP.ink}>
              Recycling
            </SSOpBadge>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 1 }}>
          {site.street} · {site.cityLine}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 4 }}>
          {site.recyclingCheck
            ? `Recycling cart check · ${site.pickupsPerWeek}× / wk · ${site.scheduledDays}`
            : `${site.binCount} bin${site.binCount === 1 ? '' : 's'} · ${site.pickupsPerWeek}× / wk · ${site.scheduledDays}`}
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: site.paused ? '#e5e5e5' : site.done ? '#fff' : SSOP.green,
          color: site.paused ? SSOP.inkSoft : site.done ? SSOP.ink : '#fff',
          border: `2px solid ${SSOP.ink}`,
          borderRadius: 999,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 900,
          boxShadow: site.paused ? 'none' : `0 2px 0 ${SSOP.ink}`,
        }}
      >
        {site.paused
          ? 'View'
          : site.done
            ? 'Edit'
            : `${site.recyclingCheck ? 'Check' : 'Record'} ›`}
      </span>
    </>
  );

  return (
    <Link href={`/operator/compost/${site.id}`} style={cardStyle}>
      {inner}
    </Link>
  );
}
