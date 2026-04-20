import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { WelcomeActions } from './WelcomeActions';

export default async function WelcomePage() {
  const session = await getSession();
  const userSnap = await adminDb.collection('users').doc(session!.uid).get();
  const user = userSnap.data();
  if (user?.onboardingCompletedAt) redirect('/resident');

  const firstName = typeof user?.name === 'string' ? user.name.split(' ')[0] : 'there';

  return (
    <main className="px-4 pt-10">
      <h1 className="text-2xl font-semibold text-white">👋 Welcome, {firstName}</h1>
      <p className="mt-1 text-sm text-gray-400">Get started in 3 easy steps — about 2 minutes.</p>

      <ol className="mt-6 space-y-3">
        <li className="rounded-xl border border-white/15 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
              1
            </span>
            <div>
              <div className="font-semibold text-white">Order your bags</div>
              <div className="text-xs text-gray-400">
                QR-coded bags delivered on your next route.
              </div>
            </div>
          </div>
        </li>
        <li className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-gray-400">
              2
            </span>
            <div>
              <div className="font-semibold text-gray-200">Fill &amp; put out bags</div>
              <div className="text-xs text-gray-400">
                Scan each bag the night before your pickup.
              </div>
            </div>
          </div>
        </li>
        <li className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-gray-400">
              3
            </span>
            <div>
              <div className="font-semibold text-gray-200">Earn &amp; redeem</div>
              <div className="text-xs text-gray-400">
                Points convert to Amazon / Walmart gift cards.
              </div>
            </div>
          </div>
        </li>
      </ol>

      <WelcomeActions />
    </main>
  );
}
