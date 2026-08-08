import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Lock,
  Store,
  Phone,
  Mail,
  CreditCard,
  Globe,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useBusinessStore } from "@/store/business.store";

// =============================================================
// PROFILE DRAWER
// =============================================================

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { session, admin, updateAdminName, updateAdminPassword, logout } = useAuthStore();
  const { profile, updateProfile } = useBusinessStore();

  const isAdmin  = session?.role === "admin";
  const userName = session?.name ?? "";
  const userMobile = session?.mobile ?? "";

  // ── Account fields ──────────────────────────────────────────
  const [name, setName] = useState(userName);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCur, setShowCur]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [showCon, setShowCon]     = useState(false);
  const [pwError, setPwError]     = useState<string | null>(null);

  // ── Business fields ─────────────────────────────────────────
  const [storeName, setStoreName] = useState(profile.storeName);
  const [address, setAddress]     = useState(profile.address);
  const [phone, setPhone]         = useState(profile.phone);
  const [email, setEmail]         = useState(profile.email);
  const [upiId, setUpiId]         = useState(profile.upiId);
  const [website, setWebsite]     = useState(profile.website);

  // ── Toast ────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);

  // Sync when drawer reopens
  useEffect(() => {
    if (open) {
      setName(userName);
      setStoreName(profile.storeName);
      setAddress(profile.address);
      setPhone(profile.phone);
      setEmail(profile.email);
      setUpiId(profile.upiId);
      setWebsite(profile.website);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwError(null);
    }
  }, [open]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // ── Save account ─────────────────────────────────────────────
  const saveAccount = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isAdmin) updateAdminName(trimmed);
    showToast("Name updated");
  };

  // ── Change password ──────────────────────────────────────────
  const savePassword = async () => {
    setPwError(null);
    if (!currentPw) { setPwError("Enter your current password"); return; }
    if (!newPw)     { setPwError("Enter a new password"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords don't match"); return; }
    if (!isAdmin)   { setPwError("Password change is only available for admin."); return; }
    const result = await updateAdminPassword(currentPw, newPw);
    if (result.ok) {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      showToast("Password changed");
    } else {
      setPwError(result.error ?? "Failed");
    }
  };

  // ── Save business ─────────────────────────────────────────────
  const saveBusiness = () => {
    updateProfile({ storeName, address, phone, email, upiId, website });
    showToast("Business details saved");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 1100,
              background: "rgba(15,23,42,0.35)",
              backdropFilter: "blur(2px)",
            }}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1200,
              width: 360,
              background: "#fff",
              boxShadow: "4px 0 32px rgba(0,0,0,0.12)",
              display: "flex", flexDirection: "column",
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
          >
            {/* ── Header ─────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 20px 16px",
              borderBottom: "1px solid #F1F5F9",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: "#F97316", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700,
                  border: "2.5px solid #FED7AA",
                  flexShrink: 0,
                }}>
                  {(name || userName || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                    {name || userName || "User"}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    {userMobile}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                <X size={16} color="#94A3B8" />
              </button>
            </div>

            {/* ── Body ───────────────────────────────────── */}
            <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* ─ Account section ─────────────────────── */}
              <Section icon={<User size={14} />} title="Account">
                <form onSubmit={(e) => { e.preventDefault(); saveAccount(); }}>
                  <Field label="Display Name">
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        style={inputStyle}
                      />
                      <SaveBtn onClick={saveAccount} disabled={!name.trim() || name.trim() === userName} />
                    </div>
                  </Field>
                </form>
                <Field label="Mobile">
                  <input
                    value={userMobile}
                    disabled
                    style={{ ...inputStyle, color: "#94A3B8", background: "#F8FAFC", cursor: "not-allowed" }}
                  />
                </Field>
              </Section>

              {/* ─ Change password ─────────────────────── */}
              <Section icon={<Lock size={14} />} title="Change Password">
                <form onSubmit={(e) => { e.preventDefault(); void savePassword(); }}>
                <Field label="Current Password">
                  <PasswordInput
                    value={currentPw} onChange={setCurrentPw}
                    show={showCur} onToggle={() => setShowCur(!showCur)}
                    placeholder="Current password"
                  />
                </Field>
                <Field label="New Password">
                  <PasswordInput
                    value={newPw} onChange={setNewPw}
                    show={showNew} onToggle={() => setShowNew(!showNew)}
                    placeholder="Min. 6 characters"
                  />
                </Field>
                <Field label="Confirm New Password">
                  <PasswordInput
                    value={confirmPw} onChange={setConfirmPw}
                    show={showCon} onToggle={() => setShowCon(!showCon)}
                    placeholder="Re-enter new password"
                  />
                </Field>
                {pwError && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 8, padding: "8px 12px",
                  }}>
                    <AlertCircle size={13} color="#EF4444" />
                    <span style={{ fontSize: 12, color: "#EF4444" }}>{pwError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  style={{
                    width: "100%", padding: "10px 0",
                    background: "#F97316", border: "none", borderRadius: 8,
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", marginTop: 2,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  Update Password
                </button>
                </form>
              </Section>

              {/* ─ Business details ────────────────────── */}
              <Section icon={<Store size={14} />} title="Business Details">
                <form onSubmit={(e) => { e.preventDefault(); saveBusiness(); }}>
                <Field label="Store Name">
                  <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Orizo Mart" style={inputStyle} />
                </Field>
                <Field label="Address">
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, State, PIN"
                    rows={2}
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
                  />
                </Field>
                <Field label="Phone">
                  <InputWithIcon icon={<Phone size={13} color="#94A3B8" />}>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={iconInputStyle} />
                  </InputWithIcon>
                </Field>
                <Field label="Email">
                  <InputWithIcon icon={<Mail size={13} color="#94A3B8" />}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="store@example.com" style={iconInputStyle} />
                  </InputWithIcon>
                </Field>
                <Field label="UPI ID">
                  <InputWithIcon icon={<CreditCard size={13} color="#94A3B8" />}>
                    <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="storename@upi" style={iconInputStyle} />
                  </InputWithIcon>
                </Field>
                <Field label="Website">
                  <InputWithIcon icon={<Globe size={13} color="#94A3B8" />}>
                    <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourstore.com" style={iconInputStyle} />
                  </InputWithIcon>
                </Field>
                <button
                  type="submit"
                  style={{
                    width: "100%", padding: "10px 0",
                    background: "#F97316", border: "none", borderRadius: 8,
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", marginTop: 4,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  Save Business Details
                </button>
                </form>
              </Section>

              {/* ─ Address ─────────────────────────────── */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 20 }}>
                <button
                  onClick={logout}
                  style={{
                    width: "100%", padding: "10px 0",
                    background: "none",
                    border: "1.5px solid #FCA5A5",
                    borderRadius: 8,
                    color: "#EF4444", fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.04)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>

            {/* ── Toast ──────────────────────────────────── */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  key="toast"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "sticky", bottom: 16,
                    margin: "0 16px",
                    background: "#0F172A", color: "#fff",
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 13, fontWeight: 500,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                  }}
                >
                  <CheckCircle2 size={15} color="#22C55E" />
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// =============================================================
// SMALL HELPERS
// =============================================================

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        marginBottom: 14,
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          background: "rgba(249,115,22,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#F97316",
        }}>
          {icon}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggle, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 36 }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", color: "#94A3B8",
        }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function InputWithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{
        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
        display: "flex", alignItems: "center", pointerEvents: "none",
      }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flexShrink: 0, padding: "0 14px",
        height: 36, borderRadius: 8, border: "none",
        background: disabled ? "#E2E8F0" : "#F97316",
        color: disabled ? "#94A3B8" : "#fff",
        fontSize: 12, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
      }}
    >
      Save
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1.5px solid #E2E8F0",
  fontSize: 13,
  color: "#0F172A",
  outline: "none",
  background: "#F8FAFC",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const iconInputStyle: React.CSSProperties = {
  ...inputStyle,
  paddingLeft: 32,
};
