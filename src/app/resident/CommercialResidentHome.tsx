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
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <header className="mb-6 flex items-baseline justify-between border-b border-[#D9D2C2] pb-3.5">
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
            Commercial site
          </div>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-6">
        <div style={{ fontSize: 13, color: '#5A6358', marginBottom: 6 }}>
          Hello, {firstName}.
        </div>
        <h1
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 28,
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: -0.4,
            color: '#1F2A22',
          }}
        >
          {account ? account.businessName : 'Welcome'}
        </h1>
      </section>

      {!account ? (
        <section
          className="rounded-[14px] border p-4"
          style={{
            background: '#F2E8D6',
            borderColor: 'rgba(160,104,42,0.3)',
          }}
        >
          <div className="eco-eyebrow" style={{ color: '#A0682A' }}>
            Site not linked
          </div>
          <p
            className="mt-2 italic"
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 14,
              color: '#1F2A22',
              lineHeight: 1.5,
            }}
          >
            Your portal isn&rsquo;t linked to a commercial site yet. Ask the WBCT admin
            to attach your account.
          </p>
        </section>
      ) : (
        <>
          <section className="mb-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
            <div className="eco-eyebrow">Your site</div>
            <div
              className="mt-1.5"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 17,
                color: '#1F2A22',
              }}
            >
              {account.businessName}
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: '#5A6358' }}>
              {account.street}
              {account.unit ? `, ${account.unit}` : ''}, {account.city}, {account.state}{' '}
              {account.postalCode}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Pickups" value={`${account.pickupsPerWeek}× / wk`} />
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

          <section
            className="mb-5 rounded-[14px] border p-5"
            style={{
              background: '#E8EFE6',
              borderColor: 'rgba(45,90,61,0.3)',
            }}
          >
            <div className="eco-eyebrow" style={{ color: '#2D5A3D' }}>
              Last {REPORT_LOOKBACK_DAYS} days
            </div>
            <div
              className="mt-2"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 40,
                fontWeight: 400,
                color: '#1F2A22',
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              {pickupSummary.totalLbs.toLocaleString('en-US')}
              <span
                className="ml-1.5 italic"
                style={{
                  fontFamily: 'var(--eco-serif)',
                  fontSize: 18,
                  color: '#5A6358',
                  fontWeight: 400,
                  letterSpacing: 0,
                }}
              >
                lbs
              </span>
            </div>
            <div
              className="mt-1 italic"
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 13,
                color: '#2D5A3D',
              }}
            >
              diverted across {pickupSummary.rows.length} pickup
              {pickupSummary.rows.length === 1 ? '' : 's'}
            </div>
          </section>

          <section className="mb-4">
            <div className="eco-eyebrow mb-3">Recent pickups</div>
            {pickupSummary.rows.length === 0 ? (
              <div
                className="rounded-[14px] border px-4 py-6 text-center"
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
                  No pickups recorded yet.
                </div>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {pickupSummary.rows.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-[12px] border border-[#D9D2C2] bg-[#FBF7EE] px-4 py-3"
                  >
                    <span
                      style={{
                        fontFamily: 'var(--eco-serif)',
                        fontSize: 14,
                        color: '#1F2A22',
                      }}
                    >
                      {p.dateLabel}
                    </span>
                    <span className="text-[12px]" style={{ color: '#8A8A7A' }}>
                      {p.binCount} bin{p.binCount === 1 ? '' : 's'}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--eco-serif)',
                        fontSize: 15,
                        color: '#2D5A3D',
                        fontFeatureSettings: '"lnum","tnum"',
                      }}
                    >
                      {p.totalWeightLbs} lbs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[10px] border px-2.5 py-2"
      style={{ background: '#F8F3E5', borderColor: '#E8E2D0' }}
    >
      <div
        className="uppercase"
        style={{ fontSize: 9, color: '#8A8A7A', letterSpacing: 1.2, fontWeight: 500 }}
      >
        {label}
      </div>
      <div
        className="mt-0.5"
        style={{
          fontFamily: 'var(--eco-serif)',
          fontSize: 13,
          color: '#1F2A22',
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>
    </div>
  );
}
