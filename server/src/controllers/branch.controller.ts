import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listBranches,
  createBranch,
  deleteBranch,
  setDefaultBranch,
} from "../services/branch.service";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// =============================================================
// BRANCH CONTROLLER
// =============================================================

// Validation schemas
const createBranchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters").max(100),
  address: z.string().max(500).optional(),
});

/**
 * GET /api/branches
 * List all active branches
 */
export async function getBranches(
  _req: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const branches = await listBranches();
    return reply.status(HTTP_STATUS.OK).send(successResponse(branches));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch branches";
    return reply
      .status(HTTP_STATUS.INTERNAL_ERROR)
      .send(errorResponse(message, HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
  }
}

/**
 * POST /api/branches
 * Create a new branch + PostgreSQL schema
 */
export async function postCreateBranch(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const parse = createBranchSchema.safeParse(req.body);

  if (!parse.success) {
    return reply.status(HTTP_STATUS.BAD_REQUEST).send(
      errorResponse(
        parse.error.errors[0]?.message ?? "Validation failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      )
    );
  }

  try {
    const result = await createBranch(parse.data);
    return reply
      .status(HTTP_STATUS.CREATED)
      .send(successResponse(result, `Branch "${result.branch.name}" created successfully`));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create branch";
    const statusCode = message.includes("already exists")
      ? HTTP_STATUS.CONFLICT
      : HTTP_STATUS.INTERNAL_ERROR;
    const code = message.includes("already exists")
      ? ERROR_CODES.CONFLICT
      : ERROR_CODES.DATABASE_ERROR;
    return reply.status(statusCode).send(errorResponse(message, statusCode, code));
  }
}

/**
 * DELETE /api/branches/:id
 * Soft-delete a branch (marks inactive)
 */
export async function deleteOneBranch(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const branch = await deleteBranch(req.params.id);
    return reply
      .status(HTTP_STATUS.OK)
      .send(successResponse(branch, "Branch deactivated"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete branch";
    return reply
      .status(HTTP_STATUS.INTERNAL_ERROR)
      .send(errorResponse(message, HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
  }
}

/**
 * PATCH /api/branches/:id/default
 * Set branch as default
 */
export async function patchSetDefault(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const branch = await setDefaultBranch(req.params.id);
    return reply
      .status(HTTP_STATUS.OK)
      .send(successResponse(branch, "Default branch updated"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set default branch";
    return reply
      .status(HTTP_STATUS.INTERNAL_ERROR)
      .send(errorResponse(message, HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR));
  }
}
