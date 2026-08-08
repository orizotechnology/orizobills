import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { getNextExpenseNumber } from "../services/counter.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(e: any) {
  return {
    id: e.id, expenseNumber: e.expenseNumber, category: e.category,
    description: e.description ?? null, amount: parseFloat(e.amount),
    paymentMethod: e.paymentMethod, expenseDate: e.expenseDate?.toISOString?.() ?? "",
    reference: e.reference ?? null, notes: e.notes ?? null,
    createdAt: e.createdAt?.toISOString?.() ?? "",
  };
}

export async function expenseRoutes(fastify: FastifyInstance) {

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>, reply) => {
    try {
      const page = Number(req.query.page ?? 1);
      const size = Number(req.query.pageSize ?? 20);
      const [rows, total] = await Promise.all([
        req.prisma.expense.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
        req.prisma.expense.count(),
      ]);
      return reply.send(successResponse({ data: rows.map(toResult), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      category: z.string().min(1), description: z.string().optional(),
      amount: z.number().min(0.01), paymentMethod: z.string().default("Cash"),
      expenseDate: z.string(), reference: z.string().optional(), notes: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      // Use counter.service — safe after deletes (MAX-based, not COUNT-based)
      const expenseNumber = await getNextExpenseNumber(req.prisma);
      const e = await req.prisma.expense.create({
        data: { expenseNumber, ...parse.data, expenseDate: new Date(parse.data.expenseDate), description: parse.data.description ?? null, reference: parse.data.reference ?? null, notes: parse.data.notes ?? null },
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(e), "Expense recorded"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({ category: z.string().optional(), description: z.string().optional(), amount: z.number().min(0).optional(), paymentMethod: z.string().optional(), expenseDate: z.string().optional(), reference: z.string().optional(), notes: z.string().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const e = await req.prisma.expense.update({ where: { id: req.params.id }, data: { ...parse.data, expenseDate: parse.data.expenseDate ? new Date(parse.data.expenseDate) : undefined } });
      return reply.send(successResponse(toResult(e), "Expense updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await req.prisma.expense.delete({ where: { id: req.params.id } });
      return reply.send(successResponse(null, "Expense deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
