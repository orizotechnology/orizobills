import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Phone, Lock, User, LogIn, UserPlus, X, Briefcase, ShieldCheck, UserCog } from "lucide-react";
import { useAuthStore, BUSINESS_TYPES, type UserRole } from "@/store/auth.store";

// =============================================================
// AUTH DIALOG — Role-based Registration & Login
//
// FIRST RUN  (no admin registered):
//   → Admin registration: Name, Mobile, Password,
//     Role (admin — locked), Business Type selector
//
// RETURNING  (admin registered):
//   → Role tab: Admin | Officer
//   → Admin tab: Mobile + Password
//     (blocked if admin already active on device)
//   → Officer tab: Mobile + Password
//     (any active officer can log in)
//
// Existing flow preserved:
//   - Same floating card design, same orange header
//   - Same X button (closes app)
//   - No architecture changes
// =============================================================

export function AuthDialog() {
  const {
    admin, session, officers,
    registerAdmin, login, isAdminRegistered,
  } = useAuthStore();

  const isFirstTime = !isAdminRegistered();
  const adminActive = session?.role === "admin";
  const hasOfficers = officers.filter((o) => o.isActive).length > 0;

  // Login role tab — default to officer if admin already active
  const [roleTab, setRoleTab] = useState<UserRole>(adminActive ? "officer" : "admin");

  // Registration fields
  const [regName,     setRegName]     = useState("");
  const [regMobile,   setRegMobile]   = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBizType,  setRegBizType]  = useState<string>(BUSINESS_TYPES[0]);
  const [showRegPass, setShowRegPass] = useState(false);

  // Login fields
  const [loginMobile,   setLoginMobile]   = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Registration submit ───────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName.trim() || regName.trim().length < 2) { setError("Please enter your full name (min 2 chars)."); return; }
    if (!regMobile.trim() || !/^[6-9]\d{9}$/.test(regMobile.replace(/\s/g, ""))) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (!regPassword || regPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!regBizType) { setError("Please select a business type."); return; }
    setLoading(true);
    try {
      await registerAdmin(regName.trim(), regMobile.replace(/\s/g, ""), regPassword, regBizType);
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Login submit ──────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginMobile.trim()) { setError("Please enter your mobile number."); return; }
    if (!loginPassword)      { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      const result = await login(loginMobile.replace(/\s/g, ""), loginPassword, roleTab);
      if (!result.ok) setError(result.error ?? "Incorrect credentials.");
    } catch {
      setError("Login failed. Please try again.");
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
        background: "#fff", borderRadius: 20, width: "100%",
        maxWidth: 440,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden", position: "relative",
      }}
    >
      {/* ── Close button ─────────────────────────────────── */}
      <button
        onClick={async () => {
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            await getCurrentWindow().close();
          } catch { /* browser */ }
        }}
        style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", zIndex: 10, transition: "background 0.15s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.4)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)"; }}
        aria-label="Close" title="Close"
      >
        <X size={14} strokeWidth={2.5} />
      </button>

      {/* ── Orange header ────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", padding: "24px 32px 20px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="Orizo Bills" style={{ width: 38, height: 38, objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>Orizo Bills</span>
        </div>
        {isFirstTime ? (
          <>
            <div style={{ color: "#fff", fontSize: 19, fontWeight: 700, marginBottom: 3 }}>Welcome! 👋</div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>Set up your admin account to get started</div>
          </>
        ) : (
          <>
            <div style={{ color: "#fff", fontSize: 19, fontWeight: 700, marginBottom: 3 }}>
              {adminActive ? `Welcome back!` : `Sign in to continue`}
            </div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              {adminActive ? "Admin is active — officer login only" : "Choose your role to sign in"}
            </div>
          </>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      {isFirstTime ? (
        // ── REGISTRATION FORM ────────────────────────────
        <form onSubmit={handleRegister} style={{ padding: "22px 28px 28px", display: "flex", flexDirection: "column", gap: 13 }}>

          {/* Role badge — locked to Admin on first run */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(249,115,22,0.08)", border: "1.5px solid rgba(249,115,22,0.25)", borderRadius: 8, padding: "8px 12px" }}>
            <ShieldCheck size={15} color="#F97316" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>Admin Account</span>
            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>Business Owner</span>
          </div>

          {/* Name */}
          <Field label="Full Name" icon={<User size={14} color="#94A3B8" />}>
            <input type="text" placeholder="Your full name" value={regName} onChange={e => setRegName(e.target.value)} style={inp} autoFocus />
          </Field>

          {/* Mobile */}
          <Field label="Mobile Number" icon={<Phone size={14} color="#94A3B8" />}>
            <input type="tel" placeholder="10-digit mobile number" value={regMobile} onChange={e => setRegMobile(e.target.value)} maxLength={10} style={inp} />
          </Field>

          {/* Password */}
          <Field label="Password" icon={<Lock size={14} color="#94A3B8" />}>
            <input type={showRegPass ? "text" : "password"} placeholder="Min 6 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} style={{ ...inp, paddingRight: 36 }} />
            <button type="button" onClick={() => setShowRegPass(p => !p)} style={eyeBtn}>
              {showRegPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </Field>

          {/* Business Type */}
          <div>
            <label style={lbl}><Briefcase size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />Business Type</label>
            <select value={regBizType} onChange={e => setRegBizType(e.target.value)} style={{ ...inp, border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC", padding: "10px 12px", cursor: "pointer" }}>
              {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>

          <ErrorBanner msg={error} />

          <SubmitBtn loading={loading} label={loading ? "Creating account…" : "Create Admin Account"} icon={<UserPlus size={16} />} />

          <p style={{ textAlign: "center", fontSize: 11, color: "#CBD5E1", margin: 0 }}>
            🔒 Your password is encrypted and stored securely on this device
          </p>
        </form>
      ) : (
        // ── LOGIN FORM ───────────────────────────────────
        <div style={{ padding: "18px 28px 26px" }}>

          {/* Role tabs */}
          <div style={{ display: "flex", background: "#F8FAFC", borderRadius: 10, padding: 3, marginBottom: 18, border: "1.5px solid #E2E8F0" }}>
            {(["admin", "officer"] as UserRole[]).map(r => {
              const isDisabled = r === "admin" && adminActive;
              const isActive   = roleTab === r;
              return (
                <button key={r} type="button"
                  disabled={isDisabled}
                  onClick={() => { if (!isDisabled) { setRoleTab(r); setError(""); setLoginMobile(""); setLoginPassword(""); } }}
                  style={{
                    flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                    background: isActive ? "#fff" : "transparent",
                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    color: isDisabled ? "#CBD5E1" : isActive ? "#F97316" : "#64748B",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  {r === "admin" ? <ShieldCheck size={14} /> : <UserCog size={14} />}
                  {r === "admin" ? "Admin" : "Officer"}
                  {isDisabled && <span style={{ fontSize: 10, background: "#FEE2E2", color: "#EF4444", borderRadius: 4, padding: "1px 5px" }}>Active</span>}
                </button>
              );
            })}
          </div>

          {/* Show officer note if no officers exist yet */}
          {roleTab === "officer" && !hasOfficers && (
            <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400E" }}>
              No officers added yet. Admin must add officers from <strong>Settings → Officer Management</strong>.
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <Field label="Mobile Number" icon={<Phone size={14} color="#94A3B8" />}>
              <input type="tel" placeholder="10-digit mobile number" value={loginMobile} onChange={e => setLoginMobile(e.target.value)} maxLength={10} style={inp} autoFocus />
            </Field>

            <Field label="Password" icon={<Lock size={14} color="#94A3B8" />}>
              <input type={showLoginPass ? "text" : "password"} placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ ...inp, paddingRight: 36 }} />
              <button type="button" onClick={() => setShowLoginPass(p => !p)} style={eyeBtn}>
                {showLoginPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </Field>

            <ErrorBanner msg={error} />

            <SubmitBtn
              loading={loading}
              label={loading ? "Signing in…" : `Sign In as ${roleTab === "admin" ? "Admin" : "Officer"}`}
              icon={<LogIn size={16} />}
              disabled={roleTab === "officer" && !hasOfficers}
            />
          </form>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={lbl}>{icon}<span style={{ marginLeft: 4 }}>{label}</span></label>
      <div style={{ position: "relative", display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#F8FAFC", paddingLeft: 10 }}>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#E11D48", display: "flex", alignItems: "center", gap: 7 }}>
          ⚠️ {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitBtn({ loading, label, icon, disabled = false }: { loading: boolean; label: string; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      style={{ width: "100%", background: loading || disabled ? "#FDA35C" : "#F97316", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: loading || disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
      {loading ? (
        <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />{label}</>
      ) : (
        <>{icon}{label}</>
      )}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 };
const inp: React.CSSProperties = { flex: 1, border: "none", background: "transparent", padding: "10px 10px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", width: "100%" };
const eyeBtn: React.CSSProperties = { position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 2 };
