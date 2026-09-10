import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Check, User, Lock, Store, Phone, Mail,
  CreditCard, Globe, Eye, EyeOff, LogOut, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useBusinessStore } from "@/store/business.store";

// =============================================================
// PROFILE PAGE
// Full-page version of the profile panel.
// Header: ← Close (left)   Save (right)
// Body: three sections — Account · Change Password · Business
// =============================================================

export default function ProfilePage() {
  const navigate = useNavigate();
  const { session, admin, updateAdminName, updateAdminPassword, logout } = useAuthStore();
  const { profile, updateProfile } = useBusinessStore();

  const isAdmin    = session?.role === "admin";
  const userName   = session?.name ?? "";
  const userMobile = session?.mobile ?? "";

  // ── Account fields ─────────────────────────────────────────
  const [name,      setName]      = useState(userName);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCur,   setShowCur]   = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [showCon,   setShowCon]   = useState(false);
  const [pwError,   setPwError]   = useState<string | null>(null);

  // ── Business fields ────────────────────────────────────────
  const [storeName, setStoreName] = useState(profile.storeName);
  const [address,   setAddress]   = useState(profile.address);
  const [phone,     setPhone]     = useState(profile.phone);
  const [email,     setEmail]     = useState(profile.email);
  const [upiId,     setUpiId]     = useState(profile.upiId);
  const [website,   setWebsite]   = useState(profile.website);

  // Keep local state in sync with store (in case page is navigated back to)
  useEffect(() => {
    setName(userName);
    setStoreName(profile.storeName);
    setAddress(profile.address);
    setPhone(profile.phone);
    setEmail(profile.email);
    setUpiId(profile.upiId);
    setWebsite(profile.website);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwError(null);
  }, []);

  // ── Save all ───────────────────────────────────────────────
  const handleSaveAll = () => {
    // Save name
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== userName && isAdmin) {
      updateAdminName(trimmedName);
    }
    // Save business
    updateProfile({ storeName, address, phone, email, upiId, website });
    toast.success("Profile saved");
    navigate(-1);
  };

  // ── Change password ────────────────────────────────────────
  const savePassword = async () => {
    setPwError(null);
    if (!currentPw)           { setPwError("Enter your current password"); return; }
    if (!newPw)               { setPwError("Enter a new password"); return; }
    if (newPw !== confirmPw)  { setPwError("Passwords don't match"); return; }
    if (!isAdmin)             { setPwError("Password change is only available for admin."); return; }
    const result = await updateAdminPassword(currentPw, newPw);
    if (result.ok) {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast.success("Password changed");
    } else {
      setPwError(result.error ?? "Failed");
    }
  };

  return (
    <div style={{ minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Top header ───────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fff", borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
      }}>
        {/* Left: Close */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#64748B", fontSize: 13, fontWeight: 600,
            padding: "6px 10px", borderRadius: 7,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        >
          <X size={15} /> Close
        </button>

        {/* Centre: title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Profile</div>

        {/* Right: Save */}
        <button
          onClick={handleSaveAll}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#F97316", border: "none", borderRadius: 7,
            color: "#fff", fontSize: 13, fontWeight: 700,
            padding: "7px 18px", cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <Check size={14} /> Save
        </button>
      </div>

      {/* ── Page body ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Avatar + Name strip ──────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
          padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#F97316", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, flexShrink: 0,
            border: "3px solid #FED7AA",
          }}>
            {(name || userName || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{name || userName || "User"}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{userMobile} · {session?.role === "admin" ? "Admin" : "Officer"}</div>
          </div>
        </div>

        {/* ── Account ─────────────────────────────────────── */}
        <Card title="Account" icon={<User size={15} />}>
          <Field label="Display Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={inp}
            />
          </Field>
          <Field label="Mobile">
            <input value={userMobile} disabled style={{ ...inp, color: "#94A3B8", background: "#F8FAFC", cursor: "not-allowed" }} />
          </Field>
        </Card>

        {/* ── Business Details ────────────────────────────── */}
        <Card title="Business Details" icon={<Store size={15} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Store Name">
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Orizo Mart" style={inp} />
            </Field>
            <Field label="Phone">
              <WithIcon icon={<Phone size={13} color="#94A3B8" />}>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ ...inp, paddingLeft: 32 }} />
              </WithIcon>
            </Field>
            <Field label="Email">
              <WithIcon icon={<Mail size={13} color="#94A3B8" />}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="store@example.com" style={{ ...inp, paddingLeft: 32 }} />
              </WithIcon>
            </Field>
            <Field label="UPI ID">
              <WithIcon icon={<CreditCard size={13} color="#94A3B8" />}>
                <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="storename@upi" style={{ ...inp, paddingLeft: 32 }} />
              </WithIcon>
            </Field>
            <Field label="Website">
              <WithIcon icon={<Globe size={13} color="#94A3B8" />}>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourstore.com" style={{ ...inp, paddingLeft: 32 }} />
              </WithIcon>
            </Field>
          </div>
          <Field label="Address">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, PIN"
              rows={2}
              style={{ ...inp, resize: "none", lineHeight: 1.5 }}
            />
          </Field>
        </Card>

        {/* ── Change Password ──────────────────────────────── */}
        <Card title="Change Password" icon={<Lock size={15} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Current Password">
              <PwInput value={currentPw} onChange={setCurrentPw} show={showCur} onToggle={() => setShowCur(p => !p)} placeholder="Current password" />
            </Field>
            <Field label="New Password">
              <PwInput value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(p => !p)} placeholder="Min. 6 characters" />
            </Field>
            <Field label="Confirm Password">
              <PwInput value={confirmPw} onChange={setConfirmPw} show={showCon} onToggle={() => setShowCon(p => !p)} placeholder="Re-enter password" />
            </Field>
          </div>
          {pwError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, padding: "8px 12px",
            }}>
              <AlertCircle size={13} color="#EF4444" />
              <span style={{ fontSize: 12, color: "#EF4444" }}>{pwError}</span>
            </div>
          )}
          <button
            onClick={() => void savePassword()}
            style={{
              padding: "9px 24px", background: "#F97316", border: "none",
              borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            Update Password
          </button>
        </Card>

        {/* ── Sign out ─────────────────────────────────────── */}
        <div style={{ paddingBottom: 24 }}>
          <button
            onClick={logout}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 24px", background: "none",
              border: "1.5px solid #FCA5A5", borderRadius: 9,
              color: "#EF4444", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316" }}>
          {icon}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}

function WithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

function PwInput({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inp, paddingRight: 36 }}
      />
      <button type="button" onClick={onToggle}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#94A3B8" }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1.5px solid #E2E8F0", fontSize: 13, color: "#0F172A",
  outline: "none", background: "#F8FAFC", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.15s",
};
