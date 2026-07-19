// =============================================================
// APPLICATION CONSTANTS
// =============================================================

export const APP_NAME = "Orizo Bills" as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth-token",
  REFRESH_TOKEN: "refresh-token",
  USER: "auth-user",
  THEME: "erp-theme-mode",
  SIDEBAR_STATE: "sidebar-state",
} as const;

export const API_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    ME: "/auth/me",
  },
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

export const DATE_FORMATS = {
  DISPLAY: "DD/MM/YYYY",
  DISPLAY_WITH_TIME: "DD/MM/YYYY HH:mm",
  API: "YYYY-MM-DD",
  TIMESTAMP: "YYYY-MM-DDTHH:mm:ss.SSSZ",
} as const;

export const QUERY_KEYS = {
  AUTH: ["auth"] as const,
  USERS: ["users"] as const,
} as const;
