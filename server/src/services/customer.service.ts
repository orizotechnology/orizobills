import prisma from "./db";

// =============================================================
// CUSTOMER SERVICE
// =============================================================

export interface CustomerResult {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(c: any): CustomerResult {
  return {
    id:        c.id,
    name:      c.name,
    phone:     c.phone   ?? null,
    email:     c.email   ?? null,
    address:   c.address ?? null,
    gstin:     c.gstin   ?? null,
    balance:   parseFloat(c.balance),
    isActive:  c.isActive,
    createdAt: c.createdAt?.toISOString?.() ?? "",
  };
}

export async function listCustomers(search?: string, limit?: number): Promise<CustomerResult[]> {
  const where = search
    ? {
        isActive: true,
        OR: [
          { name:  { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : { isActive: true };
  const rows = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });
  return rows.map(toResult);
}

export async function getCustomerById(id: string): Promise<CustomerResult | null> {
  const c = await prisma.customer.findUnique({ where: { id } });
  return c ? toResult(c) : null;
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  balance?: number;
}): Promise<CustomerResult> {
  const c = await prisma.customer.create({ data });
  return toResult(c);
}

export async function updateCustomer(id: string, data: Partial<{
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  balance: number;
  isActive: boolean;
}>): Promise<CustomerResult> {
  const c = await prisma.customer.update({ where: { id }, data });
  return toResult(c);
}

export async function deleteCustomer(id: string): Promise<void> {
  await prisma.customer.update({ where: { id }, data: { isActive: false } });
}

/** Adjust customer balance (+ means they owe more, - means they paid). */
export async function adjustCustomerBalance(id: string, delta: number): Promise<void> {
  await prisma.customer.update({
    where: { id },
    data: { balance: { increment: delta } },
  });
}
