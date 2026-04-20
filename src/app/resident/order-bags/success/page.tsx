import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default async function OrderBagsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const session = await getSession();
  const snap = await adminDb.collection('bagOrders').doc(orderId).get();
  if (!snap.exists) notFound();
  const order = snap.data() as BagOrderDoc;
  if (order.residentId !== session!.uid) notFound();

  return (
    <main className="px-4 pt-8">
      <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-5 text-center">
        <div className="text-3xl">✅</div>
        <h1 className="mt-2 text-xl font-semibold text-white">Order placed</h1>
        <p className="mt-1 text-xs text-gray-400">
          {order.quantity} sheet{order.quantity === 1 ? '' : 's'} ({order.quantity * 10} bags) ·{' '}
          {formatDollars(order.total)}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
        <div className="font-semibold text-white">What happens next</div>
        <ul className="mt-2 space-y-1 text-xs">
          <li>📦 Your bags + stickers will be delivered on your next pickup route.</li>
          <li>🔔 You&rsquo;ll get a text when the driver is on the way (feature pending).</li>
          <li>🎁 Start filling bags — each bag earns points after processing.</li>
        </ul>
      </div>

      <Link
        href="/resident"
        className="mt-4 block rounded-xl bg-white px-3 py-3 text-center text-sm font-semibold text-black"
      >
        Back to home
      </Link>
      <p className="mt-2 text-center text-[10px] text-gray-500">Order ID: {order.id}</p>
    </main>
  );
}
