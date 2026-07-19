import prisma from "./db";

// =============================================================
// COUNTER SERVICE
// Generates sequential invoice/order numbers.
// Pattern: PREFIX + zero-padded 4-digit sequence.
// Uses DB count to determine next number (idempotent, safe for reset).
// =============================================================

async function nextNumber(
  prefix: string,
  countFn: () => Promise<number>
): Promise<string> {
  const count = await countFn();
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export const getNextPurchaseNumber  = () => nextNumber("PUR",  () => prisma.purchaseInvoice.count());
export const getNextSaleNumber      = () => nextNumber("INV",  () => prisma.saleInvoice.count());
export const getNextPaymentInNumber = () => nextNumber("PAY",  () => prisma.paymentIn.count());
export const getNextOrderNumber     = () => nextNumber("ORD",  () => prisma.saleOrder.count());
export const getNextChallanNumber   = () => nextNumber("CHN",  () => prisma.deliveryChallan.count());
export const getNextReturnNumber    = () => nextNumber("RET",  () => prisma.saleReturn.count());
export const getNextPurReturnNumber = () => nextNumber("PRN",  () => prisma.purchaseReturn.count());
export const getNextExpenseNumber   = () => nextNumber("EXP",  () => prisma.expense.count());
