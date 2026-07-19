import prisma from "./db";

// =============================================================
// SUPPLIER SERVICE
// =============================================================

export interface SupplierResult {
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
function toResult(s: any): SupplierResult {
  return {
    id:        s.id,
    name:      s.name,
    phone:     s.phone   ?? null,
    email:     s.email   ?? null,
    address:   s.address ?? null,
    gstin:     s.gstin   ?? null,
    balance:   parseFloat(s.balance),
    isActive:  s.isActive,
    createdAt: s.createdAt?.toISOString?.() ?? "",
  };
}

export async function listSuppliers(search?: string, limit?: number): Promise<SupplierResult[]> {
  const where = search
    ? {
        isActive: true,
        OR: [
          { name:  { contains: search } },
          { phone: { contains: search } },
        ],
      }
    : { isActive: true };
  const rows = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });
  return rows.map(toResult);
}

export async function getSupplierById(id: string): Promise<SupplierResult | null> {
  const s = await prisma.supplier.findUnique({ where: { id } });
  return s ? toResult(s) : null;
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  balance?: number;
}): Promise<SupplierResult> {
  const s = await prisma.supplier.create({ data });
  return toResult(s);
}

export async function updateSupplier(id: string, data: Partial<{
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  balance: number;
  isActive: boolean;
}>): Promise<SupplierResult> {
  const s = await prisma.supplier.update({ where: { id }, data });
  return toResult(s);
}

export async function deleteSupplier(id: string): Promise<void> {
  await prisma.supplier.update({ where: { id }, data: { isActive: false } });
}

export async function adjustSupplierBalance(id: string, delta: number): Promise<void> {
  await prisma.supplier.update({
    where: { id },
    data: { balance: { increment: delta } },
  });
}
