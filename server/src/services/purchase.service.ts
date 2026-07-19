import prisma from "./db";
import { addStockIn, subtractStockIn } from "./inventory.service";
import { adjustSupplierBalance } from "./supplier.service";
import { getNextPurchaseNumber, getNextPurReturnNumber } from "./counter.service";

// =============================================================
// PURCHASE SERVICE
// Creating a purchase → increases stockIn for each item
// Purchase return     → decreases stockIn for each item
// =============================================================

export interface PurchaseItem {
  itemName: string;
  itemCode: string;
  productId?: string;
  quantity: number;
  unit: string;
  mrp: number;
  unitPrice: number;
  discountPct: number;
  discountAmt: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PurchaseResult {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierId: string | null;
  billDate: string;
  paymentMethod: string;
  subtotal: number;
  discountAmt: number;
  taxAmt: number;
  totalAmt: number;
  status: string;
  itemCount: number;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(p: any): PurchaseResult {
  return {
    id:            p.id,
    invoiceNumber: p.invoiceNumber,
    supplierName:  p.supplierName,
    supplierId:    p.supplierId ?? null,
    billDate:      p.billDate?.toISOString?.() ?? "",
    paymentMethod: p.paymentMethod,
    subtotal:      parseFloat(p.subtotal),
    discountAmt:   parseFloat(p.discountAmt),
    taxAmt:        parseFloat(p.taxAmt),
    totalAmt:      parseFloat(p.totalAmt),
    status:        p.status,
    itemCount:     p._count?.items ?? p.items?.length ?? 0,
    createdAt:     p.createdAt?.toISOString?.() ?? "",
  };
}

export async function listPurchases(page = 1, pageSize = 20): Promise<{ data: PurchaseResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseInvoice.count({ where: { status: { not: "CANCELLED" } } }),
  ]);
  return { data: rows.map(toResult), total };
}

export async function getPurchaseById(id: string) {
  return prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { items: true },
  });
}

export async function getNextNumber(): Promise<string> {
  return getNextPurchaseNumber();
}

export async function createPurchase(data: {
  supplierName: string;
  supplierId?: string;
  billDate: string;
  poNumber?: string;
  poDate?: string;
  paymentMethod: string;
  discountPct: number;
  taxType: string;
  terms?: string;
  notes?: string;
  items: PurchaseItem[];
}): Promise<PurchaseResult> {
  const invoiceNumber = await getNextPurchaseNumber();

  const subtotal    = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmt = subtotal * (data.discountPct / 100);
  const taxAmt      = data.items.reduce((s, i) => s + i.taxAmount, 0);
  const totalAmt    = subtotal - discountAmt + taxAmt;

  const invoice = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber,
      supplierName:  data.supplierName,
      supplierId:    data.supplierId ?? null,
      billDate:      new Date(data.billDate),
      poNumber:      data.poNumber  ?? null,
      poDate:        data.poDate ? new Date(data.poDate) : null,
      paymentMethod: data.paymentMethod,
      subtotal,
      discountPct:   data.discountPct,
      discountAmt,
      taxAmt,
      totalAmt,
      taxType:       data.taxType,
      terms:         data.terms ?? null,
      notes:         data.notes ?? null,
      status:        "CONFIRMED",
      items: {
        create: data.items.map((i) => ({
          productId:   i.productId ?? null,
          itemName:    i.itemName,
          itemCode:    i.itemCode,
          quantity:    i.quantity,
          unit:        i.unit,
          mrp:         i.mrp,
          unitPrice:   i.unitPrice,
          discountPct: i.discountPct,
          discountAmt: i.discountAmt,
          taxPercent:  i.taxPercent,
          taxAmount:   i.taxAmount,
          totalAmount: i.totalAmount,
        })),
      },
    },
    include: { _count: { select: { items: true } } },
  });

  // ── Stock: increase stockIn for each product ──────────────
  for (const item of data.items) {
    if (item.productId) {
      await addStockIn(item.productId, item.quantity);
    }
  }

  // ── Supplier balance: increase what we owe ────────────────
  if (data.supplierId && data.paymentMethod === "Credit") {
    await adjustSupplierBalance(data.supplierId, totalAmt);
  }

  return toResult(invoice);
}

export async function cancelPurchase(id: string): Promise<void> {
  const inv = await prisma.purchaseInvoice.findUnique({
    where: { id }, include: { items: true },
  });
  if (!inv || inv.status === "CANCELLED") return;

  // Reverse stock
  for (const item of inv.items) {
    if (item.productId) {
      await subtractStockIn(item.productId, parseFloat(String(item.quantity)));
    }
  }

  await prisma.purchaseInvoice.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ── Purchase Return ──────────────────────────────────────────

export interface PurchaseReturnResult {
  id: string;
  returnNumber: string;
  supplierName: string;
  returnDate: string;
  totalAmt: number;
  status: string;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReturnResult(r: any): PurchaseReturnResult {
  return {
    id:           r.id,
    returnNumber: r.returnNumber,
    supplierName: r.supplierName,
    returnDate:   r.returnDate?.toISOString?.() ?? "",
    totalAmt:     parseFloat(r.totalAmt),
    status:       r.status,
    createdAt:    r.createdAt?.toISOString?.() ?? "",
  };
}

export async function listPurchaseReturns(page = 1, pageSize = 20): Promise<{ data: PurchaseReturnResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseReturn.count(),
  ]);
  return { data: rows.map(toReturnResult), total };
}

export async function createPurchaseReturn(data: {
  invoiceId?: string;
  supplierId?: string;
  supplierName: string;
  returnDate: string;
  reason?: string;
  items: Array<{ productId?: string; itemName: string; itemCode: string; quantity: number; unitPrice: number; totalAmount: number }>;
}): Promise<PurchaseReturnResult> {
  const returnNumber = await getNextPurReturnNumber();
  const totalAmt = data.items.reduce((s, i) => s + i.totalAmount, 0);

  const ret = await prisma.purchaseReturn.create({
    data: {
      returnNumber,
      invoiceId:    data.invoiceId    ?? null,
      supplierId:   data.supplierId   ?? null,
      supplierName: data.supplierName,
      returnDate:   new Date(data.returnDate),
      reason:       data.reason ?? null,
      subtotal:     totalAmt,
      totalAmt,
      status:       "CONFIRMED",
    },
  });

  // ── Stock: decrease stockIn (returned goods leave our inventory)
  for (const item of data.items) {
    if (item.productId) {
      await subtractStockIn(item.productId, item.quantity);
    }
  }

  return toReturnResult(ret);
}
