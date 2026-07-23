import type { FastifyInstance, FastifyRequest } from "fastify";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { z } from "zod";

// =============================================================
// PRODUCT ROUTES — /api/products
// Uses req.prisma so every call goes to the active branch DB.
// =============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(p: any) {
  return {
    id:             String(p.id),
    name:           String(p.name),
    code:           String(p.code),
    barcode:        p.barcode       ? String(p.barcode)       : null,
    description:    p.description   ? String(p.description)   : null,
    hsn:            p.hsn           ? String(p.hsn)           : null,
    mrp:            parseFloat(String(p.mrp)),
    discPctOnMrp:   parseFloat(String(p.discPctOnMrp  ?? 0)),
    salePrice:      parseFloat(String(p.salePrice)),
    purchasePrice:  parseFloat(String(p.purchasePrice ?? 0)),
    discountType:   String(p.discountType ?? "Discount %"),
    saleDiscount:   parseFloat(String(p.saleDiscount  ?? 0)),
    taxPct:         parseFloat(String(p.taxPct)),
    taxRate:        p.taxRate       ? String(p.taxRate)       : null,
    taxInclusive:   Boolean(p.taxInclusive),
    unit:           String(p.unit),
    secondaryUnit:  p.secondaryUnit ? String(p.secondaryUnit) : null,
    conversionRate: p.conversionRate != null ? parseFloat(String(p.conversionRate)) : null,
    location:       p.location      ? String(p.location)      : null,
    isActive:       Boolean(p.isActive),
    createdAt:      p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
    updatedAt:      p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt ?? ""),
  };
}

export async function productRoutes(fastify: FastifyInstance) {

  // GET /api/products/barcode/:code  — MUST be before /:id
  fastify.get("/barcode/:code", async (req: FastifyRequest<{ Params: { code: string } }>, reply) => {
    try {
      const db   = req.prisma;
      const term = req.params.code.trim();
      // MySQL: case-insensitive by default on utf8mb4_unicode_ci collation — no mode needed
      const product = await db.product.findFirst({
        where: {
          isActive: true,
          OR: [
            { barcode: term },
            { code: term },
          ],
        },
      });
      if (!product) return reply.status(HTTP_STATUS.NOT_FOUND).send(
        errorResponse(`No product found for barcode: ${req.params.code}`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND)
      );
      return reply.send(successResponse(toResult(product)));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // GET /api/products
  fastify.get("/", async (req: FastifyRequest<{ Querystring: { search?: string; page?: string; pageSize?: string; filter?: string } }>, reply) => {
    try {
      const db = req.prisma;
      const { search, page, pageSize, filter } = req.query;

      if (search) {
        const results = await db.product.findMany({
          where: {
            isActive: true,
            OR: [
              { name:    { contains: search } },
              { code:    { contains: search } },
              { barcode: { contains: search } },
            ],
          },
          take: 20,
          orderBy: { name: "asc" },
        });
        return reply.send(successResponse(results.map(toResult)));
      }

      const f = (filter === "all" || filter === "inactive") ? filter : "active";
      const where = f === "all" ? {} : f === "inactive" ? { isActive: false } : { isActive: true };
      const [data, total] = await Promise.all([
        db.product.findMany({ where, skip: (Number(page ?? 1) - 1) * Number(pageSize ?? 20), take: Number(pageSize ?? 20), orderBy: { name: "asc" } }),
        db.product.count({ where }),
      ]);
      return reply.send(successResponse({ data: data.map(toResult), total }));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // GET /api/products/:id
  fastify.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const product = await req.prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse("Not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND));
      return reply.send(successResponse(toResult(product)));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // POST /api/products
  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      name:          z.string().min(1),
      code:          z.string().min(1),
      barcode:       z.string().optional(),
      description:   z.string().optional(),
      hsn:           z.string().optional(),
      mrp:           z.number().min(0),
      discPctOnMrp:  z.number().min(0).default(0),
      salePrice:     z.number().min(0),
      purchasePrice: z.number().min(0).optional(),
      discountType:  z.string().optional(),
      saleDiscount:  z.number().min(0).optional(),
      taxPct:        z.number().min(0).max(100).optional(),
      taxRate:       z.string().optional(),
      taxInclusive:  z.boolean().optional(),
      unit:          z.string().optional(),
      secondaryUnit: z.string().optional(),
      conversionRate:z.number().optional(),
      location:      z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const product = await req.prisma.product.create({ data: parse.data });
      // Ensure inventory row
      await req.prisma.inventoryItem.upsert({
        where: { productId: product.id },
        create: { productId: product.id, openingStock: 0, stockIn: 0, stockOut: 0, lowStockAlert: 5 },
        update: {},
      });
      return reply.status(HTTP_STATUS.CREATED).send(successResponse(toResult(product), "Product created"));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // PUT /api/products/:id
  fastify.put("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const schema = z.object({
      name:          z.string().min(1).optional(),
      code:          z.string().min(1).optional(),
      barcode:       z.string().optional(),
      description:   z.string().optional(),
      hsn:           z.string().optional(),
      mrp:           z.number().min(0).optional(),
      discPctOnMrp:  z.number().min(0).optional(),
      salePrice:     z.number().min(0).optional(),
      purchasePrice: z.number().min(0).optional(),
      discountType:  z.string().optional(),
      saleDiscount:  z.number().min(0).optional(),
      taxPct:        z.number().min(0).max(100).optional(),
      taxRate:       z.string().optional(),
      taxInclusive:  z.boolean().optional(),
      unit:          z.string().optional(),
      secondaryUnit: z.string().optional(),
      conversionRate:z.number().optional(),
      location:      z.string().optional(),
      isActive:      z.boolean().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      const product = await req.prisma.product.update({ where: { id: req.params.id }, data: parse.data });
      return reply.send(successResponse(toResult(product), "Product updated"));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });

  // DELETE /api/products/:id — hard delete
  fastify.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      await req.prisma.$transaction(async (tx: typeof req.prisma) => {
        await tx.inventoryItem.delete({ where: { productId: req.params.id } }).catch(() => {});
        await tx.productBatch.deleteMany({ where: { productId: req.params.id } });
        await tx.product.delete({ where: { id: req.params.id } });
      });
      return reply.send(successResponse(null, "Product deleted"));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
    }
  });
}
