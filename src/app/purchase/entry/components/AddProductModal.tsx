import { useState } from "react";
import { motion } from "framer-motion";
import { X, Package, Loader2 } from "lucide-react";
import { http } from "@/lib/axios";
import type { ProductOption } from "../purchase.types";

// =============================================================
// ADD PRODUCT MODAL — quick create from purchase entry
// =============================================================

interface ApiResponse<T> { success: boolean; data: T; message?: string; error?: { message: string }; }

interface AddProductModalProps {
  prefill: string;
  onCreated: (product: ProductOption) => void;
  onClose: () => void;
}

const TAX_OPTIONS = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = ["Nos","Kg","Gm","Litre","Ml","Box","Pcs","Metre","Pair","Set"];

export function AddProductModal({ prefill, onCreated, onClose }: AddProductModalProps) {
  const [form, setForm] = useState({
    name: prefill, code: "", barcode: "",
    mrp: "0", salePrice: "0", taxPct: "0", unit: "Nos",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("Product name is required."); return; }
    if (!form.code.trim()) { setError("Product code is required."); return; }
    setLoading(true);
    try {
      const res = await http.post<ApiResponse<ProductOption>>("/products", {
        name: form.name.trim(),
        code: form.code.trim(),
        barcode: form.barcode.trim() || undefined,
        mrp: parseFloat(form.mrp) || 0,
        salePrice: parseFloat(form.salePrice) || 0,
        taxPct: parseFloat(form.taxPct) || 0,
        unit: form.unit,
      });
      if (res.success) { onCreated(res.data); }
      else { setError("Failed to create product."); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(249,115,22,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={16} color="#F97316" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Add New Product</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Create and add to this purchase</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", outline: "none" }}><X size={16} /></button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Product Name *</label>
              <input style={inp} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label style={lbl}>Code *</label>
              <input style={inp} placeholder="e.g. PR001" value={form.code} onChange={(e) => set("code", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Barcode</label>
              <input style={inp} placeholder="Optional" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>MRP (₹)</label>
              <input style={inp} type="number" min={0} step="0.01" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Sale Price (₹) *</label>
              <input style={inp} type="number" min={0} step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>GST %</label>
              <select style={inp} value={form.taxPct} onChange={(e) => set("taxPct", e.target.value)}>
                {TAX_OPTIONS.map((t) => <option key={t} value={t}>{t}%</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Unit</label>
              <select style={inp} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "8px 12px", marginTop: 12, fontSize: 12, color: "#EF4444" }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 18px", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #E2E8F0", borderRadius: 9, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: "9px", border: "none", borderRadius: 9, background: loading ? "#FDA35C" : "#F97316", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving...</> : "Save Product"}
          </button>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
