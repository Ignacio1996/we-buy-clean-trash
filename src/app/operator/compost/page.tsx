import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import type { UserDoc } from '@/lib/types/user';
import type { CompostDestinationDoc } from '@/lib/types/compostDestination';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import type { CompostRouteDoc } from '@/lib/types/compostRoute';
import { summarizeCompostRoute } from '@/lib/logic/compostRouteSummary';
import { columbusTimeLabel } from '@/lib/logic/columbusDate';
import {
  SSOP,
  SSOpBadge,
  SSOpEyebrow,
  SSOpHeader,
  SSOpShell,
} from '@/components/operator/SSOp';
import { OnTheWayButton, type DestinationChoice } from './OnTheWayButton';
import { CompostRouteControl, type ActiveRouteView } from './CompostRouteControl';

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
}

function todayDay(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

async function loadSites(operatorUid: string): Promise<SiteRow[]> {
  const operatorSnap = await adminDb.collection('users').doc(operatorUid).get();
  const operator = operatorSnap.exists ? (operatorSnap.data() as UserDoc) : null;
  const operatorZoneId = operator?.zoneId ?? null;

  let query = adminDb.collection('commercialAccounts').where('active', '==', true);
  if (operatorZoneId) query = query.where('zoneId', '==', operatorZoneId);
  const accountsSnap = await query.get();
  const accounts = accountsSnap.docs.map((d) => d.data() as CommercialAccountDoc);

  const binCounts = new Map<string, number>();
  if (accounts.length > 0) {
    const binsSnap = await adminDb.collection('bags').where('reusable', '==', true).get();
    binsSnap.docs.forEach((d) => {
      const accId = d.get('commercialAccountId');
      if (typeof accId === 'string') {
        binCounts.set(accId, (binCounts.get(accId) ?? 0) + 1);
      }
    });
  }

  const today = todayDay();
  const rows: SiteRow[] = accounts.map((a) => {
    const days = Array.isArray(a.collectionDays)
      ? a.collectionDays.map((n) => COLLECTION_DAY_LABELS[n]).filter(Boolean)
      : [];
    const paused = a.status === 'paused';
    return {
      id: a.id,
      businessName: a.businessName,
      street: a.street + (a.unit ? `, ${a.unit}` : ''),
      cityLine: `${a.city}, ${a.state} ${a.postalCode}`,
      pickupsPerWeek: a.pickupsPerWeek,
      affiliationId: a.affiliationId,
      binCount: binCounts.get(a.id) ?? 0,
      // Paused sites are never "due today" — keeps summer-closed schools off the route.
      scheduledToday:
        !paused && Array.isArray(a.collectionDays) && a.collectionDays.includes(today),
      paused,
      scheduledDays: days.join(', ') || '—',
      scheduledDaysShort: days[0] ?? '—',
    };
  });

  rows.sort((a, b) => {
    // Paused last, then today first, then alphabetical.
    if (a.paused !== b.paused) return a.paused ? 1 : -1;
    if (a.scheduledToday !== b.scheduledToday) return a.scheduledToday ? -1 : 1;
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

/** The operator's open run (if any) with a live tally for the run banner. */
async function loadActiveRoute(operatorUid: string): Promise<ActiveRouteView | null> {
  const snap = await adminDb
    .collection('compostRoutes')
    .where('operatorId', '==', operatorUid)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const route = snap.docs[0].data() as CompostRouteDoc;

  const pickupsSnap = await adminDb
    .collection('binPickups')
    .where('routeId', '==', route.id)
    .get();
  const tally = summarizeCompostRoute(pickupsSnap.docs.map((d) => d.data() as BinPickupDoc));
  const startedAt = route.startedAt?.toDate?.() ?? null;

  return {
    id: route.id,
    startedLabel: startedAt ? columbusTimeLabel(startedAt) : null,
    stops: tally.stops,
    skipped: tally.skipped,
    totalWeightLbs: tally.totalWeightLbs,
  };
}

export default async function OperatorCompostPage() {
  const session = await requireRole('operator');
  const [sites, destinations, activeRoute] = await Promise.all([
    loadSites(session.uid),
    loadDestinations(session.uid),
    loadActiveRoute(session.uid),
  ]);
  const todayCount = sites.filter((s) => s.scheduledToday).length;

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
        sub={`${sites.length} active site${sites.length === 1 ? '' : 's'} in your zone`}
        back="Back to route"
        backHref="/operator"
        headerBg={SSOP.mint}
      />

      <div style={{ background: '#fff', padding: '18px 20px 0' }}>
        <CompostRouteControl active={activeRoute} />
      </div>

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
          <SSOpEyebrow>Sites</SSOpEyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        </div>
      )}

      <OnTheWayButton destinations={destinations} />
    </SSOpShell>
  );
}

function SiteCard({ site }: { site: SiteRow }) {
  return (
    <Link
      href={`/operator/compost/${site.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        border: `2px solid ${SSOP.ink}`,
        borderRadius: 14,
        padding: '14px 14px',
        boxShadow: `0 3px 0 ${SSOP.ink}`,
        textDecoration: 'none',
        opacity: site.paused ? 0.65 : 1,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: site.paused ? '#e5e5e5' : site.scheduledToday ? SSOP.yellow : SSOP.sky,
          border: `2px solid ${SSOP.ink}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SSOP.sans,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: SSOP.ink }}>
          {site.paused ? 'Paused' : site.scheduledToday ? 'Today' : site.scheduledDaysShort}
        </span>
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
          {site.affiliationId && (
            <SSOpBadge bg={SSOP.amber} fg="#fff">
              {site.affiliationId}
            </SSOpBadge>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 1 }}>
          {site.street} · {site.cityLine}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: SSOP.inkSoft, marginTop: 4 }}>
          {site.binCount} bin{site.binCount === 1 ? '' : 's'} · {site.pickupsPerWeek}× / wk · {site.scheduledDays}
        </div>
      </div>
      <span style={{ fontSize: 22, fontWeight: 900, color: SSOP.ink }}>›</span>
    </Link>
  );
}
