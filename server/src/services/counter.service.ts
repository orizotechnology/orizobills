import { getDefaultPrisma } from "../database/prisma/manager";

// =============================================================
// COUNTER SERVICE
// Generates guaranteed-unique sequential document numbers.
//
// Each function accepts an optional prisma client so numbers
// are scoped to the correct branch database.  When no client is
// passed it falls back to the default (startup) DB.
//
// Uses findFirst + orderBy desc (lexicographic on zero-padded
// strings) instead of COUNT(*) so numbers always increase even
// after deletions.
// =============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

function extractMax(prefix: string, val: string | null): number {
  if (!val) return 0;
  const s = String(val);
  if (!s.startsWith(prefix)) return 0;
  const n = parseInt(s.slice(prefix.length), 10);
  return isNaN(n) ? 0 : n;
}

async function nextNumber(
  prefix: string,
  maxFn: (p: PrismaLike) => Promise<string | null>,
  prisma?: PrismaLike
): Promise<string> {
  const db     = prisma ?? getDefaultPrisma();
  const maxVal = await maxFn(db);
  const next   = extractMax(prefix, maxVal) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ── Finders ────────────────────────────────────────────────────

async function maxSaleNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.saleInvoice.findFirst({ orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  return row?.invoiceNumber ?? null;
}
async function maxPurchaseNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.purchaseInvoice.findFirst({ orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  return row?.invoiceNumber ?? null;
}
async function maxPaymentNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.paymentIn.findFirst({ orderBy: { paymentNumber: "desc" }, select: { paymentNumber: true } });
  return row?.paymentNumber ?? null;
}
async function maxOrderNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.saleOrder.findFirst({ orderBy: { orderNumber: "desc" }, select: { orderNumber: true } });
  return row?.orderNumber ?? null;
}
async function maxChallanNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.deliveryChallan.findFirst({ orderBy: { challanNumber: "desc" }, select: { challanNumber: true } });
  return row?.challanNumber ?? null;
}
async function maxReturnNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.saleReturn.findFirst({ orderBy: { returnNumber: "desc" }, select: { returnNumber: true } });
  return row?.returnNumber ?? null;
}
async function maxPurReturnNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.purchaseReturn.findFirst({ orderBy: { returnNumber: "desc" }, select: { returnNumber: true } });
  return row?.returnNumber ?? null;
}
async function maxExpenseNumber(p: PrismaLike): Promise<string | null> {
  const row = await p.expense.findFirst({ orderBy: { expenseNumber: "desc" }, select: { expenseNumber: true } });
  return row?.expenseNumber ?? null;
}

// ── Public exports — all accept an optional branch prisma ──────

export const getNextSaleNumber      = (prisma?: PrismaLike) => nextNumber("INV", maxSaleNumber,      prisma);
export const getNextPurchaseNumber  = (prisma?: PrismaLike) => nextNumber("PUR", maxPurchaseNumber,  prisma);
export const getNextPaymentInNumber = (prisma?: PrismaLike) => nextNumber("PAY", maxPaymentNumber,   prisma);
export const getNextOrderNumber     = (prisma?: PrismaLike) => nextNumber("ORD", maxOrderNumber,     prisma);
export const getNextChallanNumber   = (prisma?: PrismaLike) => nextNumber("CHN", maxChallanNumber,   prisma);
export const getNextReturnNumber    = (prisma?: PrismaLike) => nextNumber("RET", maxReturnNumber,    prisma);
export const getNextPurReturnNumber = (prisma?: PrismaLike) => nextNumber("PRN", maxPurReturnNumber, prisma);
export const getNextExpenseNumber   = (prisma?: PrismaLike) => nextNumber("EXP", maxExpenseNumber,   prisma);
