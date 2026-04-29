import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { TransactionDoc } from '@/lib/types/transaction';
import { RedemptionList } from './RedemptionList';
import { EcoMasthead, EcoH1 } from '@/components/resident/eco/Eco';

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
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead title="Rewards" backHref="/resident" />

      <section className="mb-5">
        <EcoH1>Rewards</EcoH1>
      </section>

      <section className="mb-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-5 text-center">
        <div className="eco-eyebrow">Your balance</div>
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
          {formatPoints(balance)}
        </div>
        <div
          className="mt-1 italic"
          style={{ fontFamily: 'var(--eco-serif)', fontSize: 13, color: '#5A6358' }}
        >
          points · {formatDollars(pointsToDollars(balance))}
        </div>
        <div
          className="mt-4 h-1 overflow-hidden rounded-sm"
          style={{ background: '#D9D2C2' }}
        >
          <div
            className="h-full"
            style={{ width: `${(progress * 100).toFixed(1)}%`, background: '#2D5A3D' }}
          />
        </div>
        <div
          className="mt-2 italic"
          style={{ fontFamily: 'var(--eco-serif)', fontSize: 12, color: '#5A6358' }}
        >
          {pointsToNext > 0
            ? `${formatPoints(pointsToNext)} pts until a $10 gift card`
            : 'Ready to redeem a $10 gift card.'}
        </div>
      </section>

      <RedemptionList balance={balance} />

      <section className="mt-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow mb-1">Points history</div>
        {transactions.length === 0 ? (
          <p
            className="mt-3 italic"
            style={{ fontFamily: 'var(--eco-serif)', fontSize: 14, color: '#5A6358' }}
          >
            No activity yet.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-[#E8E2D0]">
            {transactions.map((tx) => {
              const positive = tx.pointsDelta >= 0;
              return (
                <li key={tx.id} className="flex items-start justify-between py-3">
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--eco-serif)',
                        fontSize: 16,
                        color: positive ? '#2D5A3D' : '#9A4B26',
                        letterSpacing: -0.2,
                      }}
                    >
                      {positive ? '+' : ''}
                      {formatPoints(tx.pointsDelta)} pts
                    </div>
                    <div className="mt-0.5 text-[12px]" style={{ color: '#5A6358' }}>
                      {tx.description}
                    </div>
                  </div>
                  <div className="text-[11px]" style={{ color: '#8A8A7A' }}>
                    {formatDate((tx.createdAt as { seconds?: number })?.seconds)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
