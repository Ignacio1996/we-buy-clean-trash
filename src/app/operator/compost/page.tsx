import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import type { UserDoc } from '@/lib/types/user';
import {
  OP_TOK,
  OpBackRow,
  OpDisplay,
  OpEyebrow,
  OpPage,
} from '@/components/operator/Op';
import { IconChevR } from '@/components/icons/EcoIcons';

export const dynamic = 'force-dynamic';

interface SiteRow {
  id: string;
  businessName: string;
  street: string;
  cityLine: string;
  pickupsPerWeek: number;
  affiliationId: string | null;
  binCount: number;
  scheduledToday: boolean;
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
    return {
      id: a.id,
      businessName: a.businessName,
      street: a.street + (a.unit ? `, ${a.unit}` : ''),
      cityLine: `${a.city}, ${a.state} ${a.postalCode}`,
      pickupsPerWeek: a.pickupsPerWeek,
      affiliationId: a.affiliationId,
      binCount: binCounts.get(a.id) ?? 0,
      scheduledToday: Array.isArray(a.collectionDays) && a.collectionDays.includes(today),
      scheduledDays: days.join(', ') || '—',
      scheduledDaysShort: days[0] ?? '—',
    };
  });

  rows.sort((a, b) => {
    if (a.scheduledToday !== b.scheduledToday) return a.scheduledToday ? -1 : 1;
    return a.businessName.localeCompare(b.businessName);
  });
  return rows;
}

export default async function OperatorCompostPage() {
  const session = await requireRole('operator');
  const sites = await loadSites(session.uid);
  const todayCount = sites.filter((s) => s.scheduledToday).length;
  const todayDate = new Date().getDate();

  return (
    <OpPage>
      <OpBackRow label="Today's residential route" href="/operator" />

      <header className="mb-5">
        <OpEyebrow>Compost route</OpEyebrow>
        <OpDisplay className="mt-1.5">
          {todayCount > 0 ? (
            <>
              <em style={{ color: OP_TOK.green, fontStyle: 'italic' }}>{todayCount}</em> site
              {todayCount === 1 ? '' : 's'} on today.
            </>
          ) : (
            <>
              No sites <em style={{ color: OP_TOK.inkSoft, fontStyle: 'italic' }}>scheduled</em>{' '}
              today.
            </>
          )}
        </OpDisplay>
        <div
          className="mt-1.5 italic"
          style={{ fontFamily: OP_TOK.serif, fontSize: 13, color: OP_TOK.inkSoft }}
        >
          {sites.length} active site{sites.length === 1 ? '' : 's'} in your zone.
        </div>
      </header>

      {sites.length === 0 ? (
        <div
          className="mt-4 rounded-[14px] px-4 py-5 text-center italic"
          style={{
            background: OP_TOK.paper,
            border: `1px solid ${OP_TOK.line}`,
            fontFamily: OP_TOK.serif,
            fontSize: 14,
            color: OP_TOK.inkSoft,
          }}
        >
          No commercial sites in your zone yet.
        </div>
      ) : (
        <div style={{ borderTop: `2px solid ${OP_TOK.ink}` }}>
          {sites.map((s, i) => (
            <SiteRow
              key={s.id}
              site={s}
              divider={i < sites.length - 1}
              todayDate={todayDate}
            />
          ))}
        </div>
      )}
    </OpPage>
  );
}

function SiteRow({
  site,
  divider,
  todayDate,
}: {
  site: SiteRow;
  divider: boolean;
  todayDate: number;
}) {
  return (
    <Link
      href={`/operator/compost/${site.id}`}
      className="flex items-start gap-3.5"
      style={{
        padding: '16px 0',
        borderBottom: divider ? `1px solid ${OP_TOK.lineSoft}` : 'none',
        textDecoration: 'none',
      }}
    >
      {/* Day strip */}
      <div className="text-center" style={{ width: 56, paddingTop: 2 }}>
        {site.scheduledToday ? (
          <>
            <div
              className="uppercase"
              style={{
                fontFamily: OP_TOK.sans,
                fontSize: 9,
                color: OP_TOK.green,
                letterSpacing: 1.4,
                fontWeight: 600,
              }}
            >
              Today
            </div>
            <div
              style={{
                fontFamily: OP_TOK.serif,
                fontSize: 22,
                color: OP_TOK.green,
                marginTop: 2,
                letterSpacing: -0.5,
                fontFeatureSettings: '"lnum","tnum"',
              }}
            >
              {todayDate}
            </div>
          </>
        ) : (
          <div
            className="italic"
            style={{
              fontFamily: OP_TOK.serif,
              fontSize: 11,
              color: OP_TOK.inkFaint,
              paddingTop: 8,
            }}
          >
            {site.scheduledDaysShort}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div
            style={{
              fontFamily: OP_TOK.serif,
              fontSize: 17,
              color: OP_TOK.ink,
              letterSpacing: -0.2,
            }}
          >
            {site.businessName}
          </div>
          {site.affiliationId && (
            <span
              className="uppercase"
              style={{
                fontFamily: OP_TOK.sans,
                fontSize: 9,
                color: OP_TOK.amber,
                background: OP_TOK.amberSoft,
                padding: '2px 6px',
                borderRadius: 999,
                letterSpacing: 1.2,
                fontWeight: 500,
              }}
            >
              {site.affiliationId}
            </span>
          )}
        </div>
        <div
          className="mt-1 italic"
          style={{ fontFamily: OP_TOK.serif, fontSize: 12, color: OP_TOK.inkSoft }}
        >
          {site.street}
        </div>
        <div
          className="mt-0.5"
          style={{ fontFamily: OP_TOK.sans, fontSize: 11, color: OP_TOK.inkFaint }}
        >
          {site.cityLine}
        </div>

        <div className="mt-2 flex gap-3.5">
          <Meta label="Bins" value={String(site.binCount)} />
          <Meta label="Per week" value={String(site.pickupsPerWeek)} />
          <Meta label="Days" value={site.scheduledDays} muted />
        </div>
      </div>

      <IconChevR size={14} color={OP_TOK.inkFaint} style={{ marginTop: 18 }} />
    </Link>
  );
}

function Meta({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        className="uppercase"
        style={{
          fontFamily: OP_TOK.sans,
          fontSize: 9,
          color: OP_TOK.inkFaint,
          letterSpacing: 1.2,
        }}
      >
        {label}
      </div>
      <div
        className="mt-0.5"
        style={{
          fontFamily: OP_TOK.serif,
          fontSize: muted ? 11 : 13,
          color: muted ? OP_TOK.inkSoft : OP_TOK.ink,
          fontStyle: muted ? 'italic' : 'normal',
          fontFeatureSettings: '"lnum","tnum"',
        }}
      >
        {value}
      </div>
    </div>
  );
}
