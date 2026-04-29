import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { requireConsumerResident } from '@/lib/auth/residentAccount';
import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  BAGS_PER_SHEET,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/lib/logic/calculateBagOrderTotal';
import { OrderBagsForm } from './OrderBagsForm';
import { EcoMasthead, EcoH1 } from '@/components/resident/eco/Eco';

export default async function OrderBagsPage() {
  const session = await getSession();
  await requireConsumerResident(session!.uid);
  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead
        title="Order bags"
        backHref="/resident"
        rightSlot={
          <Link
            href="/resident/order-bags/history"
            className="text-[11px] uppercase tracking-[1.4px] text-[#5A6358] hover:text-[#2D5A3D]"
          >
            Past orders
          </Link>
        }
      />

      <section className="mb-5">
        <EcoH1>Order bags</EcoH1>
        <p
          className="mt-2 italic"
          style={{
            fontFamily: 'var(--eco-serif)',
            fontSize: 13,
            color: '#5A6358',
          }}
        >
          Each sheet is {BAGS_PER_SHEET} QR-coded bags — delivered on your next pickup.
        </p>
      </section>

      <div className="mb-4 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4 text-[12px] text-[#5A6358]">
        <div className="flex items-baseline justify-between">
          <span className="uppercase" style={{ letterSpacing: 1.4, fontSize: 11 }}>
            Price
          </span>
          <span
            style={{
              fontFamily: 'var(--eco-serif)',
              fontSize: 16,
              color: '#1F2A22',
            }}
          >
            ${BAG_SHEET_UNIT_PRICE_DOLLARS.toFixed(2)}
            <span className="text-[#8A8A7A]"> / sheet</span>
          </span>
        </div>
        <div
          className="mt-2 italic"
          style={{ fontFamily: 'var(--eco-serif)', fontSize: 12, color: '#5A6358' }}
        >
          Free shipping on orders ≥ ${FREE_SHIPPING_THRESHOLD} · otherwise +$
          {SHIPPING_FEE} shipping.
        </div>
      </div>

      <OrderBagsForm unitPrice={BAG_SHEET_UNIT_PRICE_DOLLARS} />
    </main>
  );
}
