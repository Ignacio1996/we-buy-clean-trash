import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { BagOrderDoc } from '@/lib/types/bagOrder';
import { EcoMasthead, EcoH1, EcoButton } from '@/components/resident/eco/Eco';
import { IconBox, IconBell, IconGift } from '@/components/icons/EcoIcons';

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
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead title="Order placed" backHref="/resident" />

      <section
        className="mb-5 rounded-[14px] border p-5 text-center"
        style={{
          background: '#E8EFE6',
          borderColor: 'rgba(45,90,61,0.3)',
        }}
      >
        <div className="eco-eyebrow" style={{ color: '#2D5A3D' }}>
          Confirmed
        </div>
        <EcoH1 className="mt-2">Order placed</EcoH1>
        <p
          className="mt-2 italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 14,
            color: '#1F2A22',
          }}
        >
          {order.quantity} sheet{order.quantity === 1 ? '' : 's'} ({order.quantity * 10}{' '}
          bags) · {formatDollars(order.total)}
        </p>
      </section>

      <div className="mb-5 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="eco-eyebrow mb-3">What happens next</div>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: '#E8EFE6' }}
            >
              <IconBox size={16} color="#2D5A3D" stroke={1.5} />
            </span>
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 14,
                color: '#1F2A22',
                lineHeight: 1.4,
              }}
            >
              Your bags and stickers will be delivered on your next pickup route.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: '#E8EFE6' }}
            >
              <IconBell size={16} color="#2D5A3D" stroke={1.5} />
            </span>
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 14,
                color: '#1F2A22',
                lineHeight: 1.4,
              }}
            >
              You&rsquo;ll get a text when the driver is on the way (feature pending).
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: '#E8EFE6' }}
            >
              <IconGift size={16} color="#2D5A3D" stroke={1.5} />
            </span>
            <div
              style={{
                fontFamily: 'var(--eco-serif)',
                fontSize: 14,
                color: '#1F2A22',
                lineHeight: 1.4,
              }}
            >
              Start filling bags — each one earns points after processing.
            </div>
          </li>
        </ul>
      </div>

      <div className="flex justify-center">
        <EcoButton href="/resident" variant="primary" className="w-full">
          Back to home
        </EcoButton>
      </div>
      <p
        className="mt-3 text-center italic"
        style={{ fontFamily: 'var(--eco-serif)', fontSize: 11, color: '#8A8A7A' }}
      >
        Order ID: {order.id}
      </p>
    </main>
  );
}
