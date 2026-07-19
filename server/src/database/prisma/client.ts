// =============================================================
// PRISMA CLIENT SINGLETON
// Re-exports the default Prisma client from the manager.
// All services that import from here get the default (startup) DB.
// Branch-scoped clients are obtained via getPrismaForBranch().
// =============================================================

export { getDefaultPrisma as getPrismaClient, getDefaultPrisma } from "./manager";

import { getDefaultPrisma } from "./manager";

export const prisma = getDefaultPrisma();
export default prisma;
