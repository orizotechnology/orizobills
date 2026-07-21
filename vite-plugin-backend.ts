import { type Plugin } from "vite";
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import * as net from "net";

// =============================================================
// VITE PLUGIN — AUTO-START BACKEND (Windows/Tauri)
//
// Uses the correct Vite hook:
//   configureServer  → fires when `vite` dev server starts
//   closeBundle      → NOT used for dev (use server.close hook)
//
// The backend is spawned via cmd.exe → npx tsx src/index.ts
// from the server/ directory, with all env vars forwarded.
// Output is piped to the Vite console.
// =============================================================

let backendProcess: ChildProcess | null = null;
let restartCount   = 0;
const MAX_RESTARTS = 5;
const BACKEND_PORT = 5000;

const log   = (m: string) => process.stdout.write(`\x1b[36m[backend]\x1b[0m ${m}\n`);
const warn  = (m: string) => process.stdout.write(`\x1b[33m[backend]\x1b[0m ${m}\n`);
const error = (m: string) => process.stderr.write(`\x1b[31m[backend]\x1b[0m ${m}\n`);

// ── Check if a TCP port is accepting connections ──────────────
function isPortOpen(port: number, host = "127.0.0.1", timeout = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v: boolean) => { try { sock.destroy(); } catch { /* ok */ } resolve(v); };
    sock.setTimeout(timeout);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error",   () => done(false));
    try { sock.connect(port, host); } catch { done(false); }
  });
}

// ── Wait until the port is open (backend ready) ───────────────
async function waitForPort(port: number, retries = 30, interval = 1000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

// ── Kill existing backend process ─────────────────────────────
async function killBackend(): Promise<void> {
  if (!backendProcess) return;
  const pid = backendProcess.pid;
  backendProcess.removeAllListeners();
  backendProcess = null;

  if (!pid) return;

  await new Promise<void>((resolve) => {
    if (process.platform === "win32") {
      const k = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
      k.once("exit",  () => setTimeout(resolve, 400));
      k.once("error", () => setTimeout(resolve, 400));
      setTimeout(resolve, 2500);
    } else {
      try { process.kill(pid, "SIGTERM"); } catch { /* ok */ }
      setTimeout(resolve, 800);
    }
  });
}

// ── Spawn the backend ─────────────────────────────────────────
async function startBackend(): Promise<void> {
  // Already up?
  if (backendProcess && !backendProcess.killed) return;
  if (await isPortOpen(BACKEND_PORT)) {
    log(`port ${BACKEND_PORT} already open — backend is running`);
    return;
  }

  const serverDir = join(process.cwd(), "server");
  if (!existsSync(join(serverDir, "package.json"))) {
    error(`server/package.json not found in ${serverDir}`);
    return;
  }

  log(`spawning → ${serverDir}\\src\\index.ts`);

  const isWin = process.platform === "win32";

  backendProcess = spawn(
    isWin ? "cmd.exe" : "npx",
    isWin ? ["/c", "npx", "tsx", "src/index.ts"] : ["tsx", "src/index.ts"],
    {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV:     "development",
        PORT:         String(BACKEND_PORT),
        HOST:         "0.0.0.0",
        FORCE_COLOR:  "0",
      },
      detached:    false,
      windowsHide: true,
    }
  );

  backendProcess.stdout?.on("data", (d: Buffer) => {
    d.toString().split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) =>
      process.stdout.write(`\x1b[36m[backend]\x1b[0m ${l}\n`)
    );
  });

  backendProcess.stderr?.on("data", (d: Buffer) => {
    d.toString().split("\n").map((l) => l.trim()).filter(Boolean)
      .filter((l) => !l.includes("ExperimentalWarning"))
      .forEach((l) => process.stderr.write(`\x1b[31m[backend]\x1b[0m ${l}\n`));
  });

  backendProcess.once("spawn", () => log(`spawned PID ${backendProcess?.pid}`));

  backendProcess.once("error", (err) => {
    error(`spawn error: ${err.message}`);
    backendProcess = null;
  });

  backendProcess.once("exit", async (code, signal) => {
    const reason = signal ?? `code ${code}`;
    log(`exited (${reason})`);
    backendProcess = null;

    // Auto-restart on non-SIGTERM unexpected exits
    if (signal !== "SIGTERM" && signal !== "SIGINT" && code !== 0 && restartCount < MAX_RESTARTS) {
      restartCount++;
      warn(`restarting in 3s… (${restartCount}/${MAX_RESTARTS})`);
      await new Promise((r) => setTimeout(r, 3000));
      await startBackend();
    }
  });

  // Wait for it to be ready
  log(`waiting for port ${BACKEND_PORT}…`);
  const ready = await waitForPort(BACKEND_PORT, 40, 1000);
  if (ready) {
    log(`\x1b[32mbackend ready on http://localhost:${BACKEND_PORT}\x1b[0m`);
    restartCount = 0;
  } else {
    warn(`backend did not become ready on port ${BACKEND_PORT} within 40s`);
    warn("check the [backend] output above for errors");
  }
}

// ── Vite Plugin export ─────────────────────────────────────────
export function backendPlugin(): Plugin {
  return {
    name: "vite-plugin-backend",

    // configureServer fires when the Vite dev server starts.
    // This is the correct hook — buildStart only fires during builds.
    async configureServer(server) {
      log("Vite dev server starting — launching backend…");
      await startBackend();

      // Kill backend when Vite dev server closes
      server.httpServer?.once("close", async () => {
        log("Vite dev server closed — shutting down backend…");
        await killBackend();
      });
    },

    // Also handle the build path (for completeness)
    async buildStart() {
      if (!backendProcess) {
        await startBackend();
      }
    },

    async closeBundle() {
      await killBackend();
    },
  };
}
