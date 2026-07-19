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
}

export interface PurchaseRow {
  id: string;
  productId: string;
  item: string;
  code: string;
  count: string;
  mrp: number | string;
  size: string;
  qty: number;
  unit: string;
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
  const price = parseFloat(String(r.priceUnit)) || 0;
  const qty   = Number(r.qty) || 0;
  const discP = parseFloat(String(r.discPct)) || 0;
  const taxP  = parseFloat(String(r.taxPct)) || 0;
  const base  = price * qty;
  const discAmt = +(base * discP / 100).toFixed(2);
  const taxable = +(base - discAmt).toFixed(2);
  const taxAmt  = +(taxable * taxP / 100).toFixed(2);
  const amount  = +(taxable + taxAmt).toFixed(2);
  return { ...r, discAmt, taxAmt, amount };
}
