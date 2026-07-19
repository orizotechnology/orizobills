// =============================================================
// BRANCH CONTEXT PLUGIN
// Reads the X-Branch-Id header from every request and attaches
// the correct PrismaClient to req.prisma.
//
// If no header or unknown branch → falls back to the default DB.
// =============================================================

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { getPrismaForBranch, getDefaultPrisma } from "../database/prisma/manager";

// Extend FastifyRequest to include req.prisma
declare module "fastify" {
  interface FastifyRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any;
    branchId: string | null;
  }
}

const branchPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("prisma",   null);
  fastify.decorateRequest("branchId", null);

  fastify.addHook("onRequest", async (req) => {
    const branchId = req.headers["x-branch-id"] as string | undefined;
    req.branchId = branchId ?? null;
    req.prisma   = branchId
      ? getPrismaForBranch(branchId)
      : getDefaultPrisma();
  });
};

export default fp(branchPlugin, { name: "branch-context" });
