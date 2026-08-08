import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { getNextPaymentInNumber } from "../services/counter.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(p: any) {
  return {
    id: p.id, paymentNumber: p.paymentNumber, customerName: p.customerName,
    customerId: p.customerId ?? null, invoiceId: p.invoiceId ?? null,
    amount: parseFloat(p.amount), paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate?.toISOString?.() ?? "",
    reference: p.reference ?? null, notes: p.notes ?? null,
    createdAt: p.createdAt?.toISOString?.() ?? "",
  };
}

export async function paymentRoutes(fastify: FastifyInstance) {

  // ── GET /api/payments/stats — today's summary ─────────────
  fastify.get("/stats", async (req: FastifyRequest<{ Querystring: { date?: string } }>, reply) => {
    try {
      const targetDate = req.query.date ? new Date(req.query.date) : new Date();
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd   = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      const [todayAgg, todayCount, monthAgg] = await Promise.all([
        req.prisma.paymentIn.aggregate({
          _sum: { amount: true },
          where: { paymentDate: { gte: dayStart, lt: dayEnd } },
        }),
        req.prisma.paymentIn.count({
          where: { paymentDate: { gte: dayStart, lt: dayEnd } },
        }),
        req.prisma.paymentIn.aggregate({
          _sum: { amount: true },
          where: {
            paymentDate: {
              gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), 1),
              lt:  new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1),
            },
          },
        }),
      ]);

      return reply.send(successResponse({
        todayAmount: parseFloat(String(todayAgg._sum.amount ?? 0)),
        todayCount,
        monthAmount: parseFloat(String(monthAgg._sum.amount ?? 0)),
      }));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // ── GET /api/payments — list with optional date filter ────
  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; startDate?: string; endDate?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.pageSize ?? 100);

      const dateWhere: Record<string, unknown> = {};
      if (req.query.startDate && req.query.endDate) {
        dateWhere.paymentDate = {
          gte: new Date(req.query.startDate),
          lte: new Date(req.query.endDate + "T23:59:59.999Z"),
        };
      }

      const [rows, total] = await Promise.all([
        req.prisma.paymentIn.findMany({
          where: dateWhere,
          orderBy: { paymentDate: "desc" },
          skip: (page - 1) * size,
          take: size,
        }),
        req.prisma.paymentIn.count({ where: dateWhere }),
      ]);
      return reply.send(successResponse({ data: rows.map(toResult), total }));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      customerName: z.string().default("Walk-in Customer"), customerId: z.string().optional(),
      invoiceId: z.string().optional(), amount: z.number().min(0.01),
      paymentMethod: z.string().default("Cash"), paymentDate: z.string(),
      reference: z.string().optional(), notes: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const paymentNumber = await getNextPaymentInNumber(req.prisma);
      const payment = await req.prisma.paymentIn.create({
        data: { paymentNumber, customerName: parse.data.customerName, customerId: parse.data.customerId ?? null, invoiceId: parse.data.invoiceId ?? null, amount: parse.data.amount, paymentMethod: parse.data.paymentMethod, paymentDate: new Date(parse.data.paymentDate), reference: parse.data.reference ?? null, notes: parse.data.notes ?? null },
      });
      // Reduce customer balance
      if (parse.data.customerId) {
        await req.prisma.customer.update({ where: { id: parse.data.customerId }, data: { balance: { decrement: parse.data.amount } } });
      }
      // Update invoice status
      if (parse.data.invoiceId) {
        const inv = await req.prisma.saleInvoice.findUnique({ where: { id: parse.data.invoiceId } });
        if (inv) {
          const newPaid = parseFloat(String(inv.paidAmt)) + parse.data.amount;
          const newBalance = Math.max(0, parseFloat(String(inv.totalAmt)) - newPaid);
          await req.prisma.saleInvoice.update({ where: { id: parse.data.invoiceId }, data: { paidAmt: newPaid, balanceDue: newBalance, status: newBalance === 0 ? "PAID" : "PARTIAL" } });
        }
      }
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(payment), "Payment recorded"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
