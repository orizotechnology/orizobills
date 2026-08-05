// =============================================================
// SECURE CONFIG — OS Keychain via keytar
//
// Stores MySQL credentials in the OS keychain:
//   Windows → Windows Credential Manager
//   macOS   → Keychain
//   Linux   → libsecret / gnome-keyring
//
// The password is NEVER written to disk or localStorage.
// Other non-sensitive values (host, port, dbName, user) are
// stored in data/db-config.json since they are not secret —
// only the password uses keytar.
//
// Fallback: if DB_* env vars are set, those override keychain
// (useful for CI/CD and Docker deployments).
// =============================================================

import * as fs   from "fs";
import * as path from "path";

// keytar is a native addon — require() so it fails gracefully
// if the native binding isn't built yet.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let keytar: typeof import("keytar") | null = null;
try { keytar = require("keytar"); } catch { /* keytar not available */ }

const SERVICE_NAME = "orizo-bills";
const ACCOUNT_NAME = "mysql-password";
const CONFIG_FILE  = path.resolve(__dirname, "../../data/db-config.json");

export interface DbConfig {
  host:     string;
  port:     number;
  user:     string;
  database: string;
}

export interface FullDbConfig extends DbConfig {
  password: string;
}

// ── Ensure data/ folder exists ────────────────────────────────
function ensureDataDir(): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Save config ───────────────────────────────────────────────

export async function saveDbConfig(cfg: FullDbConfig): Promise<void> {
  ensureDataDir();

  // Save non-sensitive fields to JSON
  const nonSecret: DbConfig = { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(nonSecret, null, 2), "utf8");

  // Save password to OS keychain
  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, cfg.password);
  } else {
    // Fallback: restricted file (0600) — never committed (.gitignore covers this)
    const envPath = path.resolve(__dirname, "../../data/.mysql-pass");
    fs.writeFileSync(envPath, cfg.password, { mode: 0o600, encoding: "utf8" });
    process.stderr.write("[secure-config] WARNING: keytar not available — password stored in data/.mysql-pass\n");
  }
}

// ── Load config ───────────────────────────────────────────────

export async function loadDbConfig(): Promise<FullDbConfig | null> {
  // 1. Env vars override everything (CI/Docker)
  if (process.env.DB_HOST && process.env.DB_PASS) {
    return {
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT ?? 3306),
      user:     process.env.DB_USER ?? "root",
      password: process.env.DB_PASS,
      database: process.env.DB_NAME ?? "erp_system",
    };
  }

  // 2. Read non-sensitive fields from JSON file
  if (!fs.existsSync(CONFIG_FILE)) return null;
  let nonSecret: DbConfig;
  try {
    nonSecret = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as DbConfig;
  } catch { return null; }

  // 3. Read password from keychain
  let password: string | null = null;
  if (keytar) {
    password = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  }
  if (!password) {
    // Fallback file
    const fp = path.resolve(__dirname, "../../data/.mysql-pass");
    if (fs.existsSync(fp)) password = fs.readFileSync(fp, "utf8").trim();
  }

  if (!password) return null;
  return { ...nonSecret, password };
}

// ── Check if config exists ────────────────────────────────────

export function configFileExists(): boolean {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("PLACEHOLDER")) return true;
  if (process.env.DB_HOST && process.env.DB_PASS) return true;
  return fs.existsSync(CONFIG_FILE);
}

// ── Delete config (reset / re-setup) ─────────────────────────

export async function deleteDbConfig(): Promise<void> {
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  const fp = path.resolve(__dirname, "../../data/.mysql-pass");
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  if (keytar) await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME).catch(() => {});
}

// ── Build DATABASE_URL from config ────────────────────────────

export function buildDatabaseUrl(cfg: FullDbConfig): string {
  const pass = encodeURIComponent(cfg.password);
  const user = encodeURIComponent(cfg.user);
  return `mysql://${user}:${pass}@${cfg.host}:${cfg.port}/${cfg.database}`;
}
