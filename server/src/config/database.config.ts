// =============================================================
// DATABASE CONFIGURATION
// PostgreSQL connection via Prisma — ENV variables only.
// The DATABASE_URL env var is read directly by Prisma.
// =============================================================

export const databaseConfig = {
  // Prisma reads DATABASE_URL automatically from environment.
  // Ensure it is set in .env:
  // DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
  url: process.env.DATABASE_URL,

  // Connection pool settings (Prisma defaults are suitable for most cases)
  pool: {
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT ?? 30000),
  },
} as const;

if (!databaseConfig.url) {
  console.warn(
    "[DATABASE] WARNING: DATABASE_URL is not set. " +
      "Database operations will fail until it is configured."
  );
}
