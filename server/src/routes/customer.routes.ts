import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(c: any) {
  return {
    id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null,
    address: c.address ?? null, gstin: c.gstin ?? null,
    balance: parseFloat(c.balance), isActive: c.isActive,
    createdAt: c.createdAt?.toISOString?.() ?? "",
  };
}

export async function customerRoutes(fastify: FastifyInstance) {

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { search?: string; pageSize?: string } }>, reply) => {
    try {
      const { search, pageSize } = req.query;
      const where = search
        ? { isActive: true, OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : { isActive: true };
      const rows = await req.prisma.customer.findMany({ where, orderBy: { name: "asc" }, ...(pageSize ? { take: Number(pageSize) } : {}) });
      return reply.send(successResponse(rows.map(toResult)));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const c = await req.prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!c) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(toResult(c)));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(), address: z.string().optional(), gstin: z.string().optional(), balance: z.number().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const c = await req.prisma.customer.create({ data: parse.data });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(c), "Customer created"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({ name: z.string().min(1).optional(), phone: z.string().optional(), email: z.string().email().optional(), address: z.string().optional(), gstin: z.string().optional(), balance: z.number().optional(), isActive: z.boolean().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const c = await req.prisma.customer.update({ where: { id: req.params.id }, data: parse.data });
      return reply.send(successResponse(toResult(c), "Customer updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await req.prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
      return reply.send(successResponse(null, "Customer deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
