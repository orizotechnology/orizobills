import { Toaster } from "sonner";
import { useTheme } from "./ThemeProvider";

// =============================================================
// TOAST PROVIDER
// Uses Sonner for production-grade toast notifications.
// Integrates with the theme system for light/dark mode support.
// =============================================================

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
        },
        classNames: {
          toast: "shadow-lg",
          success: "border-l-4 border-green-500",
          error: "border-l-4 border-red-500",
          warning: "border-l-4 border-yellow-500",
          info: "border-l-4 border-blue-500",
        },
      }}
    />
  );
}
