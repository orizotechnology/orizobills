import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import { getPrismaForBranch } from "../database/prisma/manager";
import { getAllRegisteredBranches } from "../database/prisma/manager";

// =============================================================
// STOCK TRANSFER ROUTES — /api/transfers
//
// POST /api/transfers
//   Creates an OUT record in the sending branch's DB and an IN
//   record in the receiving branch's DB, sharing a transferRef.
//   Also adjusts inventory in both branches.
//
// GET /api/transfers/sent      — OUT records for this branch
// GET /api/transfers/received  — IN  records for this branch
// GET /api/transfers/branches  — list of all available branches
// =============================================================

export async function transferRoutes(fastify: FastifyInstance) {

  // ── GET /api/transfers/branches ───────────────────────────
  // Returns all registered branches so the UI can populate the
  // "Transfer To" dropdown. Excludes the current branch.
  fastify.get("/branches", async (req, reply) => {
    try {
      const all     = getAllRegisteredBranches();
      const current = req.branchId;
      const others  = all
        .filter((b) => b.branchId !== current)
        .map((b) => ({ id: b.branchId, name: b.branchName }));
      return reply.send(successResponse(others));
    } catch (err) {
      return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(
        errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)
      );
    }
  });

  // ── GET /api/transfers/sent ───────────────────────────────
  fastify.get(
    "/sent",
    async (
      req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>,
      reply
    ) => {
      try {
        const page = Number(req.query.page ?? 1);
        const size = Number(req.query.pageSize ?? 50);
        const [rows, total] = await Promise.all([
          req.prisma.stockTransfer.findMany({
            where:   { direction: "OUT" },
            orderBy: { transferDate: "desc" },
            skip:    (page - 1) * size,
            take:    size,
          }),
          req.prisma.stockTransfer.count({ where: { direction: "OUT" } }),
        ]);
        return reply.send(successResponse({ data: rows.map(toResult), total }));
      } catch (err) {
        return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(
          errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)
        );
      }
    }
  );

  // ── GET /api/transfers/received ───────────────────────────
  fastify.get(
    "/received",
    async (
      req: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>,
      reply
    ) => {
      try {
        const page = Number(req.query.page ?? 1);
        const size = Number(req.query.pageSize ?? 50);
        const [rows, total] = await Promise.all([
          req.prisma.stockTransfer.findMany({
            where:   { direction: "IN" },
            orderBy: { transferDate: "desc" },
            skip:    (page - 1) * size,
            take:    size,
          }),
          req.prisma.stockTransfer.count({ where: { direction: "IN" } }),
        ]);
        return reply.send(successResponse({ data: rows.map(toResult), total }));
      } catch (err) {
        return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(
          errorResponse(String(err), HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)
        );
      }
    }
  );

  // ── POST /api/transfers ───────────────────────────────────
  fastify.post("/", async (req, reply) => {
    const schema = z.object({
      toBranchId:   z.string().min(1),
      toBranchName: z.string().min(1),
      productId:    z.string().min(1),
      productName:  z.string().min(1),
      productCode:  z.string().min(1),
      quantity:     z.number().min(0.001),
      unit:         z.string().default("Nos"),
      notes:        z.string().optional(),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send(
        errorResponse(
          parse.error.errors[0]?.message ?? "Validation failed",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        )
      );
    }

    const {
      toBranchId, toBranchName,
      productId, productName, productCode,
      quantity, unit, notes,
    } = parse.data;

    // Get sending branch details from the request context
    const fromBranchId   = req.branchId ?? "default";
    const allBranches    = getAllRegisteredBranches();
    const fromBranchEntry = allBranches.find((b) => b.branchId === fromBranchId);
    const fromBranchName  = fromBranchEntry?.branchName ?? "Default Branch";

    const transferRef = uuidv4();
    const transferDate = new Date();

    // ── 1. Validate sender has enough stock ──────────────────
    const senderPrisma = req.prisma;
    const senderInv = await senderPrisma.inventoryItem.findUnique({
      where: { productId },
    });

    const senderStock = senderInv
      ? parseFloat(String(senderInv.openingStock)) +
        parseFloat(String(senderInv.stockIn)) -
        parseFloat(String(senderInv.stockOut))
      : 0;

    if (senderStock < quantity) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send(
        errorResponse(
          `Insufficient stock. Available: ${senderStock} ${unit}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        )
      );
    }

    // ── 2. Write OUT record + decrement inventory in sender ──
    await senderPrisma.$transaction(async (tx: typeof senderPrisma) => {
      await tx.stockTransfer.create({
        data: {
          transferRef,
          direction:     "OUT",
          fromBranchId,
          fromBranchName,
          toBranchId,
          toBranchName,
          productId,
          productName,
          productCode,
          quantity,
          unit,
          notes:         notes ?? null,
          status:        "COMPLETED",
          transferDate,
        },
      });

      // Decrement sender inventory (stockOut)
      await tx.inventoryItem.upsert({
        where:  { productId },
        create: {
          productId,
          openingStock: 0,
          stockIn:      0,
          stockOut:     quantity,
          lowStockAlert: 5,
        },
        update: {
          stockOut: { increment: quantity },
        },
      });
    });

    // ── 3. Write IN record + increment inventory in receiver ─
    const receiverPrisma = getPrismaForBranch(toBranchId);

    await receiverPrisma.$transaction(async (tx: typeof receiverPrisma) => {
      await tx.stockTransfer.create({
        data: {
          transferRef,
          direction:     "IN",
          fromBranchId,
          fromBranchName,
          toBranchId,
          toBranchName,
          productId,
          productName,
          productCode,
          quantity,
          unit,
          notes:         notes ?? null,
          status:        "COMPLETED",
          transferDate,
        },
      });

      // Increment receiver inventory (stockIn)
      await receiverPrisma.inventoryItem.upsert({
        where:  { productId },
        create: {
          productId,
          openingStock:  0,
          stockIn:       quantity,
          stockOut:      0,
          lowStockAlert: 5,
        },
        update: {
          stockIn: { increment: quantity },
        },
      });
    });

    return reply.status(HTTP_STATUS.CREATED).send(
      successResponse({ transferRef }, "Transfer completed successfully")
    );
  });
}

// ── Serialiser ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(t: any) {
  return {
    id:            t.id,
    transferRef:   t.transferRef,
    direction:     t.direction,
    fromBranchId:  t.fromBranchId,
    fromBranchName:t.fromBranchName,
    toBranchId:    t.toBranchId,
    toBranchName:  t.toBranchName,
    productId:     t.productId ?? null,
    productName:   t.productName,
    productCode:   t.productCode,
    quantity:      parseFloat(String(t.quantity)),
    unit:          t.unit,
    notes:         t.notes ?? null,
    status:        t.status,
    transferDate:  t.transferDate?.toISOString?.() ?? "",
    createdAt:     t.createdAt?.toISOString?.() ?? "",
  };
}
