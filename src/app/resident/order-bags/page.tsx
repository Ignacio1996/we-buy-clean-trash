import {
  BAG_SHEET_UNIT_PRICE_DOLLARS,
  BAGS_PER_SHEET,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
} from '@/lib/logic/calculateBagOrderTotal';
import { OrderBagsForm } from './OrderBagsForm';

export default function OrderBagsPage() {
  return (
    <main className="px-4 pt-8">
      <h1 className="text-xl font-semibold text-white">🛍️ Order bags</h1>
      <p className="mt-1 text-xs text-gray-400">
        Each sheet is {BAGS_PER_SHEET} QR-coded bags — delivered on your next pickup.
      </p>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
        <div>
          Price: <span className="text-white">${BAG_SHEET_UNIT_PRICE_DOLLARS.toFixed(2)}</span> /
          sheet
        </div>
        <div className="mt-0.5">
          Free shipping on orders ≥ ${FREE_SHIPPING_THRESHOLD} · otherwise +${SHIPPING_FEE} shipping
        </div>
      </div>
      <OrderBagsForm unitPrice={BAG_SHEET_UNIT_PRICE_DOLLARS} />
    </main>
  );
}
