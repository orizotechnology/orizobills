import prisma from "./db";
import { addStockOut, subtractStockOut } from "./inventory.service";
import { adjustCustomerBalance } from "./customer.service";
import {
  getNextSaleNumber, getNextReturnNumber,
  getNextOrderNumber, getNextChallanNumber,
} from "./counter.service";

// =============================================================
// SALE SERVICE
// Creating a sale     → increases stockOut for each item
// Sale return         → decreases stockOut (stock returns to inventory)
// =============================================================

export interface SaleItem {
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

export interface SaleResult {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string | null;
  invoiceDate: string;
  paymentMethod: string;
  subtotal: number;
  discountAmt: number;
  cgst: number;
  sgst: number;
  totalAmt: number;
  paidAmt: number;
  balanceDue: number;
  status: string;
  itemCount: number;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(s: any): SaleResult {
  return {
    id:            s.id,
    invoiceNumber: s.invoiceNumber,
    customerName:  s.customerName,
    customerId:    s.customerId ?? null,
    invoiceDate:   s.invoiceDate?.toISOString?.() ?? "",
    paymentMethod: s.paymentMethod,
    subtotal:      parseFloat(s.subtotal),
    discountAmt:   parseFloat(s.discountAmt),
    cgst:          parseFloat(s.cgst),
    sgst:          parseFloat(s.sgst),
    totalAmt:      parseFloat(s.totalAmt),
    paidAmt:       parseFloat(s.paidAmt),
    balanceDue:    parseFloat(s.balanceDue),
    status:        s.status,
    itemCount:     s._count?.items ?? s.items?.length ?? 0,
    createdAt:     s.createdAt?.toISOString?.() ?? "",
  };
}

export async function listSales(page = 1, pageSize = 20): Promise<{ data: SaleResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.saleInvoice.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.saleInvoice.count({ where: { status: { not: "CANCELLED" } } }),
  ]);
  return { data: rows.map(toResult), total };
}

export async function getSaleById(id: string) {
  return prisma.saleInvoice.findUnique({ where: { id }, include: { items: true } });
}

export async function getNextSaleNo(): Promise<string> {
  return getNextSaleNumber();
}

