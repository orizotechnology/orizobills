import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { serverConfig } from "./config/server.config";
import { globalErrorHandler } from "./utils/error.util";
import branchPlugin      from "./plugins/branch.plugin";
import { branchRoutes }    from "./routes/branch.routes";
import { productRoutes }   from "./routes/product.routes";
import { customerRoutes }  from "./routes/customer.routes";
import { supplierRoutes }  from "./routes/supplier.routes";
import { purchaseRoutes }  from "./routes/purchase.routes";
import { saleRoutes }      from "./routes/sale.routes";
import { paymentRoutes }   from "./routes/payment.routes";
import { expenseRoutes }   from "./routes/expense.routes";
import { inventoryRoutes } from "./routes/inventory.routes";
import { importRoutes }    from "./routes/import.routes";
import { configRoutes }    from "./routes/config.routes";
import { transferRoutes }  from "./routes/transfer.routes";

// =============================================================
// FASTIFY APPLICATION FACTORY
// =============================================================

export async function buildServer() {
  const server = Fastify({
    logger: serverConfig.logger,
  });

  // ── Security ─────────────────────────────────────────────
  await server.register(helmet, { contentSecurityPolicy: false });

  // Allowed origins:
  //   tauri://localhost        → Tauri v2 Windows WebView2
  //   https://tauri.localhost  → Tauri v2 macOS/Linux
  //   http://localhost:3000    → Vite dev server (browser)
  //   http://localhost:5000    → self (health checks)
  //   no origin                → curl, Postman, internal calls
  await server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) { cb(null, true); return; } // no-origin always allowed
      // Tauri origins
      if (origin === "tauri://localhost" || origin === "https://tauri.localhost") {
        cb(null, true); return;
      }
      // Allow any localhost or 127.0.0.1 origin in all environments
      // (covers Vite dev on :3000, :3001, etc.)
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
        cb(null, true); return;
      }
      // Allow configured CORS origins from .env
      if (serverConfig.corsOrigin.includes(origin)) {
        cb(null, true); return;
      }
      cb(new Error(`CORS: origin not allowed: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Branch-Id"],
  });

  // ── Global error handler ──────────────────────────────────
  server.setErrorHandler(globalErrorHandler);

  // ── Branch context (reads X-Branch-Id header) ─────────────
  await server.register(branchPlugin);

  // ── Health check ─────────────────────────────────────────
  // Mounted at both /health (direct) and /api/health (via proxy)
  const healthHandler = async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
  });
  server.get("/health",      healthHandler);
  server.get("/api/health",  healthHandler);

  server.get("/", async () => ({ name: "Orizo Bills API", version: "1.0.0" }));

  // ── Feature routes ────────────────────────────────────────
  await server.register(configRoutes,    { prefix: "/api/config"    });
  await server.register(branchRoutes,    { prefix: "/api/branches"  });
  await server.register(productRoutes,   { prefix: "/api/products"   });
  await server.register(customerRoutes,  { prefix: "/api/customers"  });
  await server.register(supplierRoutes,  { prefix: "/api/suppliers"  });
  await server.register(purchaseRoutes,  { prefix: "/api/purchases"  });
  await server.register(saleRoutes,      { prefix: "/api/sales"      });
  await server.register(paymentRoutes,   { prefix: "/api/payments"   });
  await server.register(expenseRoutes,   { prefix: "/api/expenses"   });
  await server.register(inventoryRoutes, { prefix: "/api/inventory"  });
  await server.register(importRoutes,    { prefix: "/api/import"     });
  await server.register(transferRoutes,  { prefix: "/api/transfers"   });

  return server;
}
