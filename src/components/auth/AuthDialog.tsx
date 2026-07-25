import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Phone, Lock, User, LogIn, UserPlus, X } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

// =============================================================
// AUTH DIALOG
// First time  → Registration (Name + Mobile + Password)
// Returning   → Login ("Welcome back, [Name]!")
// No backdrop here — AuthGuard provides the background
// =============================================================

export function AuthDialog() {
  const { user, lastSeenName, register, login, isRegistered } = useAuthStore();
  const isFirstTime = !isRegistered();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(() =>
    !isFirstTime && user?.mobile ? user.mobile : ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isFirstTime) {
      if (!name.trim()) { setError("Please enter your full name."); return; }
      if (name.trim().length < 2) { setError("Name must be at least 2 characters."); return; }
    }
    if (!mobile.trim()) { setError("Please enter your mobile number."); return; }
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\s/g, ""))) {
      setError("Enter a valid 10-digit Indian mobile number."); return;
    }
    if (!password) { setError("Please enter your password."); return; }
    if (isFirstTime && password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }

    setLoading(true);
    try {
      if (isFirstTime) {
        await register(name.trim(), mobile.replace(/\s/g, ""), password);
      } else {
        const ok = await login(mobile.replace(/\s/g, ""), password);
        if (!ok) {
          setError("Incorrect mobile number or password.");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        background: "#fff",
        borderRadius: 20,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Close button ───────────────────────────────────── */}
      <button
        onClick={async () => {
          try {
            // Tauri v2 — properly close the window (exits the app)
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().close();
          } catch {
            // Browser fallback — nothing to close
          }
        }}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.25)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          zIndex: 10,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.4)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
        aria-label="Close"
        title="Close"
      >
        <X size={14} strokeWidth={2.5} />
      </button>

      {/* ── Orange header ───────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          padding: "28px 32px 24px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <img
              src="/logo.png"
              alt="Orizo Bills"
              style={{ width: 40, height: 40, objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>
            Orizo Bills
          </span>
        </div>

        {isFirstTime ? (
          <>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Welcome! 👋
            </div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
              Set up your account to get started
            </div>
          </>
        ) : (
          <>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              Welcome back{lastSeenName ? `, ${lastSeenName.split(" ")[0]}` : ""}! 👋
            </div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
              Sign in to continue to your dashboard
            </div>
          </>
        )}
      </div>

      {/* ── Form ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={{ padding: "28px 32px 32px" }}>

        {/* Name — first time only */}
        <AnimatePresence initial={false}>
          {isFirstTime && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 16, overflow: "hidden" }}
            >
              <label style={labelStyle}>Full Name</label>
              <div style={inputWrapStyle}>
                <User size={15} color="#94A3B8" style={{ flexShrink: 0, marginLeft: 12, marginRight: 4 }} />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mobile Number</label>
          <div style={inputWrapStyle}>
            <Phone size={15} color="#94A3B8" style={{ flexShrink: 0, marginLeft: 12, marginRight: 4 }} />
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              maxLength={10}
              style={inputStyle}
              autoFocus={!isFirstTime}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ ...inputWrapStyle, position: "relative" }}>
            <Lock size={15} color="#94A3B8" style={{ flexShrink: 0, marginLeft: 12, marginRight: 4 }} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={isFirstTime ? "Create a password (min. 6 chars)" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "#94A3B8", display: "flex", padding: 2,
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                background: "#FFF1F2", border: "1px solid #FECDD3",
                borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                fontSize: 13, color: "#E11D48",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "#FDA35C" : "#F97316",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "13px 0", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.15s", fontFamily: "inherit",
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#fff", borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }} />
              {isFirstTime ? "Creating account..." : "Signing in..."}
            </>
          ) : (
            <>
              {isFirstTime ? <UserPlus size={17} /> : <LogIn size={17} />}
              {isFirstTime ? "Create Account & Get Started" : "Sign In"}
            </>
          )}
        </button>

        {/* Security note */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#CBD5E1", marginTop: 14 }}>
          🔒 Your password is encrypted and stored securely on this device
        </p>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 6,
};

const inputWrapStyle: React.CSSProperties = {
  display: "flex", alignItems: "center",
  border: "1.5px solid #E2E8F0", borderRadius: 10,
  background: "#F8FAFC", transition: "border-color 0.15s",
};

const inputStyle: React.CSSProperties = {
  flex: 1, border: "none", background: "transparent",
  padding: "11px 12px", fontSize: 14, color: "#1E293B",
  outline: "none", fontFamily: "inherit", width: "100%",
};
