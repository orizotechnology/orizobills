import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// =============================================================
// DB PASSWORD GATE
//
// Shows BEFORE the login dialog on first launch (or whenever
// the MySQL password has not been stored yet).
//
// Flow:
//   1. GET /api/config/exists → if exists, render children directly
//   2. If not configured, show password dialog (same card style
//      as AuthDialog, transparent overlay)
//   3. POST /api/config/setup → backend validates creds, stores
//      password in OS keychain via keytar
//   4. On success → render children (login dialog shows next)
//
// The password NEVER touches localStorage or any browser store.
// =============================================================

interface Props { children: React.ReactNode; }

type Step = "checking" | "needed" | "saving" | "done" | "skip";

interface SetupForm {
  host:     string;
  port:     string;
  user:     string;
  password: string;
  database: string;
}

export function DbPasswordGate({ children }: Props) {
  const [step,     setStep]     = useState<Step>("checking");
  const [form,     setForm]     = useState<SetupForm>({
    host: "localhost", port: "3306", user: "root", password: "", database: "erp_system",
  });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState(false);

  const setField = (k: keyof SetupForm, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  // Keep html/body transparent while this gate is active
  useEffect(() => {
    if (step === "skip") return;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, [step]);

  // On mount: check if DB is already configured
  useEffect(() => {
    fetch("http://localhost:5000/api/config/exists", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { data?: { exists: boolean }; exists?: boolean }) => {
        const exists = d?.data?.exists ?? (d as { exists?: boolean }).exists ?? false;
        setStep(exists ? "skip" : "needed");
      })
      .catch(() => setStep("skip")); // endpoint missing → skip gate
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("saving");

    try {
      const res = await fetch("http://localhost:5000/api/config/setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host:     form.host.trim()     || "localhost",
          port:     Number(form.port)    || 3306,
          user:     form.user.trim()     || "root",
          password: form.password,
          database: form.database.trim() || "erp_system",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg: string = json?.error?.message ?? json?.message ?? "";
        setError(msg || `Setup failed (HTTP ${res.status})`);
        setStep("needed");
        return;
      }

      setStep("done");
      setTimeout(() => setStep("skip"), 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Cannot reach the backend. Make sure the app is running."
          : msg
      );
      setStep("needed");
    }
  };

  // Still checking or already configured/done → render app
  if (step === "checking" || step === "skip") return <>{children}</>;

  // Close app handler
  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch { /* browser */ }
  };

  return (
    <>
      {/* App pre-rendered but hidden so it loads instantly after setup */}
      <div style={{ visibility: "hidden", pointerEvents: "none", position: "absolute", inset: 0 }}>
        {children}
      </div>

      {/* Invisible drag strip removed — window is always maximized, no dragging needed */}

      {/* Transparent overlay — same pattern as AuthGuard */}
      <AnimatePresence>
        <motion.div
          key="db-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed", inset: 0,
            background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.94,  y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              background: "#fff",
              borderRadius: 20,
              width: "100%", maxWidth: 420,
              boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Orange header — identical to AuthDialog */}
            <div style={{
              background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
              padding: "28px 32px 24px", textAlign: "center",
              position: "relative",
            }}>
              {/* Close button — closes the app */}
              <button
                onClick={handleClose}
                style={{
                  position: "absolute", top: 14, right: 14,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "#fff", zIndex: 10,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src="/logo.png" alt="Orizo Bills" style={{ width: 40, height: 40, objectFit: "contain" }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>Orizo Bills</span>
              </div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Database Setup 🗄️</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
                Enter your MySQL password to get started
              </div>
            </div>

            {/* Body */}
            {step === "done" ? (
              <div style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <CheckCircle2 size={44} color="#22C55E" />
                <div style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>Connected!</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>Opening application…</div>
              </div>
            ) : step === "saving" ? (
              <div style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <Loader2 size={36} color="#F97316" style={{ animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontSize: 14, color: "#64748B" }}>Connecting to MySQL and setting up database…</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "24px 32px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Password — primary field */}
                <div>
                  <label style={lbl}>MySQL Password</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC" }}>
                    <Database size={15} color="#94A3B8" style={{ flexShrink: 0, marginLeft: 12 }} />
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={e => setField("password", e.target.value)}
                      placeholder="Enter MySQL password"
                      autoFocus
                      autoComplete="new-password"
                      style={{ ...inp, paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 4 }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Advanced toggle */}
                <button type="button" onClick={() => setExpanded(p => !p)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 12, fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", padding: 0 }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{expanded ? "▾" : "▸"}</span>
                  {expanded ? "Hide advanced settings" : "Advanced settings (host, port, user, database)"}
                </button>

                {/* Advanced fields */}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={lbl}>Host</label>
                          <input value={form.host} onChange={e => setField("host", e.target.value)} placeholder="localhost" style={advInp} />
                        </div>
                        <div>
                          <label style={lbl}>Port</label>
                          <input type="number" value={form.port} onChange={e => setField("port", e.target.value)} placeholder="3306" style={advInp} />
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Username</label>
                        <input value={form.user} onChange={e => setField("user", e.target.value)} placeholder="root" style={advInp} />
                      </div>
                      <div>
                        <label style={lbl}>Database Name</label>
                        <input value={form.database} onChange={e => setField("database", e.target.value)} placeholder="erp_system" style={advInp} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "10px 14px" }}>
                      <AlertCircle size={15} color="#E11D48" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 13, color: "#E11D48", lineHeight: 1.5 }}>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button type="submit"
                  style={{ width: "100%", background: "#F97316", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", marginTop: 4 }}>
                  <Database size={16} /> Connect to MySQL
                </button>

                <p style={{ textAlign: "center", fontSize: 11, color: "#CBD5E1", margin: 0 }}>
                  🔒 Password stored in OS keychain — never in plain text
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const lbl:    React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const inp:    React.CSSProperties = { flex: 1, border: "none", background: "transparent", padding: "11px 12px", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "inherit", width: "100%" };
const advInp: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC", padding: "9px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