export async function createSale(data: {
  customerName: string;
  customerId?: string;
  invoiceDate: string;
  paymentMethod: string;
  discountPct: number;
  notes?: string;
  paidAmt: number;
  items: SaleItem[];
}): Promise<SaleResult> {
  const invoiceNumber = await getNextSaleNumber();

  const subtotal    = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmt = subtotal * (data.discountPct / 100);
  const cgst        = data.items.reduce((s, i) => s + i.taxAmount / 2, 0);
  const sgst        = cgst;
  const totalAmt    = subtotal - discountAmt + cgst + sgst;
  const balanceDue  = Math.max(0, totalAmt - data.paidAmt);
  const status      = balanceDue === 0 ? "PAID" : data.paidAmt > 0 ? "PARTIAL" : "UNPAID";

  const sale = await prisma.saleInvoice.create({
    data: {
      invoiceNumber,
      customerName:  data.customerName,
      customerId:    data.customerId ?? null,
      invoiceDate:   new Date(data.invoiceDate),
      paymentMethod: data.paymentMethod,
      subtotal,
      discountPct:   data.discountPct,
      discountAmt,
      cgst,
      sgst,
      totalAmt,
      paidAmt:       data.paidAmt,
      balanceDue,
      notes:         data.notes ?? null,
      status,
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

  // ── Stock: increase stockOut for each product ─────────────
  for (const item of data.items) {
    if (item.productId) {
      await addStockOut(item.productId, item.quantity);
    }
  }

  // ── Customer balance (if on credit) ───────────────────────
  if (data.customerId && balanceDue > 0) {
    await adjustCustomerBalance(data.customerId, balanceDue);
  }

  return toResult(sale);
}

export async function cancelSale(id: string): Promise<void> {
  const inv = await prisma.saleInvoice.findUnique({
    where: { id }, include: { items: true },
  });
  if (!inv || inv.status === "CANCELLED") return;

  for (const item of inv.items) {
    if (item.productId) {
      await subtractStockOut(item.productId, parseFloat(String(item.quantity)));
    }
  }

  await prisma.saleInvoice.update({ where: { id }, data: { status: "CANCELLED" } });
}

// ── Sale Return ──────────────────────────────────────────────

export interface SaleReturnResult {
  id: string;
  returnNumber: string;
  customerName: string;
  returnDate: string;
  totalAmt: number;
  status: string;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReturnResult(r: any): SaleReturnResult {
  return {
    id:           r.id,
    returnNumber: r.returnNumber,
    customerName: r.customerName,
    returnDate:   r.returnDate?.toISOString?.() ?? "",
    totalAmt:     parseFloat(r.totalAmt),
    status:       r.status,
    createdAt:    r.createdAt?.toISOString?.() ?? "",
  };
}

export async function listSaleReturns(page = 1, pageSize = 20): Promise<{ data: SaleReturnResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.saleReturn.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.saleReturn.count(),
  ]);
  return { data: rows.map(toReturnResult), total };
}

export async function createSaleReturn(data: {
  invoiceId?: string;
  customerId?: string;
  customerName: string;
  returnDate: string;
  reason?: string;
  items: Array<{ productId?: string; itemName: string; itemCode: string; quantity: number; unitPrice: number; totalAmount: number }>;
}): Promise<SaleReturnResult> {
  const returnNumber = await getNextReturnNumber();
  const totalAmt = data.items.reduce((s, i) => s + i.totalAmount, 0);

  const ret = await prisma.saleReturn.create({
    data: {
      returnNumber,
      invoiceId:    data.invoiceId  ?? null,
      customerId:   data.customerId ?? null,
      customerName: data.customerName,
      returnDate:   new Date(data.returnDate),
      reason:       data.reason ?? null,
      subtotal:     totalAmt,
      totalAmt,
      status:       "CONFIRMED",
      items: {
        create: data.items.map((i) => ({
          productId:   i.productId ?? null,
          itemName:    i.itemName,
          itemCode:    i.itemCode,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          totalAmount: i.totalAmount,
        })),
      },
    },
  });

  // ── Stock: decrease stockOut (items come back) ─────────────
  for (const item of data.items) {
    if (item.productId) {
      await subtractStockOut(item.productId, item.quantity);
    }
  }

  return toReturnResult(ret);
}

// ── Sale Orders ──────────────────────────────────────────────

export async function listSaleOrders(page = 1, pageSize = 20) {
  const [rows, total] = await Promise.all([
    prisma.saleOrder.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.saleOrder.count(),
  ]);
  return {
    data: rows.map((o: any) => ({
      id:           o.id,
      orderNumber:  o.orderNumber,
      customerName: o.customerName,
      orderDate:    o.orderDate?.toISOString?.() ?? "",
      dueDate:      o.dueDate?.toISOString?.() ?? null,
      totalAmt:     parseFloat(o.totalAmt),
      status:       o.status,
      itemCount:    o._count?.items ?? 0,
      createdAt:    o.createdAt?.toISOString?.() ?? "",
    })),
    total,
  };
}

export async function createSaleOrder(data: {
  customerName: string;
  customerId?: string;
  orderDate: string;
  dueDate?: string;
  notes?: string;
  items: Array<{ productId?: string; itemName: string; itemCode: string; quantity: number; unitPrice: number; totalAmount: number }>;
}) {
  const orderNumber = await getNextOrderNumber();
  const totalAmt = data.items.reduce((s, i) => s + i.totalAmount, 0);
  return prisma.saleOrder.create({
    data: {
      orderNumber,
      customerId:   data.customerId ?? null,
      customerName: data.customerName,
      orderDate:    new Date(data.orderDate),
      dueDate:      data.dueDate ? new Date(data.dueDate) : null,
      notes:        data.notes ?? null,
      totalAmt,
      subtotal:     totalAmt,
      items:        { create: data.items },
    },
  });
}

// ── Delivery Challans ────────────────────────────────────────

export async function listChallans(page = 1, pageSize = 20) {
  const [rows, total] = await Promise.all([
    prisma.deliveryChallan.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.deliveryChallan.count(),
  ]);
  return {
    data: rows.map((c: any) => ({
      id:            c.id,
      challanNumber: c.challanNumber,
      customerName:  c.customerName,
      challanDate:   c.challanDate?.toISOString?.() ?? "",
      vehicleNo:     c.vehicleNo ?? null,
      status:        c.status,
      itemCount:     c._count?.items ?? 0,
      createdAt:     c.createdAt?.toISOString?.() ?? "",
    })),
    total,
  };
}

export async function createChallan(data: {
  customerName: string;
  customerId?: string;
  challanDate: string;
  vehicleNo?: string;
  notes?: string;
  items: Array<{ productId?: string; itemName: string; itemCode: string; quantity: number; unit: string }>;
}) {
  const challanNumber = await getNextChallanNumber();
  return prisma.deliveryChallan.create({
    data: {
      challanNumber,
      customerId:   data.customerId ?? null,
      customerName: data.customerName,
      challanDate:  new Date(data.challanDate),
      vehicleNo:    data.vehicleNo ?? null,
      notes:        data.notes ?? null,
      items:        { create: data.items },
    },
  });
}
