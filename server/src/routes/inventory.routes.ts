import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(row: any) {
  const opening  = parseFloat(row.openingStock);
  const stockIn  = parseFloat(row.stockIn);
  const stockOut = parseFloat(row.stockOut);
  const current  = opening + stockIn - stockOut;
  const low      = parseFloat(row.lowStockAlert);
  const salePrice = parseFloat(row.product?.salePrice ?? "0");
  return {
    id: row.id, productId: row.productId,
    productName: row.product?.name ?? "", productCode: row.product?.code ?? "",
    unit: row.product?.unit ?? "Nos",
    openingStock: opening, stockIn, stockOut, currentStock: current, lowStockAlert: low,
    stockValue: parseFloat((current * salePrice).toFixed(2)),
    status: current <= 0 ? "OUT_OF_STOCK" : current <= low ? "LOW_STOCK" : "IN_STOCK",
  };
}

export async function inventoryRoutes(fastify: FastifyInstance) {

  fastify.get("/", async (req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; status?: string } }>, reply) => {
    try {
      const pg   = Math.max(1, Number(req.query.page    ?? 1));
      const size = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));
      const rows = await req.prisma.inventoryItem.findMany({
        include: { product: { select: { name: true, code: true, unit: true, salePrice: true, isActive: true } } },
        orderBy: { product: { name: "asc" } },
        skip: (pg - 1) * size,
        take: size,
      });
      const total = await req.prisma.inventoryItem.count();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = rows.filter((r: any) => r.product?.isActive).map(toResult);
      // summary is computed from this page only — for full summary client can use page=1&pageSize=9999
      const summary = {
        total,
        inStock:    items.filter((i: any) => i.status === "IN_STOCK").length,
        lowStock:   items.filter((i: any) => i.status === "LOW_STOCK").length,
        outOfStock: items.filter((i: any) => i.status === "OUT_OF_STOCK").length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalValue: parseFloat(items.reduce((s: number, i: any) => s + i.stockValue, 0).toFixed(2)),
      };
      return reply.send(successResponse({ items, summary, total }));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });

  fastify.put("/:productId/adjust", async (req: FastifyRequest<{ Params: { productId: string } }>, reply) => {
    const schema = z.object({ openingStock: z.number().min(0) });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse(parse.error.errors[0]?.message ?? "Validation failed", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR));
    try {
      await req.prisma.inventoryItem.upsert({
        where: { productId: req.params.productId },
        create: { productId: req.params.productId, openingStock: parse.data.openingStock, stockIn: 0, stockOut: 0, lowStockAlert: 5 },
        update: { openingStock: parse.data.openingStock },
      });
      return reply.send(successResponse(null, "Stock adjusted"));
    } catch (err) { return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)); }
  });
}
