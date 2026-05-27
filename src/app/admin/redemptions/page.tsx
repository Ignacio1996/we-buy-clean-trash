import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { RedemptionDoc } from '@/lib/types/redemption';
import type { UserDoc } from '@/lib/types/user';
import { RedemptionFulfillButton } from './RedemptionFulfillButton';
import { GuideLink } from '@/components/admin/GuideLink';
import { PILOT_GIFT_CARD_CAP } from '@/app/api/redemptions/route';

interface Row {
  redemption: RedemptionDoc;
  userName: string;
  userEmail: string;
}

async function loadRedemptions(status: 'pending' | 'fulfilled'): Promise<Row[]> {
  const snap = await adminDb
    .collection('redemptions')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const redemption = d.data() as RedemptionDoc;
      const userSnap = await adminDb.collection('users').doc(redemption.userId).get();
      const user = userSnap.data() as UserDoc | undefined;
      return {
        redemption,
        userName: user?.name ?? '—',
        userEmail: user?.email ?? '',
      };
    }),
  );
  return rows;
}

function brandLabel(brand: string): string {
  switch (brand) {
    case 'amazon':
      return 'Amazon';
    case 'walmart':
      return 'Walmart';
    case 'pay_trash_bill':
      return 'Pay Trash Bill';
    case 'donate':
      return 'Donate';
    default:
      return brand;
  }
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return '—';
  return ts
    .toDate()
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminRedemptionsPage() {
  const [pending, fulfilled, capCountSnap] = await Promise.all([
    loadRedemptions('pending'),
    loadRedemptions('fulfilled'),
    adminDb
      .collection('redemptions')
      .where('status', 'in', ['pending', 'fulfilled'])
      .count()
      .get(),
  ]);
  const capUsed = capCountSnap.data().count;
  const capRemaining = Math.max(0, PILOT_GIFT_CARD_CAP - capUsed);
  const capBudget = PILOT_GIFT_CARD_CAP * 10;
  const capSpent = capUsed * 10;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Redemption queue</h1>
          <p className="mt-1 text-xs text-gray-500">
            Manual fulfillment for pilot. Email gift-card codes to the resident, then mark fulfilled.
          </p>
        </div>
        <GuideLink href="/user-guides/phase-4-admin.html" />
      </header>

      <section className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold text-white">Pilot gift-card budget</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {capUsed} / {PILOT_GIFT_CARD_CAP} claimed
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${Math.min(100, (capUsed / PILOT_GIFT_CARD_CAP) * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-gray-400">
          ${capSpent} of ${capBudget} marketing budget committed · {capRemaining} cards remaining
          {capRemaining === 0 && ' · new resident redemptions are blocked'}
        </div>
      </section>

      <h2 className="text-sm font-semibold text-white">
        Pending ({pending.length})
      </h2>
      <QueueTable rows={pending} showFulfill brandLabel={brandLabel} formatDate={formatDate} />

      <h2 className="mt-10 text-sm font-semibold text-white">
        Recently fulfilled
      </h2>
      <QueueTable rows={fulfilled} brandLabel={brandLabel} formatDate={formatDate} />
    </div>
  );
}

function QueueTable({
  rows,
  showFulfill = false,
  brandLabel,
  formatDate,
}: {
  rows: Row[];
  showFulfill?: boolean;
  brandLabel: (brand: string) => string;
  formatDate: (ts: Timestamp | null) => string;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Resident</th>
            <th className="px-4 py-3 font-medium">Brand</th>
            <th className="px-4 py-3 text-right font-medium">Points</th>
            <th className="px-4 py-3 text-right font-medium">$ value</th>
            <th className="px-4 py-3 font-medium">Requested</th>
            <th className="px-4 py-3 font-medium">{showFulfill ? 'Action' : 'Code'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-500">
                Nothing here yet.
              </td>
            </tr>
          ) : (
            rows.map(({ redemption, userName, userEmail }) => (
              <tr key={redemption.id} className="text-gray-300">
                <td className="px-4 py-3">
                  <div className="text-white">{userName}</div>
                  <div className="text-[11px] text-gray-500">{userEmail}</div>
                </td>
                <td className="px-4 py-3">{brandLabel(redemption.brand)}</td>
                <td className="px-4 py-3 text-right">
                  {redemption.pointsSpent.toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-right">${redemption.dollarValue.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(redemption.createdAt)}</td>
                <td className="px-4 py-3">
                  {showFulfill ? (
                    <RedemptionFulfillButton id={redemption.id} />
                  ) : (
                    <span className="text-[11px] text-gray-500">
                      {redemption.fulfillmentCode ?? '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
