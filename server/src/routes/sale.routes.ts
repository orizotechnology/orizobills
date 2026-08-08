import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { getNextSaleNumber, getNextReturnNumber, getNextOrderNumber, getNextChallanNumber } from "../services/counter.service";

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

  fastify.get("/next-number", async (_req, reply) => {
    try {
      const number = await getNextSaleNumber();
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
      return reply.send(successResponse({ data: rows.map((o: any) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, orderDate: o.orderDate?.toISOString?.() ?? "", dueDate: o.dueDate?.toISOString?.() ?? null, totalAmt: parseFloat(o.totalAmt), status: o.status, itemCount: o._count?.items ?? 0, createdAt: o.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/challans", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.deliveryChallan.findMany({ include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.deliveryChallan.count(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send(successResponse({ data: rows.map((c: any) => ({ id: c.id, challanNumber: c.challanNumber, customerName: c.customerName, challanDate: c.challanDate?.toISOString?.() ?? "", vehicleNo: c.vehicleNo ?? null, status: c.status, itemCount: c._count?.items ?? 0, createdAt: c.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Dashboard stats endpoint ─────────────────────────────
  fastify.get("/stats", async (req: FastifyRequest<{ Querystring: { year?: string; month?: string } }>, reply) => {
    try {
      // If year+month provided → filter to that month, else all-time
      const { year: y, month: m } = req.query;
      let dateWhere: Record<string, unknown> = {};
      if (y && m) {
        const yr    = Number(y);
        const mo    = Number(m);
        const start = new Date(yr, mo - 1, 1);
        const end   = new Date(yr, mo, 1);
        dateWhere   = { invoiceDate: { gte: start, lt: end } };
      }
      let purchaseDateWhere: Record<string, unknown> = {};
      if (y && m) {
        const yr    = Number(y);
        const mo    = Number(m);
        const start = new Date(yr, mo - 1, 1);
        const end   = new Date(yr, mo, 1);
        purchaseDateWhere = { billDate: { gte: start, lt: end } };
      }

      const [salesAgg, purchasesAgg, outstanding] = await Promise.all([
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
          where: { balanceDue: { gt: 0 }, status: { not: "CANCELLED" }, ...dateWhere },
        }),
      ]);
      const totalSales     = parseFloat(String(salesAgg._sum.totalAmt ?? 0));
      const totalPurchases = parseFloat(String(purchasesAgg._sum.totalAmt ?? 0));
      return reply.send(successResponse({
        totalSales,
        totalPurchases,
        totalProfit:  totalSales - totalPurchases,
        outstanding:  parseFloat(String(outstanding._sum.balanceDue ?? 0)),
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

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; startDate?: string; endDate?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      // Optional date filter
      const dateWhere: Record<string, unknown> = {};
      if (req.query.startDate && req.query.endDate) {
        dateWhere.invoiceDate = { gte: new Date(req.query.startDate), lte: new Date(req.query.endDate + "T23:59:59.999Z") };
      }
      const [rows, total] = await Promise.all([
        req.prisma.saleInvoice.findMany({ where: { status: { not: "CANCELLED" }, ...dateWhere }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.saleInvoice.count({ where: { status: { not: "CANCELLED" }, ...dateWhere } }),
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
      paidAmt: z.number().min(0).default(0), items: z.array(saleItemSchema).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const invoiceNumber = await getNextSaleNumber(req.prisma);
      const { items, paidAmt, discountPct, ...rest } = parse.data;
      const subtotal    = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
      const discountAmt = subtotal * (discountPct / 100);
      const cgst        = items.reduce((s: number, i: any) => s + i.taxAmount / 2, 0);
      const sgst        = cgst;
      const totalAmt    = subtotal - discountAmt + cgst + sgst;
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

  // ── Sale Returns ──────────────────────────────────────────

  fastify.post("/returns", async (req, reply) => {
    const schema = z.object({
      invoiceId: z.string().optional(), customerId: z.string().optional(),
      customerName: z.string().default("Walk-in Customer"), returnDate: z.string(), reason: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unitPrice: z.number().min(0), totalAmount: z.number().min(0) })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const returnNumber = await getNextReturnNumber();
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

  // ── Sale Orders ───────────────────────────────────────────

  fastify.post("/orders", async (req, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), customerId: z.string().optional(),
      orderDate: z.string(), dueDate: z.string().optional(), notes: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unitPrice: z.number().min(0), totalAmount: z.number().min(0) })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const orderNumber = await getNextOrderNumber();
      const totalAmt = parse.data.items.reduce((s: number, i: any) => s + i.totalAmount, 0);
      const order = await req.prisma.saleOrder.create({
        data: { orderNumber, customerId: parse.data.customerId ?? null, customerName: parse.data.customerName, orderDate: new Date(parse.data.orderDate), dueDate: parse.data.dueDate ? new Date(parse.data.dueDate) : null, notes: parse.data.notes ?? null, totalAmt, subtotal: totalAmt, items: { create: parse.data.items } },
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(order, "Order saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Delivery Challans ─────────────────────────────────────

  fastify.post("/challans", async (req, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), customerId: z.string().optional(),
      challanDate: z.string(), vehicleNo: z.string().optional(), notes: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unit: z.string().default("Nos") })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const challanNumber = await getNextChallanNumber();
      const challan = await req.prisma.deliveryChallan.create({
        data: { challanNumber, customerId: parse.data.customerId ?? null, customerName: parse.data.customerName, challanDate: new Date(parse.data.challanDate), vehicleNo: parse.data.vehicleNo ?? null, notes: parse.data.notes ?? null, items: { create: parse.data.items } },
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(challan, "Challan saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
