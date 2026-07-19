/// <reference types="vite/client" />

// =============================================================
// ENVIRONMENT VARIABLE TYPE DECLARATIONS
// Augments Vite's ImportMeta interface with typed env vars
// =============================================================

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENV: "development" | "staging" | "production";
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_ENABLE_DEV_TOOLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
