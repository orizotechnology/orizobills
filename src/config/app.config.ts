// =============================================================
// APPLICATION CONFIGURATION
// All values sourced from environment variables via import.meta.env
// =============================================================

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME ?? "Orizo Bills",
  version: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
  env: import.meta.env.VITE_APP_ENV ?? "development",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000",
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT ?? 30000),
  enableDevTools: import.meta.env.VITE_ENABLE_DEV_TOOLS === "true",
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

export type AppConfig = typeof APP_CONFIG;
