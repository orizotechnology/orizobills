import "dotenv/config";
import { buildServer } from "./app";
import { initDatabase } from "./startup/db-init";
import { prisma }       from "./database/prisma/client";

// =============================================================
// SERVER ENTRY POINT
// Startup order:
//   1. DB init  — create DB if missing, push schema, seed
//   2. Build Fastify instance
//   3. Listen on PORT
//
// If port is already taken (second instance started by the Vite
// plugin race), exit 0 so the plugin sees "clean exit" not crash.
// =============================================================

const PORT = Number(process.env.PORT ?? 5000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  // ── 1. Database ───────────────────────────────────────────
  await initDatabase(prisma);

  // ── 2. HTTP server ────────────────────────────────────────
  const server = await buildServer();

  // ── 3. Graceful shutdown ──────────────────────────────────
  const shutdown = async (sig: string) => {
    server.log.info(`${sig} received — shutting down`);
    await server.close().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));

  // ── 4. Listen on all interfaces (IPv4 + IPv6) ─────────────
  // Using "::" binds to both 0.0.0.0 (IPv4) and ::1 (IPv6)
  // so "http://localhost:5000" works whether Windows resolves
  // localhost to 127.0.0.1 or ::1 inside the Tauri WebView2.
  const listenHost = HOST === "0.0.0.0" ? "::" : HOST;
  try {
    await server.listen({ port: PORT, host: listenHost });
  } catch (err) {
    // Fall back to IPv4-only if IPv6 not available
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EAFNOSUPPORT" || e.code === "EADDRNOTAVAIL") {
      try {
        await server.listen({ port: PORT, host: "0.0.0.0" });
      } catch (err2) {
        const e2 = err2 as NodeJS.ErrnoException;
        if (e2.code === "EADDRINUSE") {
          process.stdout.write(`[startup] Port ${PORT} in use — another instance running. Exiting.\n`);
          process.exit(0);
        }
        server.log.error(err2);
        process.exit(1);
      }
      return;
    }
    if (e.code === "EADDRINUSE") {
      process.stdout.write(`[startup] Port ${PORT} in use — another instance running. Exiting.\n`);
      process.exit(0);
    }
    server.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  process.stderr.write(`[startup] FATAL: ${(err as Error).message}\n`);
  process.exit(1);
});
