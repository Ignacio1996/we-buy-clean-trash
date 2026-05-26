import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import type { TransactionDoc } from '@/lib/types/transaction';
import { RedemptionList, type PilotGate } from './RedemptionList';
import { PILOT_GIFT_CARD_CAP } from '@/app/api/redemptions/route';
import {
  SS,
  SSEyebrow,
  SSScreen,
  SSStatusBarSpacer,
  SSStickerCard,
} from '@/components/resident/ss/SS';
import { IconCoin, IconGift } from '@/components/icons/EcoIcons';

const GIFT_CARD_POINTS = 1_000;

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

  const [userSnap, txSnap, userRedemptionSnap, totalRedemptionSnap] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    adminDb
      .collection('transactions')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
    adminDb
      .collection('redemptions')
      .where('userId', '==', uid)
      .where('status', 'in', ['pending', 'fulfilled'])
      .limit(1)
      .get(),
    adminDb
      .collection('redemptions')
      .where('status', 'in', ['pending', 'fulfilled'])
      .count()
      .get(),
  ]);

  const totalRedemptions = totalRedemptionSnap.data().count;
  const pilotGate: PilotGate = !userRedemptionSnap.empty
    ? 'already_redeemed'
    : totalRedemptions >= PILOT_GIFT_CARD_CAP
      ? 'cap_reached'
      : 'open';

  const user = userSnap.data() ?? {};
  const balance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const progress = Math.min(1, balance / GIFT_CARD_POINTS);
  const pointsToNext = Math.max(0, GIFT_CARD_POINTS - balance);

  const transactions = txSnap.docs.map((d) => d.data() as TransactionDoc);

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          href="/resident"
          aria-label="Back"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: SS.ink,
            textDecoration: 'none',
            fontFamily: SS.sans,
          }}
        >
          ←
        </Link>
        <div style={{ width: 22 }} />
      </div>

      <div style={{ padding: '28px 24px 8px' }}>
        <SSEyebrow style={{ color: SS.brand, marginBottom: 8 }}>Rewards</SSEyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: -1.4,
            lineHeight: 0.95,
            color: SS.ink,
            margin: 0,
          }}
        >
          Cash out points.
        </h1>
      </div>

      {/* Yellow balance hero */}
      <div style={{ padding: '20px 20px 0' }}>
        <div
          style={{
            background: SS.yellow,
            border: `2px solid ${SS.ink}`,
            borderRadius: 18,
            padding: '22px 22px',
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          <SSEyebrow
            icon={<IconCoin size={13} stroke={2.5} />}
            style={{ color: SS.ink, opacity: 0.7, marginBottom: 6 }}
          >
            Your balance
          </SSEyebrow>
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 0.95,
              color: SS.ink,
            }}
          >
            {formatDollars(pointsToDollars(balance))}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: SS.ink,
              marginTop: 6,
              opacity: 0.75,
            }}
          >
            {formatPoints(balance)} points earned
          </div>
        </div>
      </div>

      {/* Sky — progress to next gift card */}
      <div style={{ background: SS.sky, padding: '24px 20px', marginTop: 20 }}>
        <SSEyebrow
          icon={<IconGift size={14} stroke={2.25} />}
          style={{ marginBottom: 8 }}
        >
          Next $10 gift card
        </SSEyebrow>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: -2,
            color: SS.ink,
            lineHeight: 0.95,
            marginBottom: 4,
          }}
        >
          {progress >= 1 ? 'Ready!' : formatPoints(pointsToNext)}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: SS.ink,
            marginBottom: 14,
            opacity: 0.75,
          }}
        >
          {progress >= 1 ? 'Pick a card below to redeem.' : 'points to your next $10 gift card'}
        </div>
        <div
          style={{
            height: 14,
            background: '#fff',
            borderRadius: 999,
            overflow: 'hidden',
            border: `2px solid ${SS.ink}`,
          }}
        >
          <div style={{ height: '100%', width: `${progress * 100}%`, background: SS.brand }} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: SS.ink, opacity: 0.7 }}>
            {formatPoints(balance)} / {formatPoints(GIFT_CARD_POINTS)} pts
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: SS.brand }}>
            {Math.round(progress * 100)}%
          </div>
        </div>
      </div>

      {/* Redemption options */}
      <RedemptionList balance={balance} pilotGate={pilotGate} />

      {/* Points history */}
      <div style={{ padding: '24px 20px 8px' }}>
        <SSEyebrow style={{ marginBottom: 12 }}>Points history</SSEyebrow>
        {transactions.length === 0 ? (
          <SSStickerCard>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: SS.ink,
                letterSpacing: -0.6,
                lineHeight: 1.05,
              }}
            >
              No activity yet.
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SS.inkSoft,
                marginTop: 8,
                lineHeight: 1.4,
              }}
            >
              Pickups and redemptions will show up here.
            </div>
          </SSStickerCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {transactions.map((tx) => {
              const positive = tx.pointsDelta >= 0;
              return (
                <SSStickerCard
                  key={tx.id}
                  style={{ padding: '14px 16px', boxShadow: `0 3px 0 ${SS.ink}` }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color: positive ? SS.green : SS.brand,
                          letterSpacing: -0.5,
                          lineHeight: 1,
                        }}
                      >
                        {positive ? '+' : ''}
                        {formatPoints(tx.pointsDelta)} pts
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: SS.inkSoft,
                          marginTop: 6,
                          lineHeight: 1.35,
                        }}
                      >
                        {tx.description}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: SS.inkSoft,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate((tx.createdAt as { seconds?: number })?.seconds)}
                    </div>
                  </div>
                </SSStickerCard>
              );
            })}
          </div>
        )}
      </div>
    </SSScreen>
  );
}
