import { adminDb } from '@/lib/firebase/admin';
import type { CommercialAccountDoc } from '@/lib/types/commercialAccount';
import { COLLECTION_DAY_LABELS } from '@/lib/types/commercialAccount';
import type { BinPickupDoc } from '@/lib/types/binPickup';
import { LogoutButton } from '@/components/LogoutButton';

const REPORT_LOOKBACK_DAYS = 30;

interface PickupRow {
  id: string;
  dateLabel: string;
  totalWeightLbs: number;
  binCount: number;
}

async function loadPickupSummary(commercialAccountId: string) {
  const since = new Date();
  since.setDate(since.getDate() - REPORT_LOOKBACK_DAYS);
  const snap = await adminDb
    .collection('binPickups')
    .where('commercialAccountId', '==', commercialAccountId)
    .where('createdAt', '>=', since)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const rows: PickupRow[] = [];
  let totalLbs = 0;
  for (const d of snap.docs) {
    const p = d.data() as BinPickupDoc;
    totalLbs += p.totalWeightLbs;
    const ts = p.createdAt?.toDate?.();
    rows.push({
      id: p.id,
      dateLabel: ts
        ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—',
      totalWeightLbs: p.totalWeightLbs,
      binCount: p.bins?.length ?? 0,
    });
  }
  return { rows, totalLbs };
}

export async function CommercialResidentHome({
  commercialAccountId,
  userName,
}: {
  commercialAccountId: string | null;
  userName: string | null;
}) {
  let account: CommercialAccountDoc | null = null;
  let pickupSummary: { rows: PickupRow[]; totalLbs: number } = { rows: [], totalLbs: 0 };

  if (commercialAccountId) {
    const [accountSnap, summary] = await Promise.all([
      adminDb.collection('commercialAccounts').doc(commercialAccountId).get(),
      loadPickupSummary(commercialAccountId),
    ]);
    if (accountSnap.exists) account = accountSnap.data() as CommercialAccountDoc;
    pickupSummary = summary;
  }

  const firstName = userName?.split(' ')[0] ?? 'there';

  return (
    <main className="px-4 pt-8">
      <header className="flex items-center justify-between pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">We Buy Clean Trash</p>
          <h1 className="text-xl font-semibold text-white">Hi, {firstName} 👋</h1>
          {account && (
            <div className="mt-0.5 text-xs text-gray-400">{account.businessName}</div>
          )}
        </div>
        <LogoutButton />
      </header>

      {!account ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Your portal isn&rsquo;t linked to a commercial site yet. Ask the WBCT admin to attach
          your account.
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Your site</div>
            <div className="mt-1 text-sm text-white">{account.businessName}</div>
            <div className="mt-0.5 text-xs text-gray-400">
              {account.street}
              {account.unit ? `, ${account.unit}` : ''}, {account.city}, {account.state}{' '}
              {account.postalCode}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Stat
                label="Pickups"
                value={`${account.pickupsPerWeek}× / wk`}
              />
              <Stat
                label="Days"
                value={
                  account.collectionDays
                    .map((d) => COLLECTION_DAY_LABELS[d])
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              {account.affiliationId && (
                <Stat label="Program" value={account.affiliationId} />
              )}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
            <div className="text-[11px] uppercase tracking-wide text-blue-200/70">
              Last {REPORT_LOOKBACK_DAYS} days
            </div>
            <div className="mt-1 text-3xl font-bold text-white">
              {pickupSummary.totalLbs.toLocaleString('en-US')} lbs
            </div>
            <div className="text-[11px] text-blue-200/80">
              diverted across {pickupSummary.rows.length} pickup
              {pickupSummary.rows.length === 1 ? '' : 's'}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-sm font-semibold text-white">Recent pickups</div>
            <ul className="mt-2 space-y-1.5">
              {pickupSummary.rows.length === 0 ? (
                <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-500">
                  No pickups recorded yet.
                </li>
              ) : (
                pickupSummary.rows.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  >
                    <span className="text-gray-300">{p.dateLabel}</span>
                    <span className="text-gray-500">
                      {p.binCount} bin{p.binCount === 1 ? '' : 's'}
                    </span>
                    <span className="font-semibold text-white">{p.totalWeightLbs} lbs</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-gray-200">{value}</div>
    </div>
  );
}
