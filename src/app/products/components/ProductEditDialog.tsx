import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Package, ScanLine, Loader2, CheckCircle2,
  Tag, IndianRupee, ToggleLeft, ToggleRight, AlertCircle,
} from "lucide-react";
import { http } from "@/lib/axios";
import type { Product } from "../product.types";

// =============================================================
// PRODUCT EDIT / ADD DIALOG
// =============================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface Props {
  product: Product | null; // null → adding new
  onClose: () => void;
  onSaved: () => void;
}

const TAX_OPTIONS  = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = ["Nos", "Kg", "Gm", "Litre", "Ml", "Metre", "Cm", "Box", "Pcs", "Pair", "Set"];

type FormState = {
  name: string;
  code: string;
  barcode: string;
  description: string;
  mrp: string;
  salePrice: string;
  taxPct: string;
  unit: string;
  isActive: boolean;
};

function productToForm(p: Product | null): FormState {
  return {
    name:        p?.name        ?? "",
    code:        p?.code        ?? "",
    barcode:     p?.barcode     ?? "",
    description: p?.description ?? "",
    mrp:         p?.mrp         != null ? String(p.mrp) : "",
    salePrice:   p?.salePrice   != null ? String(p.salePrice) : "",
    taxPct:      p?.taxPct      != null ? String(p.taxPct) : "0",
    unit:        p?.unit        ?? "Nos",
    isActive:    p?.isActive    ?? true,
  };
}

