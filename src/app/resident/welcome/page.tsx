import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { PresignupScanBanner } from '@/components/PresignupScanBanner';
import { WelcomeActions } from './WelcomeActions';
import {
  SS,
  SSEyebrow,
  SSScreen,
  SSStatusBarSpacer,
} from '@/components/resident/ss/SS';

export default async function WelcomePage() {
  const session = await getSession();
  const userSnap = await adminDb.collection('users').doc(session!.uid).get();
  const user = userSnap.data();
  if (user?.onboardingCompletedAt) redirect('/resident');

  const firstName = typeof user?.name === 'string' ? user.name.split(' ')[0] : 'there';

  return (
    <SSScreen>
      <SSStatusBarSpacer />

      <div
        style={{
          padding: '32px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <SSEyebrow style={{ color: SS.ink, opacity: 0.7 }}>We Buy Clean Trash</SSEyebrow>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: -1.6,
            lineHeight: 0.95,
            color: SS.ink,
          }}
        >
          Welcome, {firstName}. Your trash is{' '}
          <span style={{ color: SS.green }}>worth money.</span>
        </div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: SS.ink,
            opacity: 0.75,
            lineHeight: 1.4,
          }}
        >
          We pick up your clean recyclables at the curb and pay you in gift cards. No sorting
          machines. No bins to lug.
        </div>

        <PresignupScanBanner />

        <div
          style={{
            background: '#fff',
            border: `2px solid ${SS.ink}`,
            borderRadius: 18,
            padding: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            boxShadow: `0 4px 0 ${SS.ink}`,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: SS.green,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            $
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: SS.ink, letterSpacing: -0.5 }}>
              $10 gift card
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: SS.inkSoft }}>
              ≈ 4 weeks of pickups
            </div>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          {[
            ['Order bags', 'A sheet of 10 QR-coded bags arrives on your next route.'],
            ['Fill & set out', 'Clean recyclables. Set bags at the curb by 5:30 PM.'],
            ['Return & redeem', 'Points convert to Amazon / Walmart gift cards.'],
          ].map(([t, sub], i) => (
            <div
              key={t}
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 0',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: SS.ink,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: SS.ink,
                    letterSpacing: -0.3,
                  }}
                >
                  {t}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: SS.ink,
                    marginTop: 2,
                    lineHeight: 1.4,
                    opacity: 0.7,
                  }}
                >
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', padding: '20px 24px 28px' }}>
        <WelcomeActions />
      </div>
    </SSScreen>
  );
}
