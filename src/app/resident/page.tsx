import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { pointsToDollars } from '@/lib/logic/pointsToDollars';
import { LogoutButton } from '@/components/LogoutButton';

function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function ResidentHome() {
  const session = await getSession();
  const uid = session!.uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  if (!user.onboardingCompletedAt) redirect('/resident/welcome');
  const pointsBalance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;
  const name = typeof user.name === 'string' ? user.name.split(' ')[0] : 'there';
  const dollarValue = pointsToDollars(pointsBalance);

  return (
    <main className="px-4 pt-8">
      <header className="flex items-center justify-between pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">We Buy Clean Trash</p>
          <h1 className="text-xl font-semibold text-white">Hi, {name} 👋</h1>
        </div>
        <LogoutButton />
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-gray-400">Points</div>
          <div className="mt-1 text-2xl font-bold text-white">{formatPoints(pointsBalance)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-gray-400">Value</div>
          <div className="mt-1 text-2xl font-bold text-white">{formatDollars(dollarValue)}</div>
        </div>
      </section>

      <Link
        href="/resident/order-bags"
        className="mt-4 flex items-center justify-between rounded-xl border border-green-500/25 bg-green-500/10 p-4"
      >
        <div>
          <div className="font-semibold text-white">🛍️ Order more bags</div>
          <div className="mt-0.5 text-xs text-gray-400">
            10 bags per sheet · Free shipping over $20
          </div>
        </div>
        <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-black">
          Order →
        </span>
      </Link>

      <section className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
        <div className="text-sm font-semibold text-white">🚐 No pickup scheduled yet</div>
        <div className="mt-1 text-xs text-gray-400">
          Order bags and your first pickup will be assigned to an upcoming route.
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
          📱 Text notifications
        </div>
        <div className="mt-1 text-xs text-gray-400">
          30-min reminder + &ldquo;Driver on the way&rdquo; alerts (coming soon)
        </div>
      </section>

      <Link
        href="/resident/calculator"
        className="mt-3 flex items-center justify-between rounded-xl border border-green-500/20 bg-green-500/6 p-4"
      >
        <div>
          <div className="font-semibold text-white">💰 What&rsquo;s your trash worth?</div>
          <div className="mt-0.5 text-xs text-gray-400">
            Prices for cans, bottles, cardboard &amp; more
          </div>
        </div>
        <span className="text-gray-500">→</span>
      </Link>

      <section className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">🌍 Your impact</div>
        <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-300">
          <div>🌳 0 trees saved</div>
          <div>💧 0 gal water</div>
          <div>♻️ 0 lbs recycled</div>
          <div>🏭 0 lbs CO₂</div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          Updates after your first processed bag.
        </div>
      </section>
    </main>
  );
}
