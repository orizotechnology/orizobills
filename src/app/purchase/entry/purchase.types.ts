// =============================================================
// PURCHASE ENTRY — Shared Types
// =============================================================

export interface Supplier {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  balance?: number;
}

export interface ProductOption {
  id: string;
  name: string;
  code: string;
  barcode?: string | null;
  mrp: number;
  salePrice: number;
  taxPct: number;
  unit: string;
  secondaryUnit?: string | null;
  conversionRate?: number | null;
}

export interface PurchaseRow {
  id: string;
  productId: string;
  item: string;
  code: string;
  mrp: number | string;
  size: string;
  qty: number;
  unit: string;             // primary unit
  secondaryUnit: string;    // secondary unit label
  conversionRate: number;   // how many secondary = 1 primary
  secQty: number;           // qty in secondary unit (auto-calculated)
  priceUnit: number | string;
  discPct: number | string;
  discAmt: number;
  taxPct: number | string;
  taxAmt: number;
  amount: number;
}

export interface PurchasePayload {
  supplierName: string;
  billNumber: string;
  billDate: string;
  poNumber?: string;
  poDate?: string;
  paymentMethod: string;
  discountPct: number;
  taxType: string;
  terms?: string;
  notes?: string;
  items: {
    itemName: string;
    itemCode: string;
    quantity: number;
    unit: string;
    mrp: number;
    unitPrice: number;
    discountPct: number;
    discountAmt: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
  }[];
}

// Row calculation
export function calcRow(r: PurchaseRow): PurchaseRow {
  const price   = parseFloat(String(r.priceUnit)) || 0;
  const qty     = Number(r.qty) || 0;
  const discP   = parseFloat(String(r.discPct)) || 0;
  const taxP    = parseFloat(String(r.taxPct)) || 0;
  const conv    = r.conversionRate > 0 ? r.conversionRate : 1;
  const secQty  = +(qty * conv).toFixed(3);
  const base    = price * qty;
  const discAmt = +(base * discP / 100).toFixed(2);
  const taxable = +(base - discAmt).toFixed(2);
  const taxAmt  = +(taxable * taxP / 100).toFixed(2);
  const amount  = +(taxable + taxAmt).toFixed(2);
  return { ...r, secQty, discAmt, taxAmt, amount };
}
