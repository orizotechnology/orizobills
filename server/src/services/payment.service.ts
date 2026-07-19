import prisma from "./db";
import { adjustCustomerBalance } from "./customer.service";
import { getNextPaymentInNumber } from "./counter.service";

// =============================================================
// PAYMENT-IN SERVICE
// Records payments received from customers.
// Decreases customer balance (they owe less).
// =============================================================

export interface PaymentInResult {
  id: string;
  paymentNumber: string;
  customerName: string;
  customerId: string | null;
  invoiceId: string | null;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(p: any): PaymentInResult {
  return {
    id:            p.id,
    paymentNumber: p.paymentNumber,
    customerName:  p.customerName,
    customerId:    p.customerId   ?? null,
    invoiceId:     p.invoiceId    ?? null,
    amount:        parseFloat(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate:   p.paymentDate?.toISOString?.() ?? "",
    reference:     p.reference    ?? null,
    notes:         p.notes        ?? null,
    createdAt:     p.createdAt?.toISOString?.() ?? "",
  };
}

export async function listPaymentsIn(page = 1, pageSize = 20): Promise<{ data: PaymentInResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.paymentIn.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentIn.count(),
  ]);
  return { data: rows.map(toResult), total };
}

export async function createPaymentIn(data: {
  customerName: string;
  customerId?: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
}): Promise<PaymentInResult> {
  const paymentNumber = await getNextPaymentInNumber();

  const payment = await prisma.paymentIn.create({
    data: {
      paymentNumber,
      customerName:  data.customerName,
      customerId:    data.customerId ?? null,
      invoiceId:     data.invoiceId  ?? null,
      amount:        data.amount,
      paymentMethod: data.paymentMethod,
      paymentDate:   new Date(data.paymentDate),
      reference:     data.reference ?? null,
      notes:         data.notes     ?? null,
    },
  });

  // ── Reduce customer balance (they paid) ───────────────────
  if (data.customerId) {
    await adjustCustomerBalance(data.customerId, -data.amount);
  }

  // ── Update invoice paidAmt / status ───────────────────────
  if (data.invoiceId) {
    const inv = await prisma.saleInvoice.findUnique({ where: { id: data.invoiceId } });
    if (inv) {
      const newPaid    = parseFloat(String(inv.paidAmt)) + data.amount;
      const newBalance = Math.max(0, parseFloat(String(inv.totalAmt)) - newPaid);
      const newStatus  = newBalance === 0 ? "PAID" : "PARTIAL";
      await prisma.saleInvoice.update({
        where: { id: data.invoiceId },
        data: { paidAmt: newPaid, balanceDue: newBalance, status: newStatus },
      });
    }
  }

  return toResult(payment);
}
