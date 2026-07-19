// =============================================================
// THEME CONFIGURATION
// Centralised design tokens - matches CSS variables in themes.css
// =============================================================

import type { ThemeColors } from "./theme.types";

export const LIGHT_THEME_COLORS: ThemeColors = {
  primary: "#F97316",
  primaryHover: "#EA580C",
  sidebarBg: "#0F172A",
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#111827",
  border: "#E2E8F0",
} as const;

export const DARK_THEME_COLORS: ThemeColors = {
  primary: "#F97316",
  primaryHover: "#EA580C",
  sidebarBg: "#080E1C",
  background: "#0F172A",
  card: "#1E293B",
  text: "#F1F5F9",
  border: "#1E293B",
} as const;

export const DEFAULT_THEME_MODE = "system" as const;

export const THEME_STORAGE_KEY = "erp-theme-mode" as const;
