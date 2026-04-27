import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import { LogoutButton } from '@/components/LogoutButton';
import type { UserDoc } from '@/lib/types/user';

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
}

function todayDay(): number {
  // ISO weekday: 1 = Mon, … 7 = Sun
  const d = new Date().getDay(); // 0 = Sun … 6 = Sat
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

  // Bin counts per account in one pass
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
  const rows: SiteRow[] = accounts.map((a) => ({
    id: a.id,
    businessName: a.businessName,
    street: a.street + (a.unit ? `, ${a.unit}` : ''),
    cityLine: `${a.city}, ${a.state} ${a.postalCode}`,
    pickupsPerWeek: a.pickupsPerWeek,
    affiliationId: a.affiliationId,
    binCount: binCounts.get(a.id) ?? 0,
    scheduledToday: Array.isArray(a.collectionDays) && a.collectionDays.includes(today),
    scheduledDays: Array.isArray(a.collectionDays)
      ? a.collectionDays.map((n) => COLLECTION_DAY_LABELS[n]).filter(Boolean).join(', ')
      : '—',
  }));

  // Today's stops first, then by name
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

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-neutral-950 px-4 pb-16 pt-6 text-gray-100">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Operator</div>
          <h1 className="mt-0.5 text-lg font-semibold text-white">Compost route</h1>
          <div className="mt-0.5 text-xs text-gray-400">
            {todayCount} site{todayCount === 1 ? '' : 's'} scheduled today
          </div>
        </div>
        <LogoutButton />
      </header>

      <Link
        href="/operator"
        className="mt-3 block text-[11px] text-gray-400 underline hover:text-gray-200"
      >
        ← Today&apos;s residential route
      </Link>

      <section className="mt-4 space-y-2">
        {sites.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
            No commercial sites in your zone yet.
          </div>
        ) : (
          sites.map((s) => (
            <Link
              key={s.id}
              href={`/operator/compost/${s.id}`}
              className={`block rounded-xl border p-4 transition-colors ${
                s.scheduledToday
                  ? 'border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/15'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-white">{s.businessName}</div>
                    {s.affiliationId && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                        {s.affiliationId}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-300">{s.street}</div>
                  <div className="text-[11px] text-gray-500">{s.cityLine}</div>
                </div>
                {s.scheduledToday && (
                  <span className="shrink-0 rounded-full border border-blue-300/40 bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-100">
                    TODAY
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-gray-400">
                <Stat label="Bins" value={String(s.binCount)} />
                <Stat label="/ week" value={String(s.pickupsPerWeek)} />
                <Stat label="Days" value={s.scheduledDays || '—'} />
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-xs text-gray-200">{value}</div>
    </div>
  );
}
