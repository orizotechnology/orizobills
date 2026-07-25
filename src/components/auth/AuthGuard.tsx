import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { AuthDialog } from "./AuthDialog";
import { expandToAppWindow, shrinkToDialogWindow } from "@/hooks/useWindowManager";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore();
  const prevAuth = useRef<boolean | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isAuthenticated) {
      // ── Expand to full app window ─────────────────────────
      html.style.background = "#F8FAFC";
      body.style.background = "#F8FAFC";

      // Only expand if transitioning from unauthenticated
      // (avoid re-expanding on every re-render)
      if (prevAuth.current === false || prevAuth.current === null) {
        expandToAppWindow().catch(() => {});
      }
    } else {
      // ── Shrink back to dialog window ──────────────────────
      html.style.background = "transparent";
      body.style.background = "transparent";

      // Only shrink if transitioning from authenticated (logout)
      if (prevAuth.current === true) {
        shrinkToDialogWindow().catch(() => {});
      }
    }

    prevAuth.current = isAuthenticated;
  }, [isAuthenticated]);

  return (
    <>
      {/* Full app — only rendered when authenticated */}
      <AnimatePresence>
        {isAuthenticated && (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ width: "100%", height: "100%" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth dialog — transparent overlay, just the floating card */}
      <AnimatePresence>
        {!isAuthenticated && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <AuthDialog />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
