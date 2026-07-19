import type { FastifyInstance } from "fastify";
import {
  getBranches,
  postCreateBranch,
  deleteOneBranch,
  patchSetDefault,
} from "../controllers/branch.controller";
import { getAllRegisteredBranches } from "../database/prisma/manager";
import { successResponse } from "../utils/response.util";

// =============================================================
// BRANCH ROUTES
// Prefix: /api/branches
// =============================================================

export async function branchRoutes(fastify: FastifyInstance) {
  // GET /api/branches — list all active branches
  fastify.get("/", getBranches);

  // GET /api/branches/registry — list all branches with DB credentials
  fastify.get("/registry", async (_req, reply) => {
    return reply.send(successResponse(getAllRegisteredBranches()));
  });

  // POST /api/branches — create new branch + new database
  fastify.post("/", postCreateBranch);

  // DELETE /api/branches/:id — soft delete
  fastify.delete("/:id", deleteOneBranch);

  // PATCH /api/branches/:id/default — set as default
  fastify.patch("/:id/default", patchSetDefault);
}
