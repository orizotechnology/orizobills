// Shared singleton Prisma client — re-exported from the canonical singleton.
// DO NOT create a new PrismaClient here; always use this shared instance.
export { prisma as default } from "../database/prisma/client";
