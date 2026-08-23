import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Package, ScanLine, CheckCircle2,
  AlertCircle, Loader2, Plus,
} from "lucide-react";
import { http } from "@/lib/axios";
import type { ProductRow } from "./ProductTable";
import { nanoid } from "nanoid";

// =============================================================
// ADD PRODUCT TO BILL DIALOG (POS)
//
// Focused modal — lets the cashier quickly create a new product
// in the database and immediately adds it to the current bill.
//
// Steps:
//   1. Fill in product details (name, code, MRP, price, tax, unit)
//   2. Hit "Save & Add to Bill"  → POST /api/products
//   3. The saved product is instantly added as a row in the bill
// =============================================================

const TAX_OPTIONS  = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = [
  "Nos", "Pcs", "Box", "Kg", "Gm", "Litre", "Ml",
  "Metre", "Cm", "Pair", "Set", "Dozen", "Bundle", "Bag",
];

interface ApiResponse<T> { success: boolean; data: T; message?: string; }
interface CreatedProduct {
  id: string; name: string; code: string; barcode: string | null;
  mrp: number; salePrice: number; taxPct: number; unit: string;
}

interface Props {
  onClose: () => void;
  onAdded: (row: ProductRow) => void;
}

export function AddProductToBillDialog({ onClose, onAdded }: Props) {
  const [form, setForm] = useState({
    name:        "",
    code:        "",
    barcode:     "",
    mrp:         "",
    salePrice:   "",
    taxPct:      "0",
    unit:        "Nos",
    openingStock:"0",
  });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mrpNum  = parseFloat(form.mrp)       || 0;
  const spNum   = parseFloat(form.salePrice) || 0;
  const taxNum  = parseFloat(form.taxPct)    || 0;
  const taxAmt  = +(spNum * taxNum / 100).toFixed(2);
  const marginPct = mrpNum > 0 && spNum > 0
    ? (((mrpNum - spNum) / mrpNum) * 100).toFixed(1)
    : null;

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("Product name is required."); return; }
    if (!form.code.trim()) { setError("Product code is required."); return; }
    if (!form.salePrice)   { setError("Sale price is required."); return; }
    if (spNum <= 0)        { setError("Sale price must be greater than 0."); return; }

    setSaving(true);
    try {
      const res = await http.post<ApiResponse<CreatedProduct>>("/products", {
        name:          form.name.trim(),
        code:          form.code.trim(),
        barcode:       form.barcode.trim() || undefined,
        mrp:           mrpNum,
        salePrice:     spNum,
        taxPct:        taxNum,
        unit:          form.unit,
        openingStock:  parseFloat(form.openingStock) || 0,
      });

      if (!res.success) { setError("Failed to save product."); return; }

      const p = res.data;

      // Build a ProductRow from the saved product and add it to the bill
      const discAmt = 0;
      const total   = +(spNum * 1 - discAmt + taxAmt).toFixed(2);
      const row: ProductRow = {
        id:        nanoid(),
        product:   p.name,
        code:      p.code,
        productId: p.id,
        qty:       1,
        mrp:       p.mrp,
        price:     p.salePrice,
        discPct:   0,
        discAmt:   0,
        taxPct:    p.taxPct,
        taxAmt,
        total,
      };

      setSuccess(true);
      // Brief success flash, then close and add to bill
      setTimeout(() => {
        onAdded(row);
        onClose();
      }, 600);

    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        style={{
          background: "#fff", borderRadius: 18,
          width: "100%", maxWidth: 480,
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          padding: "18px 22px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Add New Product to Bill</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                Saves to catalogue &amp; adds to current bill
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Form ──────────────────────────────────────── */}
        <div style={{ padding: "20px 22px 8px" }}>

          {/* Name — full width */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Product Name <span style={{ color: "#EF4444" }}>*</span></label>
            <input
              ref={nameRef}
              style={inp}
              type="text"
              placeholder="e.g. Basmati Rice 5kg"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
          </div>

          {/* Code + Barcode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Code / SKU <span style={{ color: "#EF4444" }}>*</span></label>
              <input style={inp} type="text" placeholder="e.g. RICE001"
                value={form.code} onChange={(e) => set("code", e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
            </div>
            <div>
              <label style={lbl}>Barcode <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <ScanLine size={13} color="#94A3B8" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
                <input style={{ ...inp, paddingLeft: 30 }} type="text" placeholder="EAN-13 or custom"
                  value={form.barcode} onChange={(e) => set("barcode", e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
              </div>
            </div>
          </div>

          {/* MRP + Sale Price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>MRP (₹)</label>
              <div style={{ position: "relative" }}>
                <span style={rpx}>₹</span>
                <input style={{ ...inp, paddingLeft: 24 }} type="text" inputMode="decimal"
                  placeholder="0.00" value={form.mrp} onChange={(e) => set("mrp", e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
              </div>
            </div>
            <div>
              <label style={lbl}>Sale Price (₹) <span style={{ color: "#EF4444" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <span style={rpx}>₹</span>
                <input style={{ ...inp, paddingLeft: 24 }} type="text" inputMode="decimal"
                  placeholder="0.00" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
              </div>
              {marginPct !== null && (
                <span style={{ fontSize: 11, color: "#22C55E", marginTop: 3, display: "block" }}>
                  {marginPct}% below MRP
                </span>
              )}
            </div>
          </div>

          {/* Tax + Unit + Opening Stock */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>GST %</label>
              <select style={inp} value={form.taxPct} onChange={(e) => set("taxPct", e.target.value)}>
                {TAX_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t === 0 ? "No Tax" : `GST ${t}%`}</option>
                ))}
              </select>
              {taxNum > 0 && spNum > 0 && (
                <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 3, display: "block" }}>
                  Tax: ₹{taxAmt.toFixed(2)}
                </span>
              )}
            </div>
            <div>
              <label style={lbl}>Unit</label>
              <select style={inp} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Opening Stock</label>
              <input style={inp} type="text" inputMode="decimal" placeholder="0"
                value={form.openingStock} onChange={(e) => set("openingStock", e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
            </div>
          </div>

          {/* Live bill preview strip */}
          {form.name && spNum > 0 && (
            <div style={{
              background: "rgba(249,115,22,0.06)", border: "1.5px solid rgba(249,115,22,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{form.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                  {form.code} · 1 {form.unit}
                  {taxNum > 0 && ` · GST ${taxNum}%`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {mrpNum > 0 && <div style={{ fontSize: 11, color: "#94A3B8", textDecoration: "line-through" }}>₹{mrpNum.toFixed(2)}</div>}
                <div style={{ fontSize: 16, fontWeight: 800, color: "#F97316" }}>₹{(spNum + taxAmt).toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 7, background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12, color: "#EF4444" }}>
                <AlertCircle size={13} /> {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div style={{ padding: "4px 22px 20px", display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", border: "1.5px solid #E2E8F0", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving || success}
            style={{
              flex: 2, padding: "11px 0", border: "none", borderRadius: 10,
              background: success ? "#22C55E" : saving ? "#FDA35C" : "#F97316",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: saving || success ? "not-allowed" : "pointer",
              fontFamily: "inherit", outline: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s",
            }}>
            {success
              ? <><CheckCircle2 size={15} /> Added to Bill!</>
              : saving
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                : <><Plus size={14} /> Save &amp; Add to Bill</>}
          </button>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box", transition: "border-color 0.15s" };
const rpx: React.CSSProperties = { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94A3B8", pointerEvents: "none" };
