import prisma from "./db";
import { getNextExpenseNumber } from "./counter.service";

// =============================================================
// EXPENSE SERVICE
// =============================================================

export interface ExpenseResult {
  id: string;
  expenseNumber: string;
  category: string;
  description: string | null;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(e: any): ExpenseResult {
  return {
    id:             e.id,
    expenseNumber:  e.expenseNumber,
    category:       e.category,
    description:    e.description   ?? null,
    amount:         parseFloat(e.amount),
    paymentMethod:  e.paymentMethod,
    expenseDate:    e.expenseDate?.toISOString?.() ?? "",
    reference:      e.reference     ?? null,
    notes:          e.notes         ?? null,
    createdAt:      e.createdAt?.toISOString?.() ?? "",
  };
}

export async function listExpenses(page = 1, pageSize = 20): Promise<{ data: ExpenseResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count(),
  ]);
  return { data: rows.map(toResult), total };
}

export async function createExpense(data: {
  category: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  reference?: string;
  notes?: string;
}): Promise<ExpenseResult> {
  const expenseNumber = await getNextExpenseNumber();
  const e = await prisma.expense.create({
    data: {
      expenseNumber,
      category:      data.category,
      description:   data.description   ?? null,
      amount:        data.amount,
      paymentMethod: data.paymentMethod,
      expenseDate:   new Date(data.expenseDate),
      reference:     data.reference     ?? null,
      notes:         data.notes         ?? null,
    },
  });
  return toResult(e);
}

export async function updateExpense(id: string, data: Partial<{
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  reference: string;
  notes: string;
}>): Promise<ExpenseResult> {
  const e = await prisma.expense.update({
    where: { id },
    data: {
      ...data,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
    },
  });
  return toResult(e);
}

export async function deleteExpense(id: string): Promise<void> {
  await prisma.expense.delete({ where: { id } });
}
