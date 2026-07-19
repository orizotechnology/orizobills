import { execSync }   from "child_process";
import * as path      from "path";
import * as mysql     from "mysql2/promise";
import { getDefaultPrisma } from "../database/prisma/manager";
import {
  registerBranch,
  getAllRegisteredBranches,
  getPrismaForBranch,
  evictBranchClient,
  type BranchRegistryEntry,
} from "../database/prisma/manager";
import type { CreateBranchInput, CreateBranchResponse, Branch } from "../types/branch.types";

// =============================================================
// BRANCH SERVICE — MySQL edition
// Each branch gets its own MySQL database.
// =============================================================

const prisma = getDefaultPrisma();

// ── Utilities ─────────────────────────────────────────────────

export function slugifyBranchName(name: string): string {
  return (
    "branch_" +
    name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").substring(0, 40)
  );
}

function dbNameFromSlug(slug: string): string {
  return `erp_${slug.replace(/^branch_/, "")}`;
}

function buildDbUrl(dbName: string): string {
  const base = process.env.DATABASE_URL ?? "";
  const url  = new URL(base);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function parseMysqlUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return {
    host:     url.hostname,
    port:     Number(url.port || 3306),
    user:     decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "").split("?")[0],
  };
}

// ── DB creation ───────────────────────────────────────────────

async function createBranchDatabase(dbName: string): Promise<void> {
  const { host, port, user, password } = parseMysqlUrl(process.env.DATABASE_URL ?? "");

  const conn = await mysql.createConnection({ host, port, user, password, connectTimeout: 8000 });
  try {
    const [rows] = await conn.execute(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName]
    ) as [mysql.RowDataPacket[], mysql.FieldPacket[]];

    if (!rows.length) {
      await conn.execute(
        `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      process.stdout.write(`[BRANCH] Created database "${dbName}"\n`);
    }
  } finally {
    await conn.end();
  }
}

function pushSchemaToBranchDb(dbUrl: string): void {
  const serverRoot = path.resolve(__dirname, "../..");
  process.stdout.write("[BRANCH] Pushing schema to new branch DB…\n");
  const out = execSync("npx prisma db push --accept-data-loss --skip-generate", {
    cwd:      serverRoot,
    env:      { ...process.env, DATABASE_URL: dbUrl },
    stdio:    "pipe",
    encoding: "utf8",
    timeout:  90_000,
  });
  out.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.includes("\x1b["))
    .forEach((l) => process.stdout.write(`[BRANCH] ${l}\n`));
}

// ── Service methods ───────────────────────────────────────────

export async function listBranches(): Promise<Branch[]> {
  return prisma.branch.findMany({
    where:   { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function getBranchById(id: string): Promise<Branch | null> {
  return prisma.branch.findUnique({ where: { id } });
}

export async function createBranch(input: CreateBranchInput): Promise<CreateBranchResponse> {
  const { name, address } = input;
  const trimmedName = name.trim();
  if (trimmedName.length < 2) throw new Error("Branch name must be at least 2 characters.");

  const slug   = slugifyBranchName(trimmedName);
  const dbName = dbNameFromSlug(slug);
  const dbUrl  = buildDbUrl(dbName);

  const existing = await prisma.branch.findFirst({
    where: { OR: [{ name: { equals: trimmedName } }, { slug }] },
  });
  if (existing) throw new Error(`A branch named "${trimmedName}" already exists.`);

  const count     = await prisma.branch.count();
  const isDefault = count === 0;

  await createBranchDatabase(dbName);
  pushSchemaToBranchDb(dbUrl);

  const branch: Branch = await prisma.branch.create({
    data: { name: trimmedName, slug, address: address?.trim() || null, isDefault, isActive: true },
  });

  const entry: BranchRegistryEntry = {
    branchId:   branch.id,
    branchName: branch.name,
    dbName,
    dbUrl,
    createdAt:  new Date().toISOString(),
  };
  registerBranch(entry);

  const branchDb = getPrismaForBranch(branch.id);
  try {
    await branchDb.branch.upsert({
      where:  { slug },
      update: { name: trimmedName, isDefault: true },
      create: { id: branch.id, name: trimmedName, slug, address: address?.trim() || null, isDefault: true, isActive: true },
    });
  } catch { /* non-fatal */ }

  process.stdout.write(`[BRANCH] Branch "${trimmedName}" ready on DB "${dbName}"\n`);
  return { branch, schemaName: dbName };
}

export async function registerDefaultBranchInRegistry(): Promise<void> {
  const existing = getAllRegisteredBranches();
  if (existing.length > 0) return;

  const defaultBranch = await prisma.branch.findFirst({ where: { isDefault: true } });
  if (!defaultBranch) return;

  const dbUrl  = process.env.DATABASE_URL ?? "";
  const dbName = parseMysqlUrl(dbUrl).database;

  registerBranch({
    branchId:   defaultBranch.id,
    branchName: defaultBranch.name,
    dbName,
    dbUrl,
    createdAt:  defaultBranch.createdAt.toISOString(),
  });
  process.stdout.write("[BRANCH] Default branch registered in registry.\n");
}

export async function deleteBranch(id: string): Promise<Branch> {
  evictBranchClient(id);
  return prisma.branch.update({ where: { id }, data: { isActive: false } });
}

export async function setDefaultBranch(id: string): Promise<Branch> {
  await prisma.branch.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  return prisma.branch.update({ where: { id }, data: { isDefault: true } });
}
