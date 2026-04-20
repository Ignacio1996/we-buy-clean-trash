export const FREE_SHIPPING_THRESHOLD = 20;
export const SHIPPING_FEE = 10;
export const BAG_SHEET_UNIT_PRICE_DOLLARS = 5;
export const BAGS_PER_SHEET = 10;

export interface CalculateBagOrderTotalInput {
  quantity: number;
  unitPrice: number;
}

export interface CalculateBagOrderTotalResult {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shipping: number;
  total: number;
  freeShipping: boolean;
}

export function calculateBagOrderTotal({
  quantity,
  unitPrice,
}: CalculateBagOrderTotalInput): CalculateBagOrderTotalResult {
  const safeQuantity = Math.max(0, Math.floor(quantity));
  const subtotal = safeQuantity * unitPrice;
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  return {
    quantity: safeQuantity,
    unitPrice,
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShipping,
  };
}
