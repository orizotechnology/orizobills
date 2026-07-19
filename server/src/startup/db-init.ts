// =============================================================
// DB INIT — runs on every server startup (MySQL version)
//
// 0. Ensures required application folders exist
// 1. Creates the MySQL database if it doesn't exist (with retry)
// 2. Pushes the Prisma schema (idempotent)
// 3. Seeds a default branch if none exists
// 4. Back-fills InventoryItem rows for products missing one
// 5. Registers default branch in the credentials registry
// =============================================================

import { execSync }  from "child_process";
import * as path     from "path";
import * as fs       from "fs";
import * as mysql    from "mysql2/promise";
import { registerDefaultBranchInRegistry } from "../services/branch.service";

function log(msg: string)  { process.stdout.write(`[DB-INIT] ${msg}\n`); }
function warn(msg: string) { process.stderr.write(`[DB-INIT] WARN: ${msg}\n`); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

// =============================================================
// Step 0: Ensure application folders
// =============================================================

const APP_FOLDERS = ["uploads", "uploads/import", "uploads/export", "logs", "backups", "data"];

function ensureFolders(): void {
  const serverRoot = path.resolve(__dirname, "../..");
  for (const rel of APP_FOLDERS) {
    const full = path.join(serverRoot, rel);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      log(`Created folder: ${rel}`);
    }
  }
  log("Application folders verified.");
}

// =============================================================
// Step 1: Parse MySQL URL helper
// =============================================================

function parseMysqlUrl(rawUrl: string) {
  const url      = new URL(rawUrl);
  const host     = url.hostname;
  const port     = Number(url.port || 3306);
  const user     = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.replace(/^\//, "").split("?")[0];
  return { host, port, user, password, database };
}

// =============================================================
// Step 2: Create DB if missing (with retry)
// =============================================================

async function ensureDatabaseExists(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is not set.");

  const { host, port, user, password, database } = parseMysqlUrl(rawUrl);

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log(`Connecting to MySQL at ${host}:${port} (attempt ${attempt}/${MAX_RETRIES})…`);

      // Connect WITHOUT a database name so we can CREATE DATABASE
      const conn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        connectTimeout: 8000,
        multipleStatements: false,
      });

      try {
        const [rows] = await conn.execute(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [database]
        ) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

        if (!rows.length) {
          await conn.execute(
            `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
          );
          log(`Database "${database}" created successfully.`);
        } else {
          log(`Database "${database}" already exists.`);
        }
      } finally {
        await conn.end();
      }

      return; // success — exit retry loop

    } catch (err) {
      const msg = (err as Error).message;
      if (attempt < MAX_RETRIES) {
        warn(`MySQL connection failed: ${msg}. Retrying in ${RETRY_DELAY / 1000}s…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      } else {
        throw new Error(`MySQL unreachable after ${MAX_RETRIES} attempts: ${msg}`);
      }
    }
  }
}

// =============================================================
// Step 3: Push Prisma schema (idempotent)
// =============================================================

function pushSchema(): void {
  const serverRoot = path.resolve(__dirname, "../..");
  log("Syncing Prisma schema with MySQL…");
  try {
    const out = execSync(
      "npx prisma db push --accept-data-loss --skip-generate",
      {
        cwd:      serverRoot,
        env:      { ...process.env },
        stdio:    "pipe",
        encoding: "utf8",
        timeout:  120_000,
      }
    );
    out.split("\n")
       .map((l) => l.trim())
       .filter((l) => l && !l.includes("\x1b[") && !l.startsWith("⠙") && !l.startsWith("⠸"))
       .forEach((l) => log(l));
    log("Schema in sync.");
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const detail = (e.stderr || e.stdout || e.message || "").slice(0, 600);
    // Non-fatal: if schema push fails but tables already exist, keep going
    warn(`Schema push failed (tables may already be in sync): ${detail}`);
  }
}

// =============================================================
// Step 4: Seed default branch
// =============================================================

async function seedBranch(prisma: PrismaLike): Promise<void> {
  const n = await prisma.branch.count();
  if (n > 0) { log(`Branch seed skipped (${n} branch(es) already exist).`); return; }
  await prisma.branch.create({
    data: {
      name:      "Main Branch",
      slug:      "branch_main_branch",
      isDefault: true,
      isActive:  true,
    },
  });
  log("Default branch 'Main Branch' created.");
}

// =============================================================
// Step 5: Back-fill InventoryItem rows for orphan products
// =============================================================

async function backfillInventory(prisma: PrismaLike): Promise<void> {
  const orphans = await prisma.product.findMany({
    where:  { isActive: true, inventoryItem: null },
    select: { id: true },
  });
  if (!orphans.length) { log("All products have inventory rows."); return; }
  for (const { id } of orphans) {
    await prisma.inventoryItem.create({
      data: { productId: id, openingStock: 0, stockIn: 0, stockOut: 0, lowStockAlert: 5 },
    });
  }
  log(`Back-filled ${orphans.length} inventory row(s).`);
}

// =============================================================
// Public entry point — called from server/src/index.ts
// =============================================================

export async function initDatabase(prisma: PrismaLike): Promise<void> {
  log("=== DB init starting (MySQL / erp_system) ===");

  // 0. Folders
  ensureFolders();

  // 1. Create DB if missing
  try {
    await ensureDatabaseExists();
  } catch (err) {
    warn(`Could not ensure DB exists: ${(err as Error).message}`);
    warn("Continuing anyway — tables may already exist.");
  }

  // 2. Push schema (idempotent)
  pushSchema();

  // 3. Connect Prisma
  try {
    await prisma.$connect();
    log("Prisma connected to erp_system.");
  } catch (err) {
    throw new Error(`Prisma connect failed: ${(err as Error).message}`);
  }

  // 4. Seed
  await seedBranch(prisma);

  // 5. Back-fill inventory
  await backfillInventory(prisma);

  // 6. Register default branch in file-based registry
  try {
    await registerDefaultBranchInRegistry();
    log("Branch registry updated.");
  } catch (err) {
    warn(`Registry seed failed: ${(err as Error).message}`);
  }

  log("=== DB init complete — erp_system is ready ===");
}
