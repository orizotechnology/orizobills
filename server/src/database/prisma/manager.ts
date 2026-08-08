// =============================================================
// PRISMA CLIENT MANAGER
// Maintains a pool of PrismaClient instances, one per branch DB.
// The "default" client reads DATABASE_URL from environment.
// Branch clients are created on-demand and cached by branchId.
//
// Usage:
//   const db = getPrismaForBranch(branchId);     // branch client
//   const db = getDefaultPrisma();               // default DB
// =============================================================

import * as fs   from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientType = any;

// Registry file persists branch → dbUrl mappings across restarts
const REGISTRY_PATH = path.resolve(__dirname, "../../../data/branches-registry.json");

// In-memory client cache: branchId → PrismaClient
const _clients = new Map<string, PrismaClientType>();

// ── Registry I/O ─────────────────────────────────────────────

export interface BranchRegistryEntry {
  branchId:   string;
  branchName: string;
  dbName:     string;
  dbUrl:      string;
  createdAt:  string;
}

function readRegistry(): Record<string, BranchRegistryEntry> {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    }
  } catch { /* ignore parse errors */ }
  return {};
}

function writeRegistry(data: Record<string, BranchRegistryEntry>): void {
  const dir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function registerBranch(entry: BranchRegistryEntry): void {
  const reg = readRegistry();
  reg[entry.branchId] = entry;
  writeRegistry(reg);
}

export function getAllRegisteredBranches(): BranchRegistryEntry[] {
  return Object.values(readRegistry());
}

export function getBranchRegistryEntry(branchId: string): BranchRegistryEntry | null {
  const reg = readRegistry();
  return reg[branchId] ?? null;
}

// ── Client factory ────────────────────────────────────────────

function createPrismaClient(dbUrl: string): PrismaClientType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client");
  const client = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return client;
}

// ── Default client (process.env.DATABASE_URL) ─────────────────

let _defaultClient: PrismaClientType | undefined;

export function getDefaultPrisma(): PrismaClientType {
  if (_defaultClient) return _defaultClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(
    "DATABASE_URL is not set. Open server/.env and replace YOUR_MYSQL_PASSWORD_HERE with your MySQL password."
  );
  if (url.includes("YOUR_MYSQL_PASSWORD_HERE")) throw new Error(
    "DATABASE_URL still has the placeholder password. Open server/.env and replace YOUR_MYSQL_PASSWORD_HERE with your actual MySQL root password."
  );
  _defaultClient = createPrismaClient(url);
  return _defaultClient;
}

// ── Branch client ─────────────────────────────────────────────

export function getPrismaForBranch(branchId: string): PrismaClientType {
  // Check in-memory cache first
  if (_clients.has(branchId)) return _clients.get(branchId)!;

  // Look up registry
  const entry = getBranchRegistryEntry(branchId);
  if (!entry) {
    // Unknown branch — fall back to default DB
    return getDefaultPrisma();
  }

  const client = createPrismaClient(entry.dbUrl);
  _clients.set(branchId, client);
  return client;
}

// ── Disconnect all clients (shutdown) ────────────────────────

export async function disconnectAll(): Promise<void> {
  const promises: Promise<void>[] = [];
  if (_defaultClient) promises.push(_defaultClient.$disconnect().catch(() => {}));
  for (const client of _clients.values()) {
    promises.push(client.$disconnect().catch(() => {}));
  }
  await Promise.all(promises);
}

// ── Invalidate a branch client (force reconnect) ─────────────

export function evictBranchClient(branchId: string): void {
  const client = _clients.get(branchId);
  if (client) {
    client.$disconnect().catch(() => {});
    _clients.delete(branchId);
  }
}
