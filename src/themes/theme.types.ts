// =============================================================
// THEME TYPES
// =============================================================

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  sidebarBg: string;
  background: string;
  card: string;
  text: string;
  border: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}
