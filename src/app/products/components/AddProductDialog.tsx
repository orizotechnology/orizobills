import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// ADD / EDIT PRODUCT DIALOG
// =============================================================

interface Product {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  description: string | null;
  mrp: number;
  salePrice: number;
  taxPct: number;
  unit: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: { message: string };
}

interface AddProductDialogProps {
  product: Product | null; // null = adding new
  onClose: () => void;
  onSaved: () => void;
}

const TAX_OPTIONS = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = ["Nos", "Kg", "Gm", "Litre", "Ml", "Metre", "Cm", "Box", "Pcs", "Pair", "Set"];

export function AddProductDialog({ product, onClose, onSaved }: AddProductDialogProps) {
  const isEdit = !!product;

  const [form, setForm] = useState({
    name:        product?.name        ?? "",
    code:        product?.code        ?? "",
    barcode:     product?.barcode     ?? "",
    description: product?.description ?? "",
    mrp:         product?.mrp         ?? 0,
    salePrice:   product?.salePrice   ?? 0,
    taxPct:      product?.taxPct      ?? 0,
    unit:        product?.unit        ?? "Nos",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  // Sync form if editing different product
  useEffect(() => {
    if (product) {
      setForm({
        name:        product.name        ?? "",
        code:        product.code        ?? "",
        barcode:     product.barcode     ?? "",
        description: product.description ?? "",
        mrp:         product.mrp         ?? 0,
        salePrice:   product.salePrice   ?? 0,
        taxPct:      product.taxPct      ?? 0,
        unit:        product.unit        ?? "Nos",
      });
    }
  }, [product]);

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(false);

    if (!form.name.trim())  { setError("Product name is required."); return; }
    if (!form.code.trim())  { setError("Product code is required."); return; }
    if (form.mrp < 0)       { setError("MRP cannot be negative."); return; }
    if (form.salePrice < 0) { setError("Sale price cannot be negative."); return; }

    setLoading(true);
    try {
      const payload = {
        ...form,
        barcode:     form.barcode.trim()     || undefined,
        description: form.description.trim() || undefined,
        mrp:         Number(form.mrp),
        salePrice:   Number(form.salePrice),
        taxPct:      Number(form.taxPct),
      };

      let res: ApiResponse<Product>;
      if (isEdit) {
        res = await http.put<ApiResponse<Product>>(`/products/${product.id}`, payload);
      } else {
        res = await http.post<ApiResponse<Product>>("/products", payload);
      }

      if (res.success) {
        setSuccess(true);
        setTimeout(() => { onSaved(); }, 600);
      } else {
        setError("Failed to save product.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px 14px", borderBottom: "1px solid #F1F5F9", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
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
                {isEdit ? `Editing: ${product.name}` : "Fill in product details"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <form id="product-form" onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Name — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Product Name <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="e.g. Premium Rice 5kg"
                  value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </div>

              {/* Code */}
              <div>
                <label style={labelStyle}>Product Code <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="e.g. PR001"
                  value={form.code} onChange={(e) => set("code", e.target.value)} />
              </div>

              {/* Barcode */}
              <div>
                <label style={labelStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ScanLine size={12} color="#94A3B8" /> Barcode (optional)
                  </span>
                </label>
                <input style={inputStyle} type="text" placeholder="EAN-13 or custom barcode"
                  value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
              </div>

              {/* MRP */}
              <div>
                <label style={labelStyle}>MRP (₹)</label>
                <input style={inputStyle} type="number" min={0} step={0.01} placeholder="0.00"
                  value={form.mrp} onChange={(e) => set("mrp", e.target.value)} />
              </div>

              {/* Sale Price */}
              <div>
                <label style={labelStyle}>Sale Price (₹) <span style={{ color: "#EF4444" }}>*</span></label>
                <input style={inputStyle} type="number" min={0} step={0.01} placeholder="0.00"
                  value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
              </div>

              {/* Tax */}
              <div>
                <label style={labelStyle}>GST Tax %</label>
                <select style={inputStyle} value={form.taxPct} onChange={(e) => set("taxPct", e.target.value)}>
                  {TAX_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}%</option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label style={labelStyle}>Unit</label>
                <select style={inputStyle} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Description — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Description (optional)</label>
                <textarea
                  style={{ ...inputStyle, resize: "none", height: 72, paddingTop: 10 }}
                  placeholder="Product description..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px 18px", borderTop: "1px solid #F1F5F9",
          flexShrink: 0,
        }}>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: 8, padding: "8px 12px", marginBottom: 10,
                  fontSize: 13, color: "#EF4444",
                }}>
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "11px 0", border: "1px solid #E2E8F0",
              borderRadius: 10, background: "#fff", color: "#475569",
              fontSize: 14, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", outline: "none",
            }}>Cancel</button>
            <button
              form="product-form" type="submit"
              disabled={loading || success}
              style={{
                flex: 2, padding: "11px 0", border: "none", borderRadius: 10,
                background: success ? "#22C55E" : loading ? "#FDA35C" : "#F97316",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading || success ? "not-allowed" : "pointer",
                fontFamily: "inherit", outline: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {success ? <><CheckCircle2 size={16} /> Saved!</>
                : loading ? <><Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Saving...</>
                : isEdit ? "Update Product" : "Add Product"}
            </button>
          </div>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#475569", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", boxSizing: "border-box",
};

const closeBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: "none", background: "#F8FAFC",
  cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
  color: "#64748B", outline: "none",
};
