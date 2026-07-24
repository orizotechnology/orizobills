// =============================================================
// CONFIG ROUTES — /api/config
//
// GET  /api/config/exists  → { exists: boolean }
//   Returns true if the MySQL password has been configured and
//   stored (either via env var or the saved config file).
//
// POST /api/config/setup   → { host, port, user, password, database }
//   Validates the MySQL credentials by opening a test connection,
//   persists non-sensitive fields to data/db-config.json,
//   stores the password in the OS keychain (keytar) or a
//   restricted local file as fallback.
//   Then restarts DB init so the rest of the app can connect.
//
// Password is NEVER echoed back in any response.
// =============================================================

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import * as fs   from "fs";
import * as path from "path";
import * as mysql from "mysql2/promise";

// ── keytar (OS keychain) ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let keytar: any = null;
try { keytar = require("keytar"); } catch { /* native addon not available */ }

const SERVICE   = "orizo-bills";
const ACCOUNT   = "mysql-password";
const CFG_FILE  = path.resolve(__dirname, "../../data/db-config.json");

function ensureDataDir() {
  const dir = path.dirname(CFG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function savePassword(password: string): Promise<void> {
  if (keytar) {
    await keytar.setPassword(SERVICE, ACCOUNT, password);
    return;
  }
  // Fallback: restricted file (0600) — never committed (in .gitignore)
  ensureDataDir();
  const p = path.resolve(__dirname, "../../data/.mysql-pass");
  fs.writeFileSync(p, password, { mode: 0o600, encoding: "utf8" });
}

export async function getStoredPassword(): Promise<string | null> {
  // 1. Env var wins (CI / Docker)
  if (process.env.DB_PASS_OVERRIDE) return process.env.DB_PASS_OVERRIDE;
  // 2. Keychain
  if (keytar) {
    const p = await keytar.getPassword(SERVICE, ACCOUNT);
    if (p) return p;
  }
  // 3. Fallback file
  const fp = path.resolve(__dirname, "../../data/.mysql-pass");
  if (fs.existsSync(fp)) return fs.readFileSync(fp, "utf8").trim();
  return null;
}

export function isDbConfigured(): boolean {
  // If the env already has a full DATABASE_URL, it's configured
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("PLACEHOLDER")) return true;
  // Or if the config file exists (written by setup)
  return fs.existsSync(CFG_FILE);
}

function friendlyError(msg: string): string {
  if (msg.includes("ER_ACCESS_DENIED") || msg.toLowerCase().includes("access denied"))
    return "Wrong MySQL password. Please re-enter your credentials.";
  if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND"))
    return "MySQL is not running or unreachable. Please start MySQL and try again.";
  return msg;
}

export async function configRoutes(fastify: FastifyInstance) {

  // GET /api/config/exists
  fastify.get("/exists", async (_req, reply) => {
    return reply.send({ success: true, data: { exists: isDbConfigured() } });
  });

  // POST /api/config/setup
  fastify.post("/setup", async (req: FastifyRequest, reply) => {
    const schema = z.object({
      host:     z.string().min(1).default("localhost"),
      port:     z.number().int().min(1).max(65535).default(3306),
      user:     z.string().min(1).default("root"),
      password: z.string(),
      database: z.string().min(1).default("erp_system"),
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: { message: parse.error.errors[0]?.message ?? "Validation failed" },
      });
    }

    const { host, port, user, password, database } = parse.data;

    // Step 1: Test connection (without selecting a DB)
    try {
      const conn = await mysql.createConnection({ host, port, user, password, connectTimeout: 8000 });
      await conn.end();
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: { message: friendlyError((err as Error).message) },
      });
    }

    // Step 2: Save password to keychain / restricted file
    await savePassword(password);

    // Step 3: Write non-sensitive config to file
    ensureDataDir();
    fs.writeFileSync(CFG_FILE, JSON.stringify({ host, port, user, database }, null, 2), "utf8");

    // Step 4: Update DATABASE_URL in the running process
    const encodedPass = encodeURIComponent(password);
    const encodedUser = encodeURIComponent(user);
    process.env.DATABASE_URL = `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;

    return reply.send({ success: true, message: "Database configured successfully." });
  });

  // DELETE /api/config/reset  (for re-setup)
  fastify.delete("/reset", async (_req, reply) => {
    if (fs.existsSync(CFG_FILE)) fs.unlinkSync(CFG_FILE);
    const fp = path.resolve(__dirname, "../../data/.mysql-pass");
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    if (keytar) await keytar.deletePassword(SERVICE, ACCOUNT).catch(() => {});
    return reply.send({ success: true, message: "Configuration reset." });
  });
}
