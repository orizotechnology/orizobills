// =============================================================
// vite-plugin-backend
//
// Spawns the Fastify backend alongside Vite dev server.
// Checks if port 5000 is already in use before spawning — safe
// to include in all modes (Tauri dev, browser dev, etc.)
// =============================================================

import type { Plugin }      from "vite";
import { spawn, type ChildProcess } from "child_process";
import * as path  from "path";
import * as fs    from "fs";
import * as net   from "net";

const BACKEND_PORT  = 5000;
const MAX_RESTARTS  = 3;
const RESTART_DELAY = 2000;

interface BackendPluginOptions {
  serverDir?: string;
  entry?: string;
  env?: Record<string, string>;
}

export function backendPlugin(options: BackendPluginOptions = {}): Plugin {
  let child: ChildProcess | null = null;
  let restarts = 0;
  let stopping = false;
  let ownedByPlugin = false;

  const getServerDir = (root: string) =>
    options.serverDir ?? path.resolve(root, "server");

  // ── Port probe — single attempt ───────────────────────────
  function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const s = net.createConnection({ port, host: "127.0.0.1" });
      s.setTimeout(500);
      s.on("connect", () => { s.destroy(); resolve(true);  });
      s.on("error",   () => { s.destroy(); resolve(false); });
      s.on("timeout", () => { s.destroy(); resolve(false); });
    });
  }

  // ── Spawn using node + tsx cli — no .cmd, no shell:true ───
  function startBackend(serverDir: string, entry: string, env: NodeJS.ProcessEnv) {
    if (stopping) return;
    ownedByPlugin = true;

    const tsxCli =
      [
        path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs"),
        path.join(serverDir, "node_modules", "tsx", "dist", "cli.js"),
      ].find(fs.existsSync);

    if (!tsxCli) {
      process.stderr.write(
        `\x1b[31m[backend]\x1b[0m tsx not found — run: cd server && npm install\n`
      );
      return;
    }

    child = spawn(process.execPath, [tsxCli, entry], {
      cwd:   serverDir,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (d: Buffer) =>
      d.toString().trimEnd().split("\n")
        .forEach((l) => process.stdout.write(`\x1b[36m[backend]\x1b[0m ${l}\n`))
    );
    child.stderr?.on("data", (d: Buffer) =>
      d.toString().trimEnd().split("\n")
        .forEach((l) => process.stderr.write(`\x1b[33m[backend]\x1b[0m ${l}\n`))
    );

    child.on("close", (code) => {
      child = null;
      if (stopping) return;
      if (code === 0) {
        // Clean exit = port conflict — another instance is already running
        process.stdout.write(`\x1b[36m[backend]\x1b[0m already running on :${BACKEND_PORT}\n`);
        return;
      }
      if (restarts < MAX_RESTARTS) {
        restarts++;
        process.stdout.write(
          `\x1b[33m[backend]\x1b[0m crashed (${code}), retry ${restarts}/${MAX_RESTARTS} in ${RESTART_DELAY}ms\n`
        );
        setTimeout(() => startBackend(serverDir, entry, env), RESTART_DELAY);
      } else {
        process.stderr.write(`\x1b[31m[backend]\x1b[0m gave up after ${MAX_RESTARTS} crashes\n`);
      }
    });

    child.on("error", (err) =>
      process.stderr.write(`\x1b[31m[backend]\x1b[0m spawn error: ${err.message}\n`)
    );
  }

  function stopBackend() {
    if (!ownedByPlugin || !child || child.killed) return;
    stopping = true;
    process.stdout.write("\x1b[36m[backend]\x1b[0m stopping…\n");
    child.kill("SIGTERM");
    setTimeout(() => { if (child && !child.killed) child.kill("SIGKILL"); }, 4000);
  }

  return {
    name:  "vite-plugin-backend",
    apply: "serve",

    async configureServer(server) {
      const root      = server.config.root;
      const serverDir = getServerDir(root);
      const entry     = options.entry ?? "src/index.ts";

      if (!fs.existsSync(serverDir)) {
        process.stderr.write(`\x1b[31m[backend]\x1b[0m server/ not found: ${serverDir}\n`);
        return;
      }

      // Check if backend already running (e.g. started by launch.ps1)
      const alreadyUp = await isPortInUse(BACKEND_PORT);
      if (alreadyUp) {
        process.stdout.write(
          `\x1b[36m[backend]\x1b[0m :${BACKEND_PORT} already occupied — skipping spawn\n`
        );
        return;
      }

      // Build env block from server/.env + process.env
      const fileEnv    = parseEnvFile(path.join(serverDir, ".env"));
      const backendEnv: NodeJS.ProcessEnv = {
        ...process.env,
        ...fileEnv,
        PORT:        String(BACKEND_PORT),
        NODE_ENV:    "development",
        FORCE_COLOR: "1",
        ...options.env,
      };

      process.stdout.write(
        `\x1b[36m[backend]\x1b[0m starting → ${path.join(serverDir, entry)}\n`
      );
      startBackend(serverDir, entry, backendEnv);

      server.httpServer?.on("close", stopBackend);
      process.once("SIGINT",  stopBackend);
      process.once("SIGTERM", stopBackend);
      process.once("exit",    stopBackend);
    },

    buildEnd() { stopBackend(); },
  };
}

// ── Parse server/.env file ────────────────────────────────────
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t  = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let   val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}
