import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { AuthDialog } from "./AuthDialog";

// =============================================================
// AUTH GUARD
//
// - Not authenticated → transparent background, centered dialog
// - Authenticated     → #F8FAFC background, full app renders
//
// The custom TitleBar (in AppLayout) handles minimize/maximize/close.
// No OS decorations are used (decorations: false in tauri.conf.json).
// =============================================================

interface AuthGuardProps { children: React.ReactNode; }

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isAuthenticated) {
      html.style.background = "#F8FAFC";
      body.style.background = "#F8FAFC";
    } else {
      html.style.background = "transparent";
      body.style.background = "transparent";
    }
  }, [isAuthenticated]);

  return (
    <>
      {/* Full app — only when authenticated */}
      <AnimatePresence>
        {isAuthenticated && (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ width: "100%", height: "100%" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login / register dialog — transparent overlay */}
      <AnimatePresence>
        {!isAuthenticated && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", inset: 0,
              background: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999,
            }}
          >
            {/* Invisible drag strip at top so the window is still movable */}
            <div
              data-tauri-drag-region
              style={{
                position: "fixed", top: 0, left: 0, right: 0,
                height: 28,
                zIndex: 10001,
                cursor: "default",
              }}
            />
            <AuthDialog />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
