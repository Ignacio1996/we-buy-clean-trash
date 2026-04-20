import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { TransactionDoc } from '@/lib/types/transaction';
import { RedemptionList } from './RedemptionList';

const GIFT_CARD_POINTS = 100_000;

function formatPoints(n: number) {
  return n.toLocaleString('en-US');
}
function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
function formatDate(seconds: number | undefined) {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function RewardsPage() {
  const session = await getSession();
  const uid = session!.uid;

  const [userSnap, txSnap] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    adminDb
      .collection('transactions')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ]);

  const user = userSnap.data() ?? {};
  const balance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const progress = Math.min(1, balance / GIFT_CARD_POINTS);
  const pointsToNext = Math.max(0, GIFT_CARD_POINTS - balance);

  const transactions = txSnap.docs.map((d) => d.data() as TransactionDoc);

  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">🎁 Rewards</h1>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
        <div className="text-xs text-gray-400">Your balance</div>
        <div className="mt-1 text-3xl font-bold text-white">{formatPoints(balance)} pts</div>
        <div className="mt-1 text-xs text-gray-400">
          = {formatDollars(pointsToDollars(balance))}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-green-500"
            style={{ width: `${(progress * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-gray-500">
          {pointsToNext > 0
            ? `${formatPoints(pointsToNext)} pts until a $10 gift card`
            : 'Ready to redeem a $10 gift card'}
        </div>
      </section>

      <RedemptionList balance={balance} />

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">Points history</div>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/5">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-start justify-between py-2 text-sm">
                <div>
                  <div className={tx.pointsDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {tx.pointsDelta >= 0 ? '+' : ''}
                    {formatPoints(tx.pointsDelta)} pts
                  </div>
                  <div className="text-xs text-gray-400">{tx.description}</div>
                </div>
                <div className="text-[11px] text-gray-500">
                  {formatDate((tx.createdAt as { seconds?: number })?.seconds)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
