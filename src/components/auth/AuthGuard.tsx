import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { AuthDialog } from "./AuthDialog";

// =============================================================
// AUTH GUARD
//
// Waits for zustand to rehydrate from localStorage (_hasHydrated)
// before deciding what to show — prevents the login dialog from
// flashing on returning users whose isAuthenticated is persisted.
//
// - Not hydrated yet → null (invisible, no flash)
// - Hydrated + authenticated → full app
// - Hydrated + not authenticated → login dialog
// =============================================================

interface AuthGuardProps { children: React.ReactNode; }

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  // Set background based on auth state
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isAuthenticated) {
      html.style.background = "#F8FAFC";
      html.style.background = "#F8FAFC";
      body.style.background = "#F8FAFC";
    } else {
      html.style.background = "#F8FAFC";
      body.style.background = "#F8FAFC";
    }
  }, [isAuthenticated]);

  // Don't render anything until localStorage has been read.
  // This prevents the 1-frame flash of the login dialog on
  // users who are already authenticated.
  if (!_hasHydrated) return null;

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
              background: "#F8FAFC",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999,
            }}
          >
            {/* Drag strip removed — window is always maximized */}
            <AuthDialog />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
