import { getSession } from '@/lib/auth/session';
import { loadResidentUserDoc } from '@/lib/auth/residentAccount';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import { SignupBonusModal } from '@/components/resident/SignupBonusModal';
import { resolveAccountType } from '@/lib/types/user';
import { CommercialResidentHome } from './CommercialResidentHome';
import { DashboardCards } from './DashboardCards';
import {
  SS,
  SSEyebrow,
  SSHeader,
  SSPillLink,
  SSScreen,
} from '@/components/resident/ss/SS';
import {
  IconArrow,
  IconBag,
  IconCoin,
  IconScan,
  IconSparkle,
} from '@/components/icons/EcoIcons';

function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}
function formatDollars(d: number): string {
  return d.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function ResidentHome() {
  const session = await getSession();
  const uid = session!.uid;
  // Shares its read with the resident layout's loadResidentAccount() via
  // React.cache(), so the page render only hits users/{uid} once.
  const user = await loadResidentUserDoc(uid);
  if (resolveAccountType(user) === 'commercial_site') {
    return (
      <CommercialResidentHome
        commercialAccountId={
          typeof user.commercialAccountId === 'string' ? user.commercialAccountId : null
        }
        userName={typeof user.name === 'string' ? user.name : null}
      />
    );
  }
  const pointsBalance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const fullName = typeof user.name === 'string' ? user.name : 'there';
  const firstName = fullName.split(' ')[0] || 'there';
  const initial = firstName.charAt(0).toUpperCase() || '·';
  const dollarValue = pointsToDollars(pointsBalance);

  return (
    <SSScreen>
      <SignupBonusModal uid={uid} />

      <SSHeader initial={initial} />

      {/* Yellow points hero — server-rendered from the single users/{uid} read.
          Matches the operator yellow header: 20/20/22 padding + ink bottom rule. */}
      <div
        style={{
          background: SS.yellow,
          padding: '20px 20px 22px',
          borderBottom: `2px solid ${SS.ink}`,
        }}
      >
        <SSEyebrow
          icon={<IconSparkle size={13} stroke={2.5} />}
          style={{ color: SS.ink, opacity: 0.7, marginBottom: 6 }}
        >
          Hello, {firstName}
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
          {formatDollars(dollarValue)}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: SS.ink,
            marginTop: 6,
          }}
        >
          <IconCoin size={16} stroke={2.25} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {formatPoints(pointsBalance)} points earned
          </div>
        </div>
      </div>

      {/* Action stack — Scan + Order */}
      <div style={{ background: '#fff', padding: '20px 20px 8px' }}>
        <SSPillLink
          href="/resident/scan-bag"
          variant="red"
          leadingIcon={<IconScan size={24} stroke={2.5} />}
          iconArrow={<IconArrow size={24} stroke={2.5} />}
          style={{ fontSize: 22, padding: '22px 24px' }}
        >
          Scan bags
        </SSPillLink>
        <div style={{ height: 12 }} />
        <SSPillLink
          href="/resident/order-bags"
          variant="outline"
          leadingIcon={<IconBag size={22} stroke={2.5} />}
          iconArrow={<IconArrow size={22} stroke={2.5} />}
          style={{ fontSize: 20, padding: '20px 24px' }}
        >
          Order bags
        </SSPillLink>
      </div>

      {/* Featured campaign, Next delivery, and reward progress
          fetch via /api/resident/home so the shell above paints immediately. */}
      <DashboardCards pointsBalance={pointsBalance} />

      {/* Mint — how it works (sticker cards, matching the signup flow) */}
      <div style={{ background: SS.mint, padding: '28px 20px' }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: -0.8,
            marginBottom: 18,
            color: SS.ink,
          }}
        >
          How it works
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              color: SS.green,
              title: 'Order bags',
              body: 'Pick a sheet of 10 reusable bags, labeled by material.',
              chip: 'Free delivery over $20',
            },
            {
              color: SS.sky,
              title: 'Fill & set out',
              body: 'Clean recyclables. Leave bags at your designated pickup area.',
            },
            {
              color: SS.yellow,
              title: 'Return & redeem',
              body: 'Points convert to gift cards. Cash out anytime.',
            },
          ].map(({ color, title, body, chip }, i) => (
            <div
              key={title}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                background: '#fff',
                border: `2px solid ${SS.ink}`,
                borderRadius: 16,
                padding: '14px 16px',
                boxShadow: `0 4px 0 ${SS.ink}`,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: color,
                  border: `2px solid ${SS.ink}`,
                  color: SS.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: -0.3,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: SS.ink,
                    marginTop: 2,
                    lineHeight: 1.35,
                    opacity: 0.75,
                  }}
                >
                  {body}
                </div>
                {chip ? (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      background: SS.mint,
                      border: `2px solid ${SS.ink}`,
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 900,
                      color: SS.ink,
                      letterSpacing: 0.3,
                    }}
                  >
                    {chip}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SSScreen>
  );
}
