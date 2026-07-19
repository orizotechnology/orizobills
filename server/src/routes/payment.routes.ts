import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

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

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.paymentIn.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.paymentIn.count(),
      ]);
      return reply.send(successResponse({ data: rows.map(toResult), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
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
      const count = await req.prisma.paymentIn.count();
      const paymentNumber = `PAY${String(count + 1).padStart(4, "0")}`;
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
