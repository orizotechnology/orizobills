import { getDefaultPrisma } from "../database/prisma/manager";

// =============================================================
// COUNTER SERVICE
// Generates guaranteed-unique sequential document numbers.
//
// CRITICAL FIX: Uses MAX(invoiceNumber) instead of COUNT(*).
// COUNT(*) breaks when records are deleted — e.g. if INV0001
// to INV0006 exist and all get deleted, COUNT()=0 → next=INV0001
// which collides with any re-created record with that number.
//
// MAX() always gives the highest number ever used, so new numbers
// are always strictly higher than anything that ever existed.
// =============================================================

// Extract the numeric suffix from a prefixed number like "INV0042" → 42
function extractMax(prefix: string, val: string | null): number {
  if (!val) return 0;
  const s = String(val);
  if (!s.startsWith(prefix)) return 0;
  const n = parseInt(s.slice(prefix.length), 10);
  return isNaN(n) ? 0 : n;
}

// Build the next number: max existing + 1
async function nextNumber(
  prefix: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maxFn: (p: any) => Promise<string | null>
): Promise<string> {
  // Use the lazy default prisma for counter queries (branch-agnostic numbering)
  const maxVal = await maxFn(getDefaultPrisma());
  const next   = extractMax(prefix, maxVal) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Finders: return the MAX document number string ─────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxSaleNumber(p: any): Promise<string | null> {
  const row = await p.saleInvoice.findFirst({ orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  return row?.invoiceNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxPurchaseNumber(p: any): Promise<string | null> {
  const row = await p.purchaseInvoice.findFirst({ orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  return row?.invoiceNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxPaymentNumber(p: any): Promise<string | null> {
  const row = await p.paymentIn.findFirst({ orderBy: { paymentNumber: "desc" }, select: { paymentNumber: true } });
  return row?.paymentNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxOrderNumber(p: any): Promise<string | null> {
  const row = await p.saleOrder.findFirst({ orderBy: { orderNumber: "desc" }, select: { orderNumber: true } });
  return row?.orderNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxChallanNumber(p: any): Promise<string | null> {
  const row = await p.deliveryChallan.findFirst({ orderBy: { challanNumber: "desc" }, select: { challanNumber: true } });
  return row?.challanNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxReturnNumber(p: any): Promise<string | null> {
  const row = await p.saleReturn.findFirst({ orderBy: { returnNumber: "desc" }, select: { returnNumber: true } });
  return row?.returnNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxPurReturnNumber(p: any): Promise<string | null> {
  const row = await p.purchaseReturn.findFirst({ orderBy: { returnNumber: "desc" }, select: { returnNumber: true } });
  return row?.returnNumber ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maxExpenseNumber(p: any): Promise<string | null> {
  const row = await p.expense.findFirst({ orderBy: { expenseNumber: "desc" }, select: { expenseNumber: true } });
  return row?.expenseNumber ?? null;
}

// ── Public exports ─────────────────────────────────────────────

export const getNextSaleNumber      = () => nextNumber("INV", maxSaleNumber);
export const getNextPurchaseNumber  = () => nextNumber("PUR", maxPurchaseNumber);
export const getNextPaymentInNumber = () => nextNumber("PAY", maxPaymentNumber);
export const getNextOrderNumber     = () => nextNumber("ORD", maxOrderNumber);
export const getNextChallanNumber   = () => nextNumber("CHN", maxChallanNumber);
export const getNextReturnNumber    = () => nextNumber("RET", maxReturnNumber);
export const getNextPurReturnNumber = () => nextNumber("PRN", maxPurReturnNumber);
export const getNextExpenseNumber   = () => nextNumber("EXP", maxExpenseNumber);
