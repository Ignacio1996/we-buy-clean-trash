export const FREE_SHIPPING_THRESHOLD = 20;
export const SHIPPING_FEE = 10;
export const BAG_SHEET_UNIT_PRICE_DOLLARS = 5;
export const BAGS_PER_SHEET = 10;

export interface CalculateBagOrderTotalInput {
  quantity: number;
  unitPrice: number;
  /** Number of sheets to fully discount (e.g. 1 for first-sheet-free welcome). */
  freeSheetCredits?: number;
}

export interface CalculateBagOrderTotalResult {
  quantity: number;
  unitPrice: number;
  freeSheetCredits: number;
  billableQuantity: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  freeShipping: boolean;
}

export function calculateBagOrderTotal({
  quantity,
  unitPrice,
  freeSheetCredits = 0,
}: CalculateBagOrderTotalInput): CalculateBagOrderTotalResult {
  const safeQuantity = Math.max(0, Math.floor(quantity));
  const safeCredits = Math.max(0, Math.min(Math.floor(freeSheetCredits), safeQuantity));
  const billableQuantity = safeQuantity - safeCredits;
  const subtotal = billableQuantity * unitPrice;
  const discount = safeCredits * unitPrice;
  // When the credit zeroes the cart out, waive shipping too — a "free first
  // sheet" promo shouldn't generate a shipping charge on its own.
  const freeShipping = subtotal === 0 ? true : subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  return {
    quantity: safeQuantity,
    unitPrice,
    freeSheetCredits: safeCredits,
    billableQuantity,
    subtotal,
    discount,
    shipping,
    total: subtotal + shipping,
    freeShipping,
  };
}
