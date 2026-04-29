import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { PresignupScanBanner } from '@/components/PresignupScanBanner';
import { WelcomeActions } from './WelcomeActions';
import { EcoH1, EcoMasthead } from '@/components/resident/eco/Eco';

export default async function WelcomePage() {
  const session = await getSession();
  const userSnap = await adminDb.collection('users').doc(session!.uid).get();
  const user = userSnap.data();
  if (user?.onboardingCompletedAt) redirect('/resident');

  const firstName = typeof user?.name === 'string' ? user.name.split(' ')[0] : 'there';

  const steps = [
    {
      n: 1,
      title: 'Order your bags',
      body: 'QR-coded bags delivered on your next route.',
    },
    {
      n: 2,
      title: 'Fill & put out bags',
      body: 'Scan each bag the night before your pickup.',
    },
    {
      n: 3,
      title: 'Earn & redeem',
      body: 'Points convert to Amazon / Walmart gift cards.',
    },
  ];

  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead />

      <section className="mb-7">
        <div style={{ fontSize: 13, color: '#5A6358', marginBottom: 8 }}>
          Welcome, {firstName}.
        </div>
        <EcoH1>Get started in three steps.</EcoH1>
        <div
          className="mt-2.5 italic"
          style={{ fontSize: 12, color: '#5A6358', fontFamily: 'var(--eco-serif)' }}
        >
          About two minutes.
        </div>
      </section>

      <div className="mb-5">
        <PresignupScanBanner />
      </div>

      <ol className="space-y-3">
        {steps.map(({ n, title, body }) => (
          <li
            key={n}
            className="rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: '#E8EFE6',
                  color: '#2D5A3D',
                  fontFamily: 'var(--eco-serif)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {n}
              </span>
              <div className="flex-1">
                <div
                  style={{
                    fontFamily: 'var(--eco-serif)',
                    fontSize: 16,
                    color: '#1F2A22',
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </div>
                <div className="mt-0.5" style={{ fontSize: 12, color: '#5A6358' }}>
                  {body}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <WelcomeActions />
    </main>
  );
}
