import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { backendPlugin } from "./vite-plugin-backend";

// =============================================================
// Vite config — Tauri desktop app
// The Vite dev server is only used by Tauri's WebView (localhost:3000).
// No browser proxy needed: all API calls go directly to
// http://localhost:5000 from within the WebView.
// =============================================================

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Auto-starts the Fastify backend when Tauri dev starts,
    // shuts it down when Vite exits.
    backendPlugin(),
  ],

  resolve: {
    alias: {
      "@":          path.resolve(__dirname, "./src"),
      "@app":       path.resolve(__dirname, "./src/app"),
      "@assets":    path.resolve(__dirname, "./src/assets"),
      "@components":path.resolve(__dirname, "./src/components"),
      "@layouts":   path.resolve(__dirname, "./src/layouts"),
      "@hooks":     path.resolve(__dirname, "./src/hooks"),
      "@providers": path.resolve(__dirname, "./src/providers"),
      "@routes":    path.resolve(__dirname, "./src/routes"),
      "@services":  path.resolve(__dirname, "./src/services"),
      "@store":     path.resolve(__dirname, "./src/store"),
      "@styles":    path.resolve(__dirname, "./src/styles"),
      "@themes":    path.resolve(__dirname, "./src/themes"),
      "@types":     path.resolve(__dirname, "./src/types"),
      "@utils":     path.resolve(__dirname, "./src/utils"),
      "@config":    path.resolve(__dirname, "./src/config"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@lib":       path.resolve(__dirname, "./src/lib"),
    },
  },

  clearScreen: false,

  server: {
    port: 3000,
    strictPort: true,
    host: "localhost",
    watch: { ignored: ["**/src-tauri/**"] },
  },

  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router-dom") || id.includes("react/") || id.includes("react-dom"))
              return "react-vendor";
            if (id.includes("@tanstack/react-query")) return "query-vendor";
            if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("sonner"))
              return "ui-vendor";
            if (id.includes("react-hook-form") || id.includes("zod")) return "form-vendor";
            if (id.includes("zustand")) return "state-vendor";
            if (id.includes("@tanstack/react-table")) return "table-vendor";
            if (id.includes("echarts")) return "chart-vendor";
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      "react", "react-dom", "react-router-dom",
      "@tanstack/react-query", "zustand", "framer-motion",
      "lucide-react", "zod", "react-hook-form",
    ],
    exclude: ["@tauri-apps/api"],
  },
});
