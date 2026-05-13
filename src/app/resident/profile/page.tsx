import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { LogoutButton } from '@/components/LogoutButton';
import { PhoneField } from './PhoneField';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import { ReferFriend } from '@/components/resident/ReferFriend';
import {
  SS,
  SSEyebrow,
  SSScreen,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDollars(dollars: number): string {
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function memberSince(date: Date | null): string {
  if (!date) return '—';
  return `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function ProfileRow({
  label,
  value,
  hint,
  last,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: last ? 'none' : `1px solid ${SS.line}`,
        gap: 14,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: SS.inkSoft }}>{label}</div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 900,
            color: SS.ink,
            letterSpacing: -0.3,
            marginTop: 2,
          }}
        >
          {value}
        </div>
        {hint && (
          <div style={{ fontSize: 12, fontWeight: 700, color: SS.inkSoft, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  const addressId = typeof user.addressId === 'string' ? user.addressId : null;
  const zoneId = typeof user.zoneId === 'string' ? user.zoneId : null;
  const [addressSnap, zoneSnap] = await Promise.all([
    addressId ? adminDb.collection('addresses').doc(addressId).get() : Promise.resolve(null),
    zoneId ? adminDb.collection('zones').doc(zoneId).get() : Promise.resolve(null),
  ]);
  const address = addressSnap?.data();
  const zone = zoneSnap?.data();
  const pickupDayIdx =
    typeof zone?.pickupDayOfWeek === 'number' ? (zone.pickupDayOfWeek as number) : null;
  const phone = typeof user.phone === 'string' ? user.phone : null;

  const fullName = typeof user.name === 'string' ? user.name : 'Member';
  const initial = fullName.charAt(0).toUpperCase() || '·';
  const createdAt = user.createdAt?.toDate?.() ?? null;

  const pointsBalance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const totalEarned = pointsToDollars(pointsBalance);
  const bagsReturned = typeof user.bagsReturnedCount === 'number' ? user.bagsReturnedCount : 0;
  const lbsRecycled = typeof user.lbsRecycled === 'number' ? user.lbsRecycled : 0;

  const addressLine =
    address &&
    [address.street, address.unit].filter(Boolean).join(' · ');
  const cityLine =
    address && `${address.city ?? ''}${address.state ? `, ${address.state}` : ''} ${address.postalCode ?? ''}`.trim();
  const pickupDayLabel =
    pickupDayIdx !== null && pickupDayIdx >= 0 && pickupDayIdx <= 6
      ? `${DAYS[pickupDayIdx]}s · 6:00 PM`
      : 'Not assigned yet';

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      {/* Back to home */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px 4px',
        }}
      >
        <Link
          href="/resident"
          aria-label="Back to home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: -0.2,
            color: SS.ink,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>←</span>
          <span>Home</span>
        </Link>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: SS.inkSoft,
          }}
        >
          Profile
        </div>
      </div>

      {/* Yellow header block */}
      <div style={{ background: SS.yellow, padding: '24px 20px 26px' }}>
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7 }}>Profile</SSEyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: SS.brand,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 32,
              border: `3px solid ${SS.ink}`,
              boxShadow: `0 4px 0 ${SS.ink}`,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -1,
                lineHeight: 1,
                color: SS.ink,
              }}
            >
              {fullName}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: SS.ink,
                opacity: 0.75,
                marginTop: 4,
              }}
            >
              {memberSince(createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Sky — lifetime stats */}
      <div style={{ background: SS.sky, padding: '22px 20px' }}>
        <SSEyebrow style={{ marginBottom: 10 }}>Lifetime stats</SSEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            [formatDollars(totalEarned), 'total earned'],
            [bagsReturned.toLocaleString('en-US'), 'bags returned'],
            [`${lbsRecycled.toLocaleString('en-US')} lbs`, 'recycled'],
            [pointsBalance.toLocaleString('en-US'), 'points balance'],
          ].map(([v, l]) => (
            <div
              key={l}
              style={{
                background: '#fff',
                border: `2px solid ${SS.ink}`,
                borderRadius: 14,
                padding: '14px 14px',
                boxShadow: `0 4px 0 ${SS.ink}`,
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: -0.9,
                  color: SS.ink,
                  lineHeight: 1,
                }}
              >
                {v}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: SS.inkSoft,
                  marginTop: 6,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account info */}
      <div style={{ background: '#fff', padding: '22px 20px' }}>
        <SSEyebrow style={{ marginBottom: 10 }}>Account info</SSEyebrow>
        <ProfileRow label="Name" value={fullName} />
        <ProfileRow label="Email" value={session!.email ?? '—'} />
        <div
          style={{
            padding: '14px 0',
            borderBottom: `1px solid ${SS.line}`,
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: SS.inkSoft, marginBottom: 6 }}>
            Phone
          </div>
          <PhoneField initial={phone} />
        </div>
        <ProfileRow
          label="Address"
          value={addressLine || '— (add during signup)'}
          hint={cityLine || undefined}
          last
        />
      </div>

      {/* Peach — preferences */}
      <div style={{ background: SS.peach, padding: '22px 20px' }}>
        <SSEyebrow style={{ marginBottom: 10 }}>Preferences</SSEyebrow>
        <ProfileRow
          label="Pickup day"
          value={pickupDayLabel}
          hint={typeof zone?.name === 'string' ? zone.name : undefined}
        />
        <ProfileRow label="Payout method" value="Amazon gift card" />
        <Link
          href="/resident/guide"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 0',
            color: SS.ink,
            textDecoration: 'none',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: SS.inkSoft }}>Help</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: SS.ink,
                letterSpacing: -0.3,
                marginTop: 2,
              }}
            >
              How it works
            </div>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: SS.ink }}>›</span>
        </Link>
      </div>

      {/* Refer a friend */}
      <ReferFriend referralCode={uid} />

      {/* Sign out */}
      <div style={{ padding: '24px 20px 28px' }}>
        <LogoutButton />
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: SS.inkSoft,
            marginTop: 16,
            letterSpacing: 0.5,
          }}
        >
          We Buy Clean Trash · v2
        </div>
      </div>
    </SSScreen>
  );
}