export function ProductEditDialog({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;

  const [form, setForm] = useState<FormState>(() => productToForm(product));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  // Re-sync when product prop changes (switching between edit targets)
  useEffect(() => { setForm(productToForm(product)); setError(""); setSuccess(false); }, [product]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Margin calculation helper
  const mrpNum   = parseFloat(form.mrp)       || 0;
  const spNum    = parseFloat(form.salePrice) || 0;
  const margin   = mrpNum > 0 ? (((mrpNum - spNum) / mrpNum) * 100).toFixed(1) : null;
  const discount = mrpNum > spNum && mrpNum > 0 ? `${margin}% below MRP` : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(false);

    // Validation
    if (!form.name.trim())     { setError("Product name is required."); return; }
    if (!form.code.trim())     { setError("Product code is required."); return; }
    if (form.salePrice === "") { setError("Sale price is required."); return; }
    if (parseFloat(form.mrp || "0") < 0)       { setError("MRP cannot be negative."); return; }
    if (parseFloat(form.salePrice || "0") < 0) { setError("Sale price cannot be negative."); return; }

    setLoading(true);
    try {
      const payload = {
        name:        form.name.trim(),
        code:        form.code.trim(),
        barcode:     form.barcode.trim()     || undefined,
        description: form.description.trim() || undefined,
        mrp:         parseFloat(form.mrp)       || 0,
        salePrice:   parseFloat(form.salePrice) || 0,
        taxPct:      parseFloat(form.taxPct)    || 0,
        unit:        form.unit,
        isActive:    form.isActive,
      };

      let res: ApiResponse<Product>;
      if (isEdit) {
        res = await http.put<ApiResponse<Product>>(`/products/${product.id}`, payload);
      } else {
        res = await http.post<ApiResponse<Product>>("/products", payload);
      }

      if (res.success) {
        setSuccess(true);
        setTimeout(() => onSaved(), 700);
      } else {
        setError("Failed to save product.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        style={{
          background: "#fff", borderRadius: 18,
          width: "100%", maxWidth: 600,
          maxHeight: "92vh",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Dialog header ─────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px 14px",
          borderBottom: "1px solid #F1F5F9",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "rgba(249,115,22,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Package size={18} color="#F97316" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                {isEdit ? "Edit Product" : "Add New Product"}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                {isEdit ? `ID: ${product.id.slice(0, 8)}…` : "Fill in the product details below"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable form body ──────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", scrollbarWidth: "none" }}>
          <form id="product-edit-form" onSubmit={handleSubmit}>

            {/* Section: Basic Info */}
            <SectionLabel icon={<Tag size={13} />} title="Basic Information" />
            <div style={grid2}>
              {/* Name — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel required>Product Name</FieldLabel>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. Basmati Rice 5kg"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <FieldLabel required>Product Code</FieldLabel>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. RICE001"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                />
                <span style={hint}>Unique identifier / SKU</span>
              </div>

              <div>
                <FieldLabel>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <ScanLine size={12} color="#94A3B8" /> Barcode
                    <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
                  </span>
                </FieldLabel>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="EAN-13 or custom"
                  value={form.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                />
              </div>

              {/* Description — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  style={{ ...inputStyle, resize: "none", height: 68, paddingTop: 10 }}
                  placeholder="Optional product description…"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </div>

            {/* Section: Pricing */}
            <SectionLabel icon={<IndianRupee size={13} />} title="Pricing & Tax" />
            <div style={grid2}>
              <div>
                <FieldLabel>MRP (₹)</FieldLabel>
                <div style={{ position: "relative" }}>
                  <span style={rupeePrefix}>₹</span>
                  <input
                    style={{ ...inputStyle, paddingLeft: 28 }}
                    type="text" inputMode="decimal"
                    placeholder="0.00"
                    value={form.mrp}
                    onChange={(e) => set("mrp", e.target.value)}
                  />
                </div>
                <span style={hint}>Maximum retail price</span>
              </div>

              <div>
                <FieldLabel required>Sale Price (₹)</FieldLabel>
                <div style={{ position: "relative" }}>
                  <span style={rupeePrefix}>₹</span>
                  <input
                    style={{ ...inputStyle, paddingLeft: 28 }}
                    type="text" inputMode="decimal"
                    placeholder="0.00"
                    value={form.salePrice}
                    onChange={(e) => set("salePrice", e.target.value)}
                  />
                </div>
                {discount && (
                  <span style={{ ...hint, color: "#22C55E" }}>{discount}</span>
                )}
              </div>

              <div>
                <FieldLabel>GST / Tax %</FieldLabel>
                <select
                  style={inputStyle}
                  value={form.taxPct}
                  onChange={(e) => set("taxPct", e.target.value)}
                >
                  {TAX_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t === 0 ? "No Tax (0%)" : `${t}%`}</option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Unit</FieldLabel>
                <select
                  style={inputStyle}
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section: Status (edit mode only) */}
            {isEdit && (
              <>
                <SectionLabel icon={<ToggleRight size={13} />} title="Status" />
                <div
                  onClick={() => set("isActive", !form.isActive)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 10,
                    border: `1.5px solid ${form.isActive ? "rgba(34,197,94,0.3)" : "#E2E8F0"}`,
                    background: form.isActive ? "rgba(34,197,94,0.05)" : "#F8FAFC",
                    cursor: "pointer", userSelect: "none",
                    transition: "all 0.15s",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: form.isActive ? "#16A34A" : "#94A3B8" }}>
                      {form.isActive ? "Active" : "Inactive"}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                      {form.isActive
                        ? "Product is visible in POS and catalogues"
                        : "Product is hidden from POS and catalogues"}
                    </div>
                  </div>
                  {form.isActive
                    ? <ToggleRight size={28} color="#22C55E" />
                    : <ToggleLeft  size={28} color="#CBD5E1" />
                  }
                </div>
              </>
            )}

            {/* Metadata (edit only) */}
            {isEdit && (
              <div style={{
                background: "#F8FAFC", borderRadius: 10, padding: "10px 14px",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4,
              }}>
                <MetaRow label="Created" value={new Date(product.createdAt).toLocaleString("en-IN")} />
                <MetaRow label="Last Updated" value={new Date(product.updatedAt).toLocaleString("en-IN")} />
                <MetaRow label="Product ID" value={product.id} mono />
              </div>
            )}

          </form>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div style={{
          padding: "12px 22px 18px",
          borderTop: "1px solid #F1F5F9",
          flexShrink: 0,
        }}>
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8, padding: "9px 12px", marginBottom: 10,
                  fontSize: 13, color: "#EF4444",
                }}
              >
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "11px 0",
                border: "1.5px solid #E2E8F0", borderRadius: 10,
                background: "#fff", color: "#475569",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit", outline: "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
            >
              Cancel
            </button>
            <button
              form="product-edit-form"
              type="submit"
              disabled={loading || success}
              style={{
                flex: 2, padding: "11px 0",
                border: "none", borderRadius: 10,
                background: success ? "#22C55E" : loading ? "#FDA35C" : "#F97316",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading || success ? "not-allowed" : "pointer",
                fontFamily: "inherit", outline: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s",
              }}
            >
              {success
                ? <><CheckCircle2 size={16} /> Saved!</>
                : loading
                  ? <><Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                  : isEdit ? "Update Product" : "Add Product"
              }
            </button>
          </div>
        </div>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      marginBottom: 12, marginTop: 4,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: "rgba(249,115,22,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#F97316",
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9", marginLeft: 6 }} />
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
      {children}
      {required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#475569", fontFamily: mono ? "monospace" : "inherit", marginTop: 2, wordBreak: "break-all" }}>
        {value}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────

const grid2: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr",
  gap: 14, marginBottom: 22,
};

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const hint: React.CSSProperties = {
  display: "block", fontSize: 11,
  color: "#94A3B8", marginTop: 4,
};

const rupeePrefix: React.CSSProperties = {
  position: "absolute", left: 10, top: "50%",
  transform: "translateY(-50%)",
  fontSize: 13, color: "#94A3B8",
  pointerEvents: "none",
};

const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: "none", background: "#F8FAFC",
  cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
  color: "#64748B", outline: "none",
};
