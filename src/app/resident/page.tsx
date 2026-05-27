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
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';
import {
  IconArrow,
  IconBag,
  IconCoin,
  IconRecycle,
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

      <SSStatusBarSpacer />
      <SSHeader initial={initial} />

      {/* Yellow points hero — server-rendered from the single users/{uid} read */}
      <div style={{ background: SS.yellow, padding: '24px 20px' }}>
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

      {/* Mint — how it works */}
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
        {[
          {
            Icon: IconBag,
            title: 'Order bags',
            body: 'Pick a sheet of 10 bags. Free delivery over $20.',
          },
          {
            Icon: IconRecycle,
            title: 'Fill & set out',
            body: 'Clean recyclables. Leave bags at your designated pickup area.',
          },
          {
            Icon: IconCoin,
            title: 'Return & redeem',
            body: 'Points convert to gift cards. Cash out anytime.',
          },
        ].map(({ Icon, title, body }, i) => (
          <div
            key={title}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: SS.ink,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Icon size={22} stroke={2.25} color="#fff" />
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: SS.brand,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  border: '2px solid #fff',
                }}
              >
                {i + 1}
              </div>
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div
                style={{
                  fontSize: 19,
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
                  opacity: 0.7,
                }}
              >
                {body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SSScreen>
  );
}
