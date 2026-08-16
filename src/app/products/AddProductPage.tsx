import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Package, ScanLine, Tag, IndianRupee,
  CheckCircle2, AlertCircle, Loader2, ArrowLeft,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// ADD PRODUCT PAGE — full-screen, matches PurchaseEntryPage
// Route: /app/products/new  (no AppLayout wrapper)
// =============================================================

const TAX_OPTIONS  = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = [
  "Nos", "Pcs", "Box", "Kg", "Gm", "Mg",
  "Litre", "Ml", "Metre", "Cm", "Mm",
  "Pair", "Set", "Dozen", "Bundle",
  "Bag", "Carton", "Roll", "Sheet", "Tablet",
];

interface ApiResponse<T> { success: boolean; data: T; message?: string; }
interface Product {
  id: string; name: string; code: string; barcode: string | null;
  description: string | null; mrp: number; salePrice: number;
  taxPct: number; unit: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

type FormState = {
  name: string; code: string; barcode: string; description: string;
  mrp: string; salePrice: string; taxPct: string; unit: string;
};

const EMPTY: FormState = {
  name: "", code: "", barcode: "", description: "",
  mrp: "", salePrice: "", taxPct: "0", unit: "Nos",
};

export default function AddProductPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [form,    setForm]    = useState<FormState>(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");
  const [addAnother, setAddAnother] = useState(false);

  // Dirty-check for beforeunload
  const isDirty = Object.values(form).some((v) => v !== "" && v !== "0" && v !== "Nos");

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Escape = close if clean
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) navigate("/app/products/all");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate, saving]);

  const set = <K extends keyof FormState>(field: K, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  // Live preview values
  const mrpNum  = parseFloat(form.mrp)       || 0;
  const spNum   = parseFloat(form.salePrice) || 0;
  const taxNum  = parseFloat(form.taxPct)    || 0;
  const taxAmt  = +(spNum * taxNum / 100).toFixed(2);
  const margin  = mrpNum > 0 && spNum > 0
    ? (((mrpNum - spNum) / mrpNum) * 100).toFixed(1)
    : null;

  const validate = (): string | null => {
    if (!form.name.trim())     return "Product name is required.";
    if (!form.code.trim())     return "Product code is required.";
    if (form.salePrice === "") return "Sale price is required.";
    if (spNum < 0)             return "Sale price cannot be negative.";
    if (mrpNum < 0)            return "MRP cannot be negative.";
    return null;
  };

  const handleSave = async (andNew = false) => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSaving(true);

    try {
      const payload = {
        name:        form.name.trim(),
        code:        form.code.trim(),
        barcode:     form.barcode.trim()     || undefined,
        description: form.description.trim() || undefined,
        mrp:         mrpNum,
        salePrice:   spNum,
        taxPct:      taxNum,
        unit:        form.unit,
      };
      const res = await http.post<ApiResponse<Product>>("/products", payload);
      if (!res.success) { setError("Failed to save product."); return; }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-map"] });

      setSuccess(true);
      if (andNew) {
        setTimeout(() => { setForm(EMPTY); setSuccess(false); }, 700);
      } else {
        setTimeout(() => navigate("/app/products/all"), 900);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100vw",
      background: "#fff", fontFamily: "system-ui, sans-serif",
      fontSize: 13, overflow: "hidden",
    }}>

      {/* ── Top Bar ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 48,
        background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0,
      }}>
        {/* Left: back + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/app/products/all")}
            style={topIconBtn}
            title="Back to Products"
          >
            <ArrowLeft size={16} color="#64748B" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: "rgba(249,115,22,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Package size={14} color="#F97316" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Add New Product
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Products catalogue</div>
            </div>
          </div>
        </div>

        {/* Right: close */}
        <button
          onClick={() => navigate("/app/products/all")}
          style={topIconBtn}
          title="Close"
        >
          <X size={16} color="#64748B" />
        </button>
      </div>

      {/* ── Body: form + preview ─────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Left: form (scrollable) ────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", minWidth: 0 }}>

          {/* SECTION: Basic Info */}
          <SectionLabel icon={<Tag size={13} />} title="Basic Information" />
          <div style={{ ...grid2, marginBottom: 24 }}>

            {/* Name — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel required>Product Name</FieldLabel>
              <input
                style={inp}
                type="text"
                placeholder="e.g. Basmati Rice 5kg"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
            </div>

            {/* Code */}
            <div>
              <FieldLabel required>Product Code / SKU</FieldLabel>
              <input
                style={inp}
                type="text"
                placeholder="e.g. RICE001"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
              <Hint>Unique identifier used in invoices</Hint>
            </div>

            {/* Barcode */}
            <div>
              <FieldLabel>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <ScanLine size={12} color="#94A3B8" /> Barcode
                  <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span>
                </span>
              </FieldLabel>
              <input
                style={inp}
                type="text"
                placeholder="EAN-13 or custom barcode"
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
            </div>

            {/* Description — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Description <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></FieldLabel>
              <textarea
                style={{ ...inp, resize: "none", height: 72, paddingTop: 10 }}
                placeholder="Product description, size, variant…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
            </div>
          </div>

          {/* SECTION: Pricing & Tax */}
          <SectionLabel icon={<IndianRupee size={13} />} title="Pricing & Tax" />
          <div style={{ ...grid2, marginBottom: 24 }}>

            {/* MRP */}
            <div>
              <FieldLabel>MRP (₹)</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={rupeePrefix}>₹</span>
                <input
                  style={{ ...inp, paddingLeft: 26 }}
                  type="text" inputMode="decimal"
                  placeholder="0.00"
                  value={form.mrp}
                  onChange={(e) => set("mrp", e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
                />
              </div>
              <Hint>Maximum retail price</Hint>
            </div>

            {/* Sale Price */}
            <div>
              <FieldLabel required>Sale Price (₹)</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={rupeePrefix}>₹</span>
                <input
                  style={{ ...inp, paddingLeft: 26 }}
                  type="text" inputMode="decimal"
                  placeholder="0.00"
                  value={form.salePrice}
                  onChange={(e) => set("salePrice", e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
                />
              </div>
              {margin !== null && (
                <Hint color="#22C55E">{margin}% below MRP</Hint>
              )}
            </div>

            {/* GST */}
            <div>
              <FieldLabel>GST / Tax %</FieldLabel>
              <select
                style={inp}
                value={form.taxPct}
                onChange={(e) => set("taxPct", e.target.value)}
              >
                {TAX_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t === 0 ? "No Tax (0%)" : `${t}%`}</option>
                ))}
              </select>
            </div>

            {/* Unit */}
            <div>
              <FieldLabel>Unit of Measure</FieldLabel>
              <select
                style={inp}
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* ── Right: live preview panel ─────────────────── */}
        <div style={{
          width: 300, flexShrink: 0,
          background: "#fff", borderLeft: "1px solid #E2E8F0",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>

          {/* Product Card Preview */}
          <div style={{ padding: "20px 18px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
              Preview
            </div>

            <div style={{
              background: "#F8FAFC", borderRadius: 12,
              border: "1px solid #E2E8F0", padding: "16px",
            }}>
              {/* Icon + name */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "rgba(249,115,22,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Package size={18} color="#F97316" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: form.name ? "#0F172A" : "#CBD5E1",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {form.name || "Product name"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {form.code || "Code"} {form.unit ? `· ${form.unit}` : ""}
                  </div>
                </div>
              </div>

              {/* Pricing rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <PriceRow label="MRP" value={mrpNum > 0 ? `₹${mrpNum.toFixed(2)}` : "—"} muted />
                <PriceRow label="Sale Price" value={spNum > 0 ? `₹${spNum.toFixed(2)}` : "—"} highlight />
                <PriceRow label={`GST (${taxNum}%)`} value={taxAmt > 0 ? `₹${taxAmt.toFixed(2)}` : "—"} muted />
              </div>

              {/* Barcode badge */}
              {form.barcode && (
                <div style={{
                  marginTop: 12, display: "flex", alignItems: "center", gap: 6,
                  background: "#fff", borderRadius: 7, padding: "6px 10px",
                  border: "1px solid #E2E8F0",
                }}>
                  <ScanLine size={12} color="#F97316" />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#475569" }}>
                    {form.barcode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Summary
            </div>
            {[
              { label: "Product Name", value: form.name || "—" },
              { label: "Code",         value: form.code || "—" },
              { label: "MRP",          value: mrpNum > 0 ? `₹${mrpNum.toFixed(2)}` : "—" },
              { label: "Sale Price",   value: spNum > 0 ? `₹${spNum.toFixed(2)}` : "—" },
              { label: "Tax",          value: taxNum > 0 ? `${taxNum}%` : "None" },
              { label: "Unit",         value: form.unit },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: "#1E293B",
                  maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "right",
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid #E2E8F0", padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, background: "#fff",
      }}>
        {/* Left: Add another toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <div
            onClick={() => setAddAnother((p) => !p)}
            style={{
              width: 34, height: 20, borderRadius: 10, position: "relative", cursor: "pointer",
              background: addAnother ? "#F97316" : "#E2E8F0",
              transition: "background 0.2s",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: addAnother ? 16 : 2,
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
          <span style={{ fontSize: 13, color: "#64748B" }}>Save & add another</span>
        </label>

        {/* Right: error + buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Error inline */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#EF4444",
                }}
              >
                <AlertCircle size={13} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => navigate("/app/products/all")}
            disabled={saving}
            style={{
              border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff",
              color: "#475569", padding: "8px 20px", fontSize: 13, fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => void handleSave(addAnother)}
            disabled={saving || success}
            style={{
              background: success ? "#22C55E" : saving ? "#FDA35C" : "#F97316",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 32px", fontSize: 13, fontWeight: 700,
              cursor: saving || success ? "not-allowed" : "pointer",
              fontFamily: "inherit", outline: "none",
              display: "flex", alignItems: "center", gap: 6,
              transition: "background 0.15s",
            }}
          >
            {success
              ? <><CheckCircle2 size={15} /> Saved!</>
              : saving
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                : addAnother ? "Save & Add Another" : "Save Product"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: "rgba(249,115,22,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316",
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

function Hint({ children, color = "#94A3B8" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: "block", fontSize: 11, color, marginTop: 4 }}>
      {children}
    </span>
  );
}

function PriceRow({ label, value, highlight, muted }: {
  label: string; value: string; highlight?: boolean; muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
      <span style={{
        fontSize: highlight ? 16 : 13,
        fontWeight: highlight ? 800 : 500,
        color: highlight ? "#F97316" : muted ? "#94A3B8" : "#1E293B",
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 9,
  padding: "9px 12px", fontSize: 13, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const grid2: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
};

const rupeePrefix: React.CSSProperties = {
  position: "absolute", left: 10, top: "50%",
  transform: "translateY(-50%)",
  fontSize: 13, color: "#94A3B8", pointerEvents: "none",
};

const topIconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: "1px solid #E2E8F0", background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", outline: "none",
};
