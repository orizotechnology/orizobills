import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, MapPin, Plus, Loader2 } from "lucide-react";
import { useBranchStore } from "@/store/branch.store";
import { branchService } from "@/services/branch.service";

// =============================================================
// ADD BRANCH DIALOG
// Opens as a modal. Asks for branch name + optional address.
// On submit → calls backend → creates PostgreSQL schema.
// =============================================================

interface AddBranchDialogProps {
  onClose: () => void;
}

export function AddBranchDialog({ onClose }: AddBranchDialogProps) {
  const { addBranch } = useBranchStore();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Branch name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await branchService.create({
        name: name.trim(),
        address: address.trim() || undefined,
      });

      if (res.success) {
        addBranch(res.data.branch);
        onClose();
      } else {
        setError("Failed to create branch.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create branch. Is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 16px",
          borderBottom: "1px solid #F1F5F9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(249,115,22,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={18} color="#F97316" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                Add New Branch
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>
                Creates an isolated MySQL database
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "none", background: "#F8FAFC",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "#64748B", outline: "none",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>

          {/* Branch name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Branch Name <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <div style={inputWrapStyle}>
              <Building2 size={15} color="#94A3B8" style={{ marginLeft: 12, marginRight: 4, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="e.g. Main Branch, Koramangala, HSR Layout"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                autoFocus
                maxLength={100}
              />
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
              A dedicated MySQL database will be created: <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
                erp_{name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").substring(0, 40) || "..."}
              </code>
            </div>
          </div>

          {/* Address (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>
              Address <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
            </label>
            <div style={inputWrapStyle}>
              <MapPin size={15} color="#94A3B8" style={{ marginLeft: 12, marginRight: 4, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="e.g. 123, MG Road, Bengaluru - 560001"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={inputStyle}
                maxLength={500}
              />
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
                }}
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "11px 0",
                border: "1px solid #E2E8F0", borderRadius: 10,
                background: "#fff", color: "#475569",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit", outline: "none",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2, padding: "11px 0",
                border: "none", borderRadius: 10,
                background: loading ? "#FDA35C" : "#F97316",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", outline: "none",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (
                <><Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Creating...</>
              ) : (
                <><Plus size={15} /> Create Branch</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 6,
};

const inputWrapStyle: React.CSSProperties = {
  display: "flex", alignItems: "center",
  border: "1.5px solid #E2E8F0", borderRadius: 10,
  background: "#F8FAFC",
};

const inputStyle: React.CSSProperties = {
  flex: 1, border: "none", background: "transparent",
  padding: "10px 12px", fontSize: 14, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
};
