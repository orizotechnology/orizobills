import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { AuthDialog } from "./AuthDialog";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore();

  // Toggle transparent background on html/body when showing auth dialog
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (!isAuthenticated) {
      // Transparent — lets Tauri window background show through
      html.style.background = "transparent";
      body.style.background = "transparent";
    } else {
      // Restore app background (#F8FAFC = hsl(210 40% 98%))
      html.style.background = "#F8FAFC";
      body.style.background = "#F8FAFC";
    }
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

      {/* Auth dialog — no background, just the floating card */}
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
              background: "transparent", // fully transparent — no color
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
