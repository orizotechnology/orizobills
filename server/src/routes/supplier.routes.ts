import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(s: any) {
  return {
    id: s.id, name: s.name, phone: s.phone ?? null, email: s.email ?? null,
    address: s.address ?? null, gstin: s.gstin ?? null,
    balance: parseFloat(s.balance), isActive: s.isActive,
    createdAt: s.createdAt?.toISOString?.() ?? "",
  };
}

export async function supplierRoutes(fastify: FastifyInstance) {

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { search?: string; page?: string; pageSize?: string } }>, reply) => {
    try {
      const { search, page, pageSize } = req.query;
      const pg   = Math.max(1, Number(page ?? 1));
      const size = Math.min(200, Math.max(1, Number(pageSize ?? 50)));
      const where = search
        ? { isActive: true, OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : { isActive: true };
      const [rows, total] = await Promise.all([
        req.prisma.supplier.findMany({ where, orderBy: { name: "asc" }, skip: (pg - 1) * size, take: size }),
        req.prisma.supplier.count({ where }),
      ]);
      return reply.send(successResponse({ data: rows.map(toResult), total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const s = await req.prisma.supplier.findUnique({ where: { id: req.params.id } });
      if (!s) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(toResult(s)));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.post("/", async (req, reply) => {
    const schema = z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(), address: z.string().optional(), gstin: z.string().optional(), balance: z.number().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const s = await req.prisma.supplier.create({ data: parse.data });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(s), "Supplier created"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({ name: z.string().min(1).optional(), phone: z.string().optional(), email: z.string().email().optional(), address: z.string().optional(), gstin: z.string().optional(), balance: z.number().optional(), isActive: z.boolean().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const s = await req.prisma.supplier.update({ where: { id: req.params.id }, data: parse.data });
      return reply.send(successResponse(toResult(s), "Supplier updated"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      // Soft-delete: set isActive=false so existing purchase invoices
      // that reference this supplier keep their FK intact.
      await req.prisma.supplier.update({
        where: { id: req.params.id },
        data:  { isActive: false },
      });
      return reply.send(successResponse(null, "Supplier deleted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
