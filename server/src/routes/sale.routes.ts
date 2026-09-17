import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { getNextSaleNumber, getNextReturnNumber, getNextOrderNumber, getNextChallanNumber, getNextPaymentInNumber } from "../services/counter.service";

const saleItemSchema = z.object({
  itemName: z.string().min(1), itemCode: z.string(), productId: z.string().optional(),
  quantity: z.number().min(0), unit: z.string().default("Nos"), mrp: z.number().min(0).default(0),
  unitPrice: z.number().min(0), discountPct: z.number().min(0).default(0),
  discountAmt: z.number().min(0).default(0), taxPercent: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0), totalAmount: z.number().min(0),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSaleResult(s: any) {
  return {
    id: s.id, invoiceNumber: s.invoiceNumber, customerName: s.customerName,
    customerId: s.customerId ?? null, invoiceDate: s.invoiceDate?.toISOString?.() ?? "",
    paymentMethod: s.paymentMethod, subtotal: parseFloat(s.subtotal),
    discountAmt: parseFloat(s.discountAmt), cgst: parseFloat(s.cgst), sgst: parseFloat(s.sgst),
    totalAmt: parseFloat(s.totalAmt), paidAmt: parseFloat(s.paidAmt),
    balanceDue: parseFloat(s.balanceDue), status: s.status,
    itemCount: s._count?.items ?? s.items?.length ?? 0,
    createdAt: s.createdAt?.toISOString?.() ?? "",
  };
}

export async function saleRoutes(fastify: FastifyInstance) {

  // ── Static routes FIRST ───────────────────────────────────

  fastify.get("/next-number", async (req, reply) => {
    try {
      const number = await getNextSaleNumber(req.prisma);
      return reply.send(successResponse({ number }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/returns", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.saleReturn.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.saleReturn.count(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send(successResponse({ data: rows.map((r: any) => ({ id: r.id, returnNumber: r.returnNumber, customerName: r.customerName, returnDate: r.returnDate?.toISOString?.() ?? "", totalAmt: parseFloat(r.totalAmt), status: r.status, createdAt: r.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/orders", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; startDate?: string; endDate?: string; status?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const where: Record<string, unknown> = {};
      if (req.query.startDate && req.query.endDate) {
        where.orderDate = { gte: new Date(req.query.startDate), lte: new Date(req.query.endDate + "T23:59:59.999Z") };
      }
      if (req.query.status && req.query.status !== "ALL") {
        where.status = req.query.status;
      }
      const [rows, total] = await Promise.all([
        req.prisma.saleOrder.findMany({ where, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.saleOrder.count({ where }),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send(successResponse({ data: rows.map((o: any) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, phone: o.phone ?? null, orderDate: o.orderDate?.toISOString?.() ?? "", dueDate: o.dueDate?.toISOString?.() ?? null, source: o.source ?? "Walk-in", totalAmt: parseFloat(o.totalAmt), status: o.status, itemCount: o._count?.items ?? 0, createdAt: o.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/challans", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.deliveryChallan.findMany({ include: { _count: { select: { items: true } }, order: { select: { orderNumber: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.deliveryChallan.count(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send(successResponse({ data: rows.map((c: any) => ({ id: c.id, challanNumber: c.challanNumber, orderId: c.orderId ?? null, orderNumber: c.order?.orderNumber ?? null, customerName: c.customerName, challanDate: c.challanDate?.toISOString?.() ?? "", vehicleNo: c.vehicleNo ?? null, status: c.status, itemCount: c._count?.items ?? 0, createdAt: c.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Dashboard stats endpoint ─────────────────────────────
  fastify.get("/stats", async (req: FastifyRequest<{ Querystring: { year?: string; month?: string; startDate?: string; endDate?: string } }>, reply) => {
    try {
      const { year: y, month: m, startDate, endDate } = req.query;
      let dateWhere: Record<string, unknown> = {};
      let purchaseDateWhere: Record<string, unknown> = {};
      if (startDate && endDate) {
        // Explicit date range takes priority
        dateWhere         = { invoiceDate: { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59.999Z") } };
        purchaseDateWhere = { billDate:    { gte: new Date(startDate), lte: new Date(endDate + "T23:59:59.999Z") } };
      } else if (y && m) {
        const yr    = Number(y);
        const mo    = Number(m);
        const start = new Date(yr, mo - 1, 1);
        const end   = new Date(yr, mo, 1);
        dateWhere         = { invoiceDate: { gte: start, lt: end } };
        purchaseDateWhere = { billDate:    { gte: start, lt: end } };
      }

      // Today's date range (midnight → now) — anchored to IST (UTC+5:30) so
// "today" always matches the business's local day, regardless of the
// server's own system timezone (which is often UTC on hosting platforms).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const nowIst = new Date(Date.now() + IST_OFFSET_MS);
const todayStart = new Date(
  Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 0, 0, 0) - IST_OFFSET_MS
);
const todayEnd = new Date(
  Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS
);

// 🔍 DEBUG — temporary, remove after fixing
console.log("=== STATS DEBUG ===");
console.log("Server current time:", new Date().toString());
console.log("todayStart:", todayStart.toISOString());
console.log("todayEnd:", todayEnd.toISOString());
const allExpenses = await req.prisma.expense.findMany({ select: { id: true, amount: true, expenseDate: true } });
console.log("All expenses in DB:", JSON.stringify(allExpenses, null, 2));
console.log("===================");

       const [salesAgg, purchasesAgg, outstanding, todaySalesAgg, todayExpensesAgg, totalExpensesAgg, inventoryRows] = await Promise.all([
        req.prisma.saleInvoice.aggregate({
          _sum: { totalAmt: true, paidAmt: true },
          where: { status: { not: "CANCELLED" }, ...dateWhere },
        }),
        req.prisma.purchaseInvoice.aggregate({
          _sum: { totalAmt: true },
          where: { status: { not: "CANCELLED" }, ...purchaseDateWhere },
        }),
        req.prisma.saleInvoice.aggregate({
          _sum: { balanceDue: true },
          where: { balanceDue: { gt: 0 }, status: { not: "CANCELLED" } },
        }),
        // Today's sales — always today regardless of month filter
        req.prisma.saleInvoice.aggregate({
          _sum: { totalAmt: true },
          where: { status: { not: "CANCELLED" }, invoiceDate: { gte: todayStart, lte: todayEnd } },
        }),
        // Today's expenses — always today regardless of month filter
        req.prisma.expense.aggregate({
          _sum: { amount: true },
          where: { expenseDate: { gte: todayStart, lte: todayEnd } },
        }),
        // All-time total expenses — no date filter, everything ever recorded
        req.prisma.expense.aggregate({
          _sum: { amount: true },
        }),
        // All inventory items for total stock value
        req.prisma.inventoryItem.findMany({
          include: { product: { select: { salePrice: true, isActive: true } } },
        }),
      ]); 

      const totalSales     = parseFloat(String(salesAgg._sum.totalAmt ?? 0));
      const totalPurchases = parseFloat(String(purchasesAgg._sum.totalAmt ?? 0));

      // Total stock value = sum of (currentStock × salePrice) for all active products
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalStockValue = inventoryRows.reduce((sum: number, row: any) => {
        if (!row.product?.isActive) return sum;
        const current    = parseFloat(row.openingStock) + parseFloat(row.stockIn) - parseFloat(row.stockOut);
        const salePrice  = parseFloat(row.product?.salePrice ?? "0");
        return sum + Math.max(0, current) * salePrice;
      }, 0);

      return reply.send(successResponse({
        totalSales,
        totalPurchases,
        totalProfit:     totalSales - totalPurchases,
        outstanding:     parseFloat(String(outstanding._sum.balanceDue ?? 0)),
        todaySales:      parseFloat(String(todaySalesAgg._sum.totalAmt ?? 0)),
               todayExpenses:   parseFloat(String(todayExpensesAgg._sum.amount ?? 0)),
        totalExpenses:   parseFloat(String(totalExpensesAgg._sum.amount ?? 0)),
        totalStockValue: parseFloat(totalStockValue.toFixed(2)),
      }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Daily sales for chart ────────────────────────────────
  fastify.get("/daily", async (req: FastifyRequest<{ Querystring: { year?: string; month?: string } }>, reply) => {
    try {
      const now   = new Date();
      const year  = Number(req.query.year  ?? now.getFullYear());
      const month = Number(req.query.month ?? now.getMonth() + 1);
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1);

      const rows = await req.prisma.saleInvoice.findMany({
        where: { invoiceDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
        select: { invoiceDate: true, totalAmt: true },
      });

      // Aggregate by day
      const byDay: Record<number, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows.forEach((r: any) => {
        const d = new Date(r.invoiceDate).getDate();
        byDay[d] = (byDay[d] ?? 0) + parseFloat(String(r.totalAmt));
      });

      const daysInMonth = new Date(year, month, 0).getDate();
      const daily = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        amount: byDay[i + 1] ?? 0,
      }));

      return reply.send(successResponse({ daily, year, month }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Collection & parameterised ─────────────────────────────

  // ── Sale Returns (must be before /:id wildcard) ───────────

  fastify.post("/returns", async (req, reply) => {
    const schema = z.object({
      invoiceId: z.string().optional(), customerId: z.string().optional(),
      customerName: z.string().default("Walk-in Customer"), returnDate: z.string(), reason: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unitPrice: z.number().min(0), totalAmount: z.number().min(0) })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const returnNumber = await getNextReturnNumber(req.prisma);
      const totalAmt = parse.data.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
      const ret = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        const r = await tx.saleReturn.create({
          data: { returnNumber, invoiceId: parse.data.invoiceId ?? null, customerId: parse.data.customerId ?? null, customerName: parse.data.customerName, returnDate: new Date(parse.data.returnDate), reason: parse.data.reason ?? null, subtotal: totalAmt, totalAmt, status: "CONFIRMED",
            items: { create: parse.data.items.map((i: any) => ({ productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode, quantity: i.quantity, unitPrice: i.unitPrice, totalAmount: i.totalAmount })) },
          },
        });
        for (const item of parse.data.items) {
          if (item.productId) await tx.inventoryItem.update({ where: { productId: item.productId }, data: { stockOut: { decrement: item.quantity } } }).catch(() => {});
        }
        return r;
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(ret, "Sale return saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/returns/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const r = await req.prisma.saleReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!r) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(r));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/returns/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), reason: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unitPrice: z.number().min(0), totalAmount: z.number().min(0) })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const existing = await req.prisma.saleReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!existing) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      const totalAmt = parse.data.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
      const updated = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        for (const old of existing.items) {
          if (old.productId) await tx.inventoryItem.update({ where: { productId: old.productId }, data: { stockOut: { increment: parseFloat(String(old.quantity)) } } }).catch(() => {});
        }
        await tx.saleReturnItem.deleteMany({ where: { returnId: req.params.id } });
        const r = await tx.saleReturn.update({
          where: { id: req.params.id },
          data: { customerName: parse.data.customerName, reason: parse.data.reason ?? null, subtotal: totalAmt, totalAmt,
            items: { create: parse.data.items.map((i: any) => ({ productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode, quantity: i.quantity, unitPrice: i.unitPrice, totalAmount: i.totalAmount })) },
          },
        });
        for (const item of parse.data.items) {
          if (item.productId) await tx.inventoryItem.update({ where: { productId: item.productId }, data: { stockOut: { decrement: item.quantity } } }).catch(() => {});
        }
        return r;
      });
      return reply.send(successResponse(updated, "Return updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/returns/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const existing = await req.prisma.saleReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!existing) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        for (const item of existing.items) {
          if (item.productId) await tx.inventoryItem.update({ where: { productId: item.productId }, data: { stockOut: { increment: parseFloat(String(item.quantity)) } } }).catch(() => {});
        }
        await tx.saleReturnItem.deleteMany({ where: { returnId: req.params.id } });
        await tx.saleReturn.delete({ where: { id: req.params.id } });
      });
      return reply.send(successResponse(null, "Return deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Sale Invoices ─────────────────────────────────────────

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; startDate?: string; endDate?: string; search?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Math.min(500, Math.max(1, Number(req.query.pageSize ?? 20)));
      const search = req.query.search?.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = { status: { not: "CANCELLED" } };
      if (req.query.startDate && req.query.endDate) {
        where.invoiceDate = { gte: new Date(req.query.startDate), lte: new Date(req.query.endDate + "T23:59:59.999Z") };
      }
      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search } },
          { customerName:  { contains: search } },
        ];
      }
      const [rows, total] = await Promise.all([
        req.prisma.saleInvoice.findMany({ where, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.saleInvoice.count({ where }),
      ]);
      return reply.send(successResponse({ data: rows.map(toSaleResult), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const s = await req.prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!s) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(s));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), customerId: z.string().optional(),
      invoiceDate: z.string(), paymentMethod: z.string().default("Cash"),
      discountPct: z.number().min(0).default(0), notes: z.string().optional(),
      paidAmt: z.number().min(0).default(0),
      // totalAmt is optionally sent by the frontend (rounded value shown on the bill).
      // When provided, we use it directly so the stored total matches exactly what the bill shows.
      totalAmt: z.number().min(0).optional(),
      items: z.array(saleItemSchema).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const invoiceNumber = await getNextSaleNumber(req.prisma);
      const { items, paidAmt, discountPct, totalAmt: clientTotalAmt, ...rest } = parse.data;
      const subtotal    = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
      const discountAmt = subtotal * (discountPct / 100);
      const cgst        = items.reduce((s: number, i: any) => s + i.taxAmount / 2, 0);
      const sgst        = cgst;
      const rawTotal    = subtotal - discountAmt + cgst + sgst;
      // Use the frontend-rounded total if provided; otherwise fall back to raw calculation.
      // This ensures the stored totalAmt matches what's printed on the bill and encoded in the QR.
      const totalAmt    = clientTotalAmt ?? rawTotal;
      const balanceDue  = Math.max(0, totalAmt - paidAmt);
      const status      = balanceDue === 0 ? "PAID" : paidAmt > 0 ? "PARTIAL" : "UNPAID";

      // ── Wrap in transaction ────────────────────────────
      const sale = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        const s = await tx.saleInvoice.create({
          data: { invoiceNumber, ...rest, invoiceDate: new Date(rest.invoiceDate), customerId: rest.customerId ?? null, notes: rest.notes ?? null, subtotal, discountPct, discountAmt, cgst, sgst, totalAmt, paidAmt, balanceDue, status,
            items: { create: items.map((i: any) => ({ productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode, quantity: i.quantity, unit: i.unit, mrp: i.mrp, unitPrice: i.unitPrice, discountPct: i.discountPct, discountAmt: i.discountAmt, taxPercent: i.taxPercent, taxAmount: i.taxAmount, totalAmount: i.totalAmount })) },
          },
          include: { _count: { select: { items: true } } },
        });
        for (const item of items) {
          if (item.productId) {
            await tx.inventoryItem.upsert({ where: { productId: item.productId }, create: { productId: item.productId, openingStock: 0, stockIn: 0, stockOut: item.quantity, lowStockAlert: 5 }, update: { stockOut: { increment: item.quantity } } });
          }
        }
        if (rest.customerId && balanceDue > 0) {
          await tx.customer.update({ where: { id: rest.customerId }, data: { balance: { increment: balanceDue } } });
        }

        // ── Auto-create paymentIn record so POS sales appear in Payment-In page ──
        if (paidAmt > 0) {
          const paymentNumber = await getNextPaymentInNumber(tx);
          await tx.paymentIn.create({
            data: {
              paymentNumber,
              customerName:  rest.customerName ?? "Walk-in Customer",
              customerId:    rest.customerId   ?? null,
              invoiceId:     s.id,
              amount:        paidAmt,
              paymentMethod: rest.paymentMethod,
              paymentDate:   new Date(rest.invoiceDate),
              reference:     `Invoice ${invoiceNumber}`,
              notes:         null,
            },
          });
        }

        return s;
      });

      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toSaleResult(sale), "Sale saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Update (edit) an existing sale invoice ───────────────
  fastify.put("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({
      customerName:  z.string().default("Walk-in Customer"),
      customerId:    z.string().optional(),
      paymentMethod: z.string().default("Cash"),
      discountPct:   z.number().min(0).default(0),
      notes:         z.string().optional(),
      paidAmt:       z.number().min(0).default(0),
      // totalAmt is optionally sent by the frontend (rounded value shown on the bill).
      // When provided, we use it directly so the stored total matches exactly what the bill shows.
      totalAmt:      z.number().min(0).optional(),
      items:         z.array(saleItemSchema).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
      return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(
        parse.error.errors[0]?.message ?? "Validation failed",
        HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR,
      ));
    try {
      const { id } = req.params;
      const existing = await req.prisma.saleInvoice.findUnique({
        where: { id }, include: { items: true },
      });
      if (!existing)
        return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse(
          "Invoice not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND,
        ));

      const { items, paidAmt, discountPct, totalAmt: clientTotalAmt, ...rest } = parse.data;
      const subtotal    = items.reduce((s: number, i: {unitPrice:number;quantity:number}) => s + i.unitPrice * i.quantity, 0);
      const discountAmt = subtotal * (discountPct / 100);
      const cgst        = items.reduce((s: number, i: {taxAmount:number}) => s + i.taxAmount / 2, 0);
      const sgst        = cgst;
      const rawTotal    = subtotal - discountAmt + cgst + sgst;
      // Use the frontend-rounded total if provided; otherwise fall back to raw calculation.
      const totalAmt    = clientTotalAmt ?? rawTotal;
      const balanceDue  = Math.max(0, totalAmt - paidAmt);
      const status      = balanceDue === 0 ? "PAID" : paidAmt > 0 ? "PARTIAL" : "UNPAID";

      const updated = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        // Reverse old stock-out for existing items
        for (const oldItem of existing.items) {
          if (oldItem.productId) {
            await tx.inventoryItem.update({
              where: { productId: oldItem.productId },
              data:  { stockOut: { decrement: parseFloat(String(oldItem.quantity)) } },
            }).catch(() => {});
          }
        }

        // Delete old items and old linked payment-in records
        await tx.saleInvoiceItem.deleteMany({ where: { saleInvoiceId: id } });
        await tx.paymentIn.deleteMany({ where: { invoiceId: id } });

        // Update the invoice header + recreate items
        const s = await tx.saleInvoice.update({
          where: { id },
          data: {
            customerName:  rest.customerName,
            customerId:    rest.customerId ?? null,
            paymentMethod: rest.paymentMethod,
            notes:         rest.notes ?? null,
            subtotal,
            discountPct,
            discountAmt,
            cgst,
            sgst,
            totalAmt,
            paidAmt,
            balanceDue,
            status,
            items: {
              create: items.map((i: {productId?:string;itemName:string;itemCode:string;quantity:number;unit:string;mrp:number;unitPrice:number;discountPct:number;discountAmt:number;taxPercent:number;taxAmount:number;totalAmount:number}) => ({
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

        // Apply new stock-out
        for (const item of items) {
          if (item.productId) {
            await tx.inventoryItem.upsert({
              where:  { productId: item.productId },
              create: { productId: item.productId, openingStock: 0, stockIn: 0, stockOut: item.quantity, lowStockAlert: 5 },
              update: { stockOut: { increment: item.quantity } },
            });
          }
        }

        // Recreate payment-in record
        if (paidAmt > 0) {
          const paymentNumber = await getNextPaymentInNumber(tx);
          await tx.paymentIn.create({
            data: {
              paymentNumber,
              customerName:  rest.customerName ?? "Walk-in Customer",
              customerId:    rest.customerId   ?? null,
              invoiceId:     id,
              amount:        paidAmt,
              paymentMethod: rest.paymentMethod,
              paymentDate:   new Date(),
              reference:     `Invoice ${existing.invoiceNumber} (edited)`,
              notes:         null,
            },
          });
        }

        return s;
      });

      return reply.send(successResponse(toSaleResult(updated), "Sale updated"));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const inv = await req.prisma.saleInvoice.findUnique({
        where: { id: req.params.id },
        include: { items: true, payments: true, returns: { include: { items: true } } },
      });
      if (!inv) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Invoice not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));

      await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        await tx.paymentIn.deleteMany({ where: { invoiceId: req.params.id } });
        await tx.saleReturn.deleteMany({ where: { invoiceId: req.params.id } });

        if (inv.status !== "CANCELLED") {
          for (const item of inv.items) {
            if (item.productId) {
              await tx.inventoryItem.update({ where: { productId: item.productId }, data: { stockOut: { decrement: parseFloat(String(item.quantity)) } } }).catch(() => {});
            }
          }
        }
        await tx.saleInvoice.delete({ where: { id: req.params.id } });
      });

      return reply.send(successResponse(null, "Invoice deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Sale Orders ───────────────────────────────────────────

  // helper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function toOrderResult(o: any) {
    return {
      id: o.id, orderNumber: o.orderNumber,
      customerName: o.customerName, customerId: o.customerId ?? null,
      phone: o.phone ?? null,
      orderDate: o.orderDate?.toISOString?.() ?? "",
      dueDate: o.dueDate?.toISOString?.() ?? null,
      source: o.source ?? "Walk-in",
      subtotal: parseFloat(o.subtotal), totalAmt: parseFloat(o.totalAmt),
      notes: o.notes ?? null, status: o.status,
      itemCount: o._count?.items ?? o.items?.length ?? 0,
      createdAt: o.createdAt?.toISOString?.() ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: o.items?.map((i: any) => ({
        id: i.id, itemName: i.itemName, itemCode: i.itemCode,
        productId: i.productId ?? null,
        quantity: parseFloat(i.quantity), unitPrice: parseFloat(i.unitPrice),
        mrp: parseFloat(i.mrp ?? 0), taxPct: parseFloat(i.taxPct ?? 0),
        totalAmount: parseFloat(i.totalAmount),
      })) ?? undefined,
    };
  }

  const orderItemSchema = z.object({
    productId:   z.string().optional(),
    itemName:    z.string().min(1),
    itemCode:    z.string().default(""),
    quantity:    z.number().min(0.001),
    unitPrice:   z.number().min(0),
    mrp:         z.number().min(0).default(0),
    taxPct:      z.number().min(0).default(0),
    totalAmount: z.number().min(0),
  });

  const orderBodySchema = z.object({
    customerName: z.string().default("Walk-in Customer"),
    customerId:   z.string().optional(),
    phone:        z.string().optional(),
    orderDate:    z.string(),
    dueDate:      z.string().optional(),
    source:       z.string().default("Walk-in"),
    notes:        z.string().optional(),
    items:        z.array(orderItemSchema).min(1),
  });

  fastify.post("/orders", async (req, reply) => {
    const parse = orderBodySchema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const orderNumber = await getNextOrderNumber(req.prisma);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalAmt = parse.data.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
      const order = await req.prisma.saleOrder.create({
        data: {
          orderNumber, customerId: parse.data.customerId ?? null,
          customerName: parse.data.customerName, phone: parse.data.phone ?? null,
          orderDate: new Date(parse.data.orderDate),
          dueDate: parse.data.dueDate ? new Date(parse.data.dueDate) : null,
          source: parse.data.source, notes: parse.data.notes ?? null,
          totalAmt, subtotal: totalAmt,
          items: { create: parse.data.items },
        },
        include: { _count: { select: { items: true } } },
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toOrderResult(order), "Order saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/orders/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const o = await req.prisma.saleOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!o) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(toOrderResult(o)));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/orders/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const parse = orderBodySchema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const existing = await req.prisma.saleOrder.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalAmt = parse.data.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
      await req.prisma.saleOrderItem.deleteMany({ where: { orderId: req.params.id } });
      const order = await req.prisma.saleOrder.update({
        where: { id: req.params.id },
        data: {
          customerName: parse.data.customerName, customerId: parse.data.customerId ?? null,
          phone: parse.data.phone ?? null,
          orderDate: new Date(parse.data.orderDate),
          dueDate: parse.data.dueDate ? new Date(parse.data.dueDate) : null,
          source: parse.data.source, notes: parse.data.notes ?? null,
          totalAmt, subtotal: totalAmt,
          items: { create: parse.data.items },
        },
        include: { items: true },
      });
      return reply.send(successResponse(toOrderResult(order), "Order updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.patch("/orders/:id/status", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const parse = z.object({ status: z.enum(["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]) }).safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse("Invalid status", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const order = await req.prisma.saleOrder.update({ where: { id: req.params.id }, data: { status: parse.data.status }, include: { _count: { select: { items: true } } } });
      return reply.send(successResponse(toOrderResult(order), "Status updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/orders/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await req.prisma.saleOrderItem.deleteMany({ where: { orderId: req.params.id } });
      await req.prisma.saleOrder.delete({ where: { id: req.params.id } });
      return reply.send(successResponse(null, "Order deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // Convert order → sale invoice
  fastify.post("/orders/:id/convert-to-invoice", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const order = await req.prisma.saleOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!order) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Order not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      const invoiceNumber = await getNextSaleNumber(req.prisma);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = order.items.map((i: any) => ({
        productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode,
        quantity: parseFloat(i.quantity), unit: "Nos", mrp: parseFloat(i.mrp ?? 0),
        unitPrice: parseFloat(i.unitPrice), discountPct: 0, discountAmt: 0,
        taxPercent: parseFloat(i.taxPct ?? 0), taxAmount: 0, totalAmount: parseFloat(i.totalAmount),
      }));
      const subtotal = items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity, 0);
      const totalAmt = parseFloat(String(order.totalAmt));
      const sale = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        const s = await tx.saleInvoice.create({
          data: {
            invoiceNumber, customerName: order.customerName, customerId: order.customerId ?? null,
            invoiceDate: new Date(), paymentMethod: "Cash",
            subtotal, discountPct: 0, discountAmt: 0, cgst: 0, sgst: 0,
            totalAmt, paidAmt: 0, balanceDue: totalAmt, status: "UNPAID",
            notes: order.notes ?? null,
            items: { create: items },
          },
          include: { _count: { select: { items: true } } },
        });
        // Deduct stock
        for (const item of items) {
          if (item.productId) {
            await tx.inventoryItem.upsert({ where: { productId: item.productId }, create: { productId: item.productId, openingStock: 0, stockIn: 0, stockOut: item.quantity, lowStockAlert: 5 }, update: { stockOut: { increment: item.quantity } } });
          }
        }
        await tx.saleOrder.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
        return s;
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toSaleResult(sale), "Invoice created"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // Create challan from order
  fastify.post("/orders/:id/create-challan", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const order = await req.prisma.saleOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!order) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Order not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      const challanNumber = await getNextChallanNumber(req.prisma);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const challanItems = order.items.map((i: any) => ({
        productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode,
        quantity: parseFloat(i.quantity), unit: "Nos",
      }));
      const challan = await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        const c = await tx.deliveryChallan.create({
          data: {
            challanNumber, orderId: order.id,
            customerId: order.customerId ?? null, customerName: order.customerName,
            challanDate: new Date(), notes: order.notes ?? null,
            items: { create: challanItems },
          },
          include: { _count: { select: { items: true } } },
        });
        await tx.saleOrder.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
        return c;
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toChallanResult(challan), "Challan created"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Delivery Challans ─────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function toChallanResult(c: any) {
    return {
      id: c.id, challanNumber: c.challanNumber,
      orderId: c.orderId ?? null, orderNumber: c.order?.orderNumber ?? null,
      customerName: c.customerName, customerId: c.customerId ?? null,
      challanDate: c.challanDate?.toISOString?.() ?? "",
      vehicleNo: c.vehicleNo ?? null, notes: c.notes ?? null,
      status: c.status, itemCount: c._count?.items ?? c.items?.length ?? 0,
      createdAt: c.createdAt?.toISOString?.() ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: c.items?.map((i: any) => ({
        id: i.id, itemName: i.itemName, itemCode: i.itemCode,
        productId: i.productId ?? null,
        quantity: parseFloat(i.quantity), unit: i.unit,
      })) ?? undefined,
    };
  }

  fastify.post("/challans", async (req, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), customerId: z.string().optional(),
      orderId: z.string().optional(),
      challanDate: z.string(), vehicleNo: z.string().optional(), notes: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string().default(""), quantity: z.number().min(0), unit: z.string().default("Nos") })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const challanNumber = await getNextChallanNumber(req.prisma);
      const challan = await req.prisma.deliveryChallan.create({
        data: {
          challanNumber, orderId: parse.data.orderId ?? null,
          customerId: parse.data.customerId ?? null, customerName: parse.data.customerName,
          challanDate: new Date(parse.data.challanDate), vehicleNo: parse.data.vehicleNo ?? null,
          notes: parse.data.notes ?? null,
          items: { create: parse.data.items },
        },
        include: { _count: { select: { items: true } } },
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toChallanResult(challan), "Challan saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/challans/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const c = await req.prisma.deliveryChallan.findUnique({ where: { id: req.params.id }, include: { items: true, order: { select: { orderNumber: true } } } });
      if (!c) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(toChallanResult(c)));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.patch("/challans/:id/status", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const parse = z.object({ status: z.enum(["PENDING", "DELIVERED", "CANCELLED"]) }).safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse("Invalid status", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const challan = await req.prisma.deliveryChallan.update({ where: { id: req.params.id }, data: { status: parse.data.status }, include: { _count: { select: { items: true } }, order: { select: { orderNumber: true } } } });
      // If challan delivered and linked to order → mark order DELIVERED too
      if (parse.data.status === "DELIVERED" && challan.orderId) {
        await req.prisma.saleOrder.update({ where: { id: challan.orderId }, data: { status: "DELIVERED" } }).catch(() => {});
      }
      return reply.send(successResponse(toChallanResult(challan), "Status updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/challans/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await req.prisma.deliveryChallanItem.deleteMany({ where: { challanId: req.params.id } });
      await req.prisma.deliveryChallan.delete({ where: { id: req.params.id } });
      return reply.send(successResponse(null, "Challan deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
