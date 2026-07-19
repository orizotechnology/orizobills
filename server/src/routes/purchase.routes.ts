import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// =============================================================
// PURCHASE ROUTES — /api/purchases
// Uses req.prisma for all DB operations (branch-aware).
// =============================================================

const itemSchema = z.object({
  itemName:    z.string().min(1), itemCode: z.string(), productId: z.string().optional(),
  quantity:    z.number().min(0), unit: z.string().default("Nos"), mrp: z.number().min(0).default(0),
  unitPrice:   z.number().min(0), discountPct: z.number().min(0).default(0),
  discountAmt: z.number().min(0).default(0), taxPercent: z.number().min(0).default(0),
  taxAmount:   z.number().min(0).default(0), totalAmount: z.number().min(0),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(p: any) {
  return {
    id: p.id, invoiceNumber: p.invoiceNumber, supplierName: p.supplierName,
    supplierId: p.supplierId ?? null, billDate: p.billDate?.toISOString?.() ?? "",
    paymentMethod: p.paymentMethod, subtotal: parseFloat(p.subtotal),
    discountAmt: parseFloat(p.discountAmt), taxAmt: parseFloat(p.taxAmt),
    totalAmt: parseFloat(p.totalAmt), status: p.status,
    itemCount: p._count?.items ?? p.items?.length ?? 0,
    createdAt: p.createdAt?.toISOString?.() ?? "",
  };
}

export async function purchaseRoutes(fastify: FastifyInstance) {

  // ── Static routes FIRST (before /:id) ────────────────────

  fastify.get("/next-number", async (req, reply) => {
    try {
      const count = await req.prisma.purchaseInvoice.count();
      return reply.send(successResponse({ number: `PUR${String(count + 1).padStart(4, "0")}` }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/returns", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.purchaseReturn.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.purchaseReturn.count(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send(successResponse({ data: rows.map((r: any) => ({ id: r.id, returnNumber: r.returnNumber, supplierName: r.supplierName, returnDate: r.returnDate?.toISOString?.() ?? "", totalAmt: parseFloat(r.totalAmt), status: r.status, createdAt: r.createdAt?.toISOString?.() ?? "" })), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Collection & parameterised ────────────────────────────

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1), size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.purchaseInvoice.findMany({ where: { status: { not: "CANCELLED" } }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.purchaseInvoice.count({ where: { status: { not: "CANCELLED" } } }),
      ]);
      return reply.send(successResponse({ data: rows.map(toResult), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const p = await req.prisma.purchaseInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!p) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(p));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      supplierName: z.string().min(1), supplierId: z.string().optional(),
      billDate: z.string(), poNumber: z.string().optional(), poDate: z.string().optional(),
      paymentMethod: z.string().default("Cash"), discountPct: z.number().min(0).default(0),
      taxType: z.string().default("NONE"), terms: z.string().optional(), notes: z.string().optional(),
      items: z.array(itemSchema).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const count = await req.prisma.purchaseInvoice.count();
      const invoiceNumber = `PUR${String(count + 1).padStart(4, "0")}`;
      const { items, ...rest } = parse.data;
      const subtotal    = items.reduce((s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity, 0);
      const discountAmt = subtotal * (rest.discountPct / 100);
      const taxAmt      = items.reduce((s: number, i: { taxAmount: number }) => s + i.taxAmount, 0);
      const totalAmt    = subtotal - discountAmt + taxAmt;

      const invoice = await req.prisma.purchaseInvoice.create({
        data: {
          invoiceNumber, supplierName: rest.supplierName, supplierId: rest.supplierId ?? null,
          billDate: new Date(rest.billDate), poDate: rest.poDate ? new Date(rest.poDate) : null,
          poNumber: rest.poNumber ?? null, paymentMethod: rest.paymentMethod, discountPct: rest.discountPct,
          taxType: rest.taxType, terms: rest.terms ?? null, notes: rest.notes ?? null,
          subtotal, discountAmt, taxAmt, totalAmt, status: "CONFIRMED",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: { create: items.map((i: any) => ({ productId: i.productId ?? null, itemName: i.itemName, itemCode: i.itemCode, quantity: i.quantity, unit: i.unit, mrp: i.mrp, unitPrice: i.unitPrice, discountPct: i.discountPct, discountAmt: i.discountAmt, taxPercent: i.taxPercent, taxAmount: i.taxAmount, totalAmount: i.totalAmount })) },
        },
        include: { _count: { select: { items: true } } },
      });

      for (const item of items) {
        if (item.productId) {
          await req.prisma.inventoryItem.upsert({ where: { productId: item.productId }, create: { productId: item.productId, openingStock: 0, stockIn: item.quantity, stockOut: 0, lowStockAlert: 5 }, update: { stockIn: { increment: item.quantity } } });
        }
      }
      if (rest.supplierId && rest.paymentMethod === "Credit") {
        await req.prisma.supplier.update({ where: { id: rest.supplierId }, data: { balance: { increment: totalAmt } } });
      }
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(invoice), "Purchase saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const inv = await req.prisma.purchaseInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (inv && inv.status !== "CANCELLED") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of inv.items as any[]) {
          if (item.productId) await req.prisma.inventoryItem.update({ where: { productId: item.productId }, data: { stockIn: { decrement: parseFloat(String(item.quantity)) } } });
        }
        await req.prisma.purchaseInvoice.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });
      }
      return reply.send(successResponse(null, "Purchase cancelled"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  // ── Purchase Returns ──────────────────────────────────────

  fastify.post("/returns", async (req, reply) => {
    const schema = z.object({
      invoiceId: z.string().optional(), supplierId: z.string().optional(),
      supplierName: z.string().min(1), returnDate: z.string(), reason: z.string().optional(),
      items: z.array(z.object({ productId: z.string().optional(), itemName: z.string(), itemCode: z.string(), quantity: z.number().min(0), unitPrice: z.number().min(0), totalAmount: z.number().min(0) })).min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const count = await req.prisma.purchaseReturn.count();
      const returnNumber = `PRN${String(count + 1).padStart(4, "0")}`;
      const totalAmt = parse.data.items.reduce((s: number, i: { totalAmount: number }) => s + i.totalAmount, 0);
      const ret = await req.prisma.purchaseReturn.create({
        data: { returnNumber, invoiceId: parse.data.invoiceId ?? null, supplierId: parse.data.supplierId ?? null, supplierName: parse.data.supplierName, returnDate: new Date(parse.data.returnDate), reason: parse.data.reason ?? null, subtotal: totalAmt, totalAmt, status: "CONFIRMED" },
      });
      for (const item of parse.data.items) {
        if (item.productId) await req.prisma.inventoryItem.update({ where: { productId: item.productId }, data: { stockIn: { decrement: item.quantity } } });
      }
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(ret, "Purchase return saved"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
