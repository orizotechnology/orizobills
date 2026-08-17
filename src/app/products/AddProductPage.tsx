import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Package, ScanLine, Tag, IndianRupee,
  CheckCircle2, AlertCircle, Loader2, ArrowLeft,
  Layers, Percent, Ruler, Hash,
  Trash2, Plus, AlignLeft, AlignCenter, AlignRight, Bold, Printer, BarChart2, GripVertical,
} from "lucide-react";
import { http } from "@/lib/axios";
import { nanoid } from "nanoid";

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
const DISCOUNT_TYPES = ["Discount %", "Flat Discount"];

interface ApiResponse<T> { success: boolean; data: T; message?: string; }
interface Product {
  id: string; name: string; code: string; barcode: string | null;
  description: string | null; mrp: number; salePrice: number;
  taxPct: number; unit: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

type FormState = {
  // Basic
  name: string; code: string; barcode: string; description: string; hsn: string;
  // Pricing
  mrp: string; purchasePrice: string; salePrice: string;
  discPctOnMrp: string; saleDiscount: string; discountType: string;
  // Tax
  taxPct: string; taxRate: string; taxInclusive: boolean;
  // Units
  unit: string; secondaryUnit: string; conversionRate: string;
  // Inventory
  openingStock: string; lowStockAlert: string; location: string;
};

const EMPTY: FormState = {
  name: "", code: "", barcode: "", description: "", hsn: "",
  mrp: "", purchasePrice: "", salePrice: "",
  discPctOnMrp: "", saleDiscount: "", discountType: "Discount %",
  taxPct: "0", taxRate: "", taxInclusive: false,
  unit: "Nos", secondaryUnit: "", conversionRate: "",
  openingStock: "0", lowStockAlert: "5", location: "",
};

// ── Simple canvas barcode (Code128-style visual) ──────────────
function BarcodeVisual({ value, height = 48 }: { value: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const display = value || "000000000";
    const chars   = display.split("").map((c) => c.charCodeAt(0));
    const barW    = 2;
    const totalW  = chars.length * barW * 4 + 20;

    canvas.width  = totalW;
    canvas.height = height;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, totalW, height);

    let x = 10;
    chars.forEach((code, i) => {
      const w1 = i % 3 === 0 ? 3 : 2;
      const h1 = i % 2 === 0 ? height : Math.floor(height * 0.8);
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(x, 0, w1 * barW, h1);
      x += w1 * barW;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, 0, barW, height);
      x += barW * 2;
    });
  }, [value, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", imageRendering: "pixelated", maxWidth: "100%", height: "auto" }}
    />
  );
}

export default function AddProductPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");
  const [addAnother, setAddAnother] = useState(false);

  const isDirty = form.name !== "" || form.code !== "" || form.salePrice !== "";

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) navigate("/app/products/all"); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate, saving]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [field]: value }));

  // Derived values
  const mrpNum       = parseFloat(form.mrp)          || 0;
  const spNum        = parseFloat(form.salePrice)     || 0;
  const ppNum        = parseFloat(form.purchasePrice) || 0;
  const taxNum       = parseFloat(form.taxPct)        || 0;
  const discMrpNum   = parseFloat(form.discPctOnMrp)  || 0;
  const saleDiscNum  = parseFloat(form.saleDiscount)  || 0;
  const convNum      = parseFloat(form.conversionRate)|| 0;
  const taxAmt       = +(spNum * taxNum / 100).toFixed(2);
  const marginPct    = mrpNum > 0 && spNum > 0
    ? (((mrpNum - spNum) / mrpNum) * 100).toFixed(1)
    : null;
  const profitPct    = ppNum > 0 && spNum > 0
    ? (((spNum - ppNum) / ppNum) * 100).toFixed(1)
    : null;
  // Effective sale price after MRP disc
  const effectiveSP  = mrpNum > 0 && discMrpNum > 0
    ? +(mrpNum * (1 - discMrpNum / 100)).toFixed(2)
    : spNum;

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
        name:          form.name.trim(),
        code:          form.code.trim(),
        barcode:       form.barcode.trim()       || undefined,
        description:   form.description.trim()   || undefined,
        hsn:           form.hsn.trim()           || undefined,
        mrp:           mrpNum,
        purchasePrice: ppNum,
        salePrice:     spNum,
        discPctOnMrp:  discMrpNum,
        saleDiscount:  saleDiscNum,
        discountType:  form.discountType,
        taxPct:        taxNum,
        taxRate:       form.taxRate.trim()       || undefined,
        taxInclusive:  form.taxInclusive,
        unit:          form.unit,
        secondaryUnit: form.secondaryUnit        || undefined,
        conversionRate:convNum                   || undefined,
        location:      form.location.trim()      || undefined,
        openingStock:  parseFloat(form.openingStock)   || 0,
        lowStockAlert: parseFloat(form.lowStockAlert)  || 5,
      };
      const res = await http.post<ApiResponse<Product>>("/products", payload);
      if (!res.success) { setError("Failed to save product."); return; }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-map"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      setSuccess(true);
      if (andNew) {
        setTimeout(() => { setForm(EMPTY); setSuccess(false); }, 700);
      } else {
        setTimeout(() => navigate("/app/products/all"), 900);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product.");
    } finally { setSaving(false); }
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/app/products/all")} style={topIconBtn} title="Back">
            <ArrowLeft size={16} color="#64748B" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={14} color="#F97316" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>Add New Product</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Products catalogue</div>
            </div>
          </div>
        </div>
        <button onClick={() => navigate("/app/products/all")} style={topIconBtn} title="Close">
          <X size={16} color="#64748B" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Left: scrollable form ─────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 32px", minWidth: 0 }}>

          {/* ══ SECTION 1: Basic Info ══════════════════════ */}
          <SL icon={<Tag size={13} />} title="Basic Information" />
          <div style={{ ...g2, marginBottom: 22 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <FL required>Product Name</FL>
              <input style={inp} type="text" placeholder="e.g. Basmati Rice 5kg"
                value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus
                onFocus={fo} onBlur={fb} />
            </div>
            <div>
              <FL required>Product Code / SKU</FL>
              <input style={inp} type="text" placeholder="e.g. RICE001"
                value={form.code} onChange={(e) => set("code", e.target.value)}
                onFocus={fo} onBlur={fb} />
              <Hint>Unique identifier used in invoices</Hint>
            </div>
            <div>
              <FL>HSN Code <Opt /></FL>
              <input style={inp} type="text" placeholder="e.g. 1006"
                value={form.hsn} onChange={(e) => set("hsn", e.target.value)}
                onFocus={fo} onBlur={fb} />
              <Hint>Harmonised System of Nomenclature</Hint>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FL>Description <Opt /></FL>
              <textarea style={{ ...inp, resize: "none", height: 64, paddingTop: 9 }}
                placeholder="Product description, size, variant…"
                value={form.description} onChange={(e) => set("description", e.target.value)}
                onFocus={fo} onBlur={fb} />
            </div>
          </div>

          {/* ══ SECTION 2: Pricing ══════════════════════════ */}
          <SL icon={<IndianRupee size={13} />} title="Pricing" />
          <div style={{ ...g3, marginBottom: 22 }}>
            <div>
              <FL>Purchase Price (₹)</FL>
              <Rp><input style={{ ...inp, paddingLeft: 24 }} type="text" inputMode="decimal"
                placeholder="0.00" value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                onFocus={fo} onBlur={fb} /></Rp>
              {profitPct !== null && <Hint color="#22C55E">Margin: {profitPct}%</Hint>}
            </div>
            <div>
              <FL>MRP (₹)</FL>
              <Rp><input style={{ ...inp, paddingLeft: 24 }} type="text" inputMode="decimal"
                placeholder="0.00" value={form.mrp}
                onChange={(e) => set("mrp", e.target.value)}
                onFocus={fo} onBlur={fb} /></Rp>
              <Hint>Maximum retail price</Hint>
            </div>
            <div>
              <FL required>Sale Price (₹)</FL>
              <Rp><input style={{ ...inp, paddingLeft: 24 }} type="text" inputMode="decimal"
                placeholder="0.00" value={form.salePrice}
                onChange={(e) => set("salePrice", e.target.value)}
                onFocus={fo} onBlur={fb} /></Rp>
              {marginPct !== null && <Hint color="#22C55E">{marginPct}% below MRP</Hint>}
            </div>
          </div>

          {/* ══ SECTION 3: Discount ═════════════════════════ */}
          <SL icon={<Percent size={13} />} title="Discount" />
          <div style={{ ...g3, marginBottom: 22 }}>
            <div>
              <FL>Discount Type</FL>
              <select style={inp} value={form.discountType}
                onChange={(e) => set("discountType", e.target.value)}>
                {DISCOUNT_TYPES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <FL>Disc % on MRP</FL>
              <div style={{ position: "relative" }}>
                <input style={{ ...inp, paddingRight: 26 }} type="text" inputMode="decimal"
                  placeholder="0" value={form.discPctOnMrp}
                  onChange={(e) => set("discPctOnMrp", e.target.value)}
                  onFocus={fo} onBlur={fb} />
                <span style={pctSuffix}>%</span>
              </div>
              {discMrpNum > 0 && mrpNum > 0 && (
                <Hint color="#F97316">Effective price: ₹{effectiveSP.toFixed(2)}</Hint>
              )}
            </div>
            <div>
              <FL>Sale Discount</FL>
              <div style={{ position: "relative" }}>
                <input style={{ ...inp, paddingRight: form.discountType === "Discount %" ? 26 : 24 }}
                  type="text" inputMode="decimal"
                  placeholder="0" value={form.saleDiscount}
                  onChange={(e) => set("saleDiscount", e.target.value)}
                  onFocus={fo} onBlur={fb} />
                <span style={pctSuffix}>{form.discountType === "Discount %" ? "%" : "₹"}</span>
              </div>
            </div>
          </div>

          {/* ══ SECTION 4: Tax ══════════════════════════════ */}
          <SL icon={<Hash size={13} />} title="Tax" />
          <div style={{ ...g3, marginBottom: 22 }}>
            <div>
              <FL>GST / Tax %</FL>
              <select style={inp} value={form.taxPct}
                onChange={(e) => set("taxPct", e.target.value)}>
                {TAX_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t === 0 ? "No Tax (0%)" : `GST ${t}%`}</option>
                ))}
              </select>
              {taxNum > 0 && spNum > 0 && (
                <Hint>Tax amount: ₹{taxAmt.toFixed(2)}</Hint>
              )}
            </div>
            <div>
              <FL>Tax Rate Label <Opt /></FL>
              <input style={inp} type="text" placeholder="e.g. CGST+SGST, IGST"
                value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)}
                onFocus={fo} onBlur={fb} />
            </div>
            <div>
              <FL>Tax Inclusive</FL>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <Toggle on={form.taxInclusive} onToggle={() => set("taxInclusive", !form.taxInclusive)} />
                <span style={{ fontSize: 12, color: form.taxInclusive ? "#F97316" : "#94A3B8" }}>
                  {form.taxInclusive ? "Price includes tax" : "Tax added on top"}
                </span>
              </div>
            </div>
          </div>

          {/* ══ SECTION 5: Units & Qty ══════════════════════ */}
          <SL icon={<Ruler size={13} />} title="Units & Quantity" />
          <div style={{ ...g3, marginBottom: 10 }}>
            <div>
              <FL>Primary Unit</FL>
              <select style={inp} value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <FL>Secondary Unit <Opt /></FL>
              <select style={inp} value={form.secondaryUnit}
                onChange={(e) => set("secondaryUnit", e.target.value)}>
                <option value="">— None —</option>
                {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <FL>Conversion Rate <Opt /></FL>
              <input style={inp} type="text" inputMode="decimal"
                placeholder="e.g. 12 (1 Box = 12 Nos)"
                disabled={!form.secondaryUnit}
                value={form.conversionRate}
                onChange={(e) => set("conversionRate", e.target.value)}
                onFocus={fo} onBlur={fb}
              />
              {form.secondaryUnit && convNum > 0 && (
                <Hint>1 {form.unit} = {convNum} {form.secondaryUnit}</Hint>
              )}
              {!form.secondaryUnit && (
                <Hint>Select secondary unit first</Hint>
              )}
            </div>
          </div>
          <div style={{ ...g3, marginBottom: 22 }}>
            <div>
              <FL>Opening Stock</FL>
              <input style={inp} type="text" inputMode="decimal"
                placeholder="0" value={form.openingStock}
                onChange={(e) => set("openingStock", e.target.value)}
                onFocus={fo} onBlur={fb} />
            </div>
            <div>
              <FL>Low Stock Alert</FL>
              <input style={inp} type="text" inputMode="decimal"
                placeholder="5" value={form.lowStockAlert}
                onChange={(e) => set("lowStockAlert", e.target.value)}
                onFocus={fo} onBlur={fb} />
              <Hint>Alert when stock falls below this</Hint>
            </div>
            <div>
              <FL>Storage Location <Opt /></FL>
              <input style={inp} type="text" placeholder="e.g. Shelf A3, Rack 2"
                value={form.location} onChange={(e) => set("location", e.target.value)}
                onFocus={fo} onBlur={fb} />
            </div>
          </div>

          {/* ══ SECTION 6: Barcode Label Designer ══════════ */}
          <SL icon={<ScanLine size={13} />} title="Barcode Label Designer" />
          <BarcodeDesigner
            barcodeValue={form.barcode || form.code}
            productName={form.name}
            productCode={form.code}
            mrp={mrpNum}
            salePrice={spNum}
          />

        </div>

        {/* ── Right: live summary panel ─────────────────── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: "#fff", borderLeft: "1px solid #E2E8F0",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}>

          {/* Product card */}
          <div style={{ padding: "18px 16px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              Preview
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={16} color="#F97316" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.name ? "#0F172A" : "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.name || "Product name"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {form.code || "Code"}{form.unit ? ` · ${form.unit}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <PR label="Purchase Price" value={ppNum > 0 ? `₹${ppNum.toFixed(2)}` : "—"} />
                <PR label="MRP"            value={mrpNum > 0 ? `₹${mrpNum.toFixed(2)}` : "—"} muted />
                <PR label="Sale Price"     value={spNum > 0 ? `₹${spNum.toFixed(2)}` : "—"} highlight />
                <PR label={`GST (${taxNum}%)`} value={taxAmt > 0 ? `₹${taxAmt.toFixed(2)}` : "—"} muted />
              </div>
              {form.barcode && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, background: "#fff", borderRadius: 6, padding: "5px 8px", border: "1px solid #E2E8F0" }}>
                  <ScanLine size={11} color="#F97316" />
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#475569" }}>{form.barcode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details summary */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Details</div>
            {[
              { label: "Code",          value: form.code || "—" },
              { label: "HSN",           value: form.hsn  || "—" },
              { label: "Tax",           value: taxNum > 0 ? `${taxNum}% ${form.taxInclusive ? "(incl.)" : ""}` : "None" },
              { label: "Disc on MRP",   value: discMrpNum > 0 ? `${discMrpNum}%` : "—" },
              { label: "Sale Disc",     value: saleDiscNum > 0 ? `${saleDiscNum}${form.discountType === "Discount %" ? "%" : "₹"}` : "—" },
              { label: "Primary Unit",  value: form.unit },
              { label: "Sec. Unit",     value: form.secondaryUnit || "—" },
              { label: "Conv. Rate",    value: form.secondaryUnit && convNum > 0 ? `1:${convNum}` : "—" },
              { label: "Opening Stock", value: `${form.openingStock || 0} ${form.unit}` },
              { label: "Low Stock Alert", value: `${form.lowStockAlert || 5} ${form.unit}` },
              { label: "Location",      value: form.location || "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#1E293B", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Barcode mini */}
          {(form.barcode || form.code) && (
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Barcode</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BarcodeVisual value={form.barcode || form.code} height={36} />
              </div>
              <div style={{ textAlign: "center", fontSize: 10, fontFamily: "monospace", color: "#475569", marginTop: 4 }}>
                {form.barcode || form.code}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid #E2E8F0", padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, background: "#fff",
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <Toggle on={addAnother} onToggle={() => setAddAnother((p) => !p)} />
          <span style={{ fontSize: 13, color: "#64748B" }}>Save & add another</span>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#EF4444" }}>
                <AlertCircle size={13} /> {error}
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => navigate("/app/products/all")} disabled={saving}
            style={{ border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none" }}>
            Cancel
          </button>
          <button onClick={() => void handleSave(addAnother)} disabled={saving || success}
            style={{ background: success ? "#22C55E" : saving ? "#FDA35C" : "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 32px", fontSize: 13, fontWeight: 700, cursor: saving || success ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none", display: "flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}>
            {success
              ? <><CheckCircle2 size={15} /> Saved!</>
              : saving
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                : addAnother ? "Save & Add Another" : "Save Product"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body > * { display: none !important; }
          .barcode-print-area { display: flex !important; flex-wrap: wrap; gap: 12px; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SL({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(249,115,22,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316" }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9", marginLeft: 6 }} />
    </div>
  );
}

function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
      {children}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function Opt() {
  return <span style={{ color: "#94A3B8", fontWeight: 400, marginLeft: 4 }}>(optional)</span>;
}

function Hint({ children, color = "#94A3B8" }: { children: React.ReactNode; color?: string }) {
  return <span style={{ display: "block", fontSize: 11, color, marginTop: 4 }}>{children}</span>;
}

function PR({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: highlight ? 15 : 12, fontWeight: highlight ? 800 : 500, color: highlight ? "#F97316" : muted ? "#94A3B8" : "#1E293B" }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 34, height: 20, borderRadius: 10, position: "relative", cursor: "pointer", background: on ? "#F97316" : "#E2E8F0", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

function Rp({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94A3B8", pointerEvents: "none" }}>₹</span>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 9,
  padding: "9px 12px", fontSize: 13, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", boxSizing: "border-box", transition: "border-color 0.15s",
};
const g2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const g3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 };
const topIconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", outline: "none" };
const pctSuffix: React.CSSProperties = { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94A3B8", pointerEvents: "none" };

// focus/blur handlers
const fo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#F97316"; };
const fb = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#E2E8F0"; };

// =============================================================
// =============================================================
// BARCODE LABEL DESIGNER
// Full interactive label builder — custom text rows, checkboxes,
// font controls, size, copies, live preview, print.
// =============================================================

interface LabelRow {
  id: string;
  text: string;          // text content (can use placeholders)
  enabled: boolean;      // checkbox — show on label
  fontSize: number;      // 8–18
  bold: boolean;
  align: "left" | "center" | "right";
}

interface DesignerProps {
  barcodeValue: string;
  productName: string;
  productCode: string;
  mrp: number;
  salePrice: number;
}

const DEFAULT_ROWS: LabelRow[] = [
  { id: "r1", text: "{name}",       enabled: true,  fontSize: 10, bold: true,  align: "center" },
  { id: "r2", text: "{code}",       enabled: true,  fontSize: 9,  bold: false, align: "center" },
  { id: "r3", text: "MRP: ₹{mrp}",  enabled: false, fontSize: 9,  bold: false, align: "center" },
  { id: "r4", text: "₹{price}",     enabled: true,  fontSize: 11, bold: true,  align: "center" },
];

function resolvePlaceholders(
  text: string,
  ctx: { name: string; code: string; mrp: number; price: number; barcode: string }
): string {
  return text
    .replace(/\{name\}/g,    ctx.name    || "—")
    .replace(/\{code\}/g,    ctx.code    || "—")
    .replace(/\{mrp\}/g,     ctx.mrp > 0 ? ctx.mrp.toFixed(2) : "—")
    .replace(/\{price\}/g,   ctx.price > 0 ? ctx.price.toFixed(2) : "—")
    .replace(/\{barcode\}/g, ctx.barcode || ctx.code || "—");
}

export function BarcodeDesigner({ barcodeValue, productName, productCode, mrp, salePrice }: DesignerProps) {
  const [rows,    setRows]    = useState<LabelRow[]>(DEFAULT_ROWS);
  const [copies,  setCopies]  = useState("1");
  const [labelW,  setLabelW]  = useState("50");   // mm
  const [labelH,  setLabelH]  = useState("30");   // mm
  const [showBar, setShowBar] = useState(true);
  const [showNum, setShowNum] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const ctx = {
    name:    productName,
    code:    productCode,
    mrp,
    price:   salePrice,
    barcode: barcodeValue,
  };

  const addRow = () => {
    setRows((p) => [
      ...p,
      { id: nanoid(6), text: "Custom text", enabled: true, fontSize: 10, bold: false, align: "center" },
    ]);
  };

  const deleteRow = (id: string) => setRows((p) => p.filter((r) => r.id !== id));

  const updateRow = <K extends keyof LabelRow>(id: string, field: K, value: LabelRow[K]) =>
    setRows((p) => p.map((r) => r.id === id ? { ...r, [field]: value } : r));

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open("", "_blank", "width=900,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Barcode Labels</title>
      <style>
        body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
        .label-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .label-card { border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px;
                      display: flex; flex-direction: column; align-items: center; gap: 3px;
                      width: ${labelW}mm; height: ${labelH}mm; overflow: hidden; box-sizing: border-box; }
        canvas { max-width: 100%; height: auto; display: block; image-rendering: pixelated; }
      </style></head>
      <body><div class="label-grid">${html}</div>
      <script>window.onload=()=>window.print()</script></body></html>
    `);
    w.document.close();
  };

  const copiesNum = Math.max(1, parseInt(copies) || 1);

  return (
    <div style={{
      background: "#F8FAFC", border: "1px solid #E2E8F0",
      borderRadius: 12, overflow: "hidden", marginBottom: 28,
    }}>
      {/* ── Header bar ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "#fff",
        borderBottom: "1px solid #E2E8F0",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 7 }}>
          <BarChart2 size={14} color="#F97316" /> Label Designer
        </span>
        <button
          type="button" onClick={handlePrint}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: "#F97316", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
          <Printer size={13} /> Print Labels
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0 }}>

        {/* ── Left: Controls ────────────────────────────── */}
        <div style={{ padding: "16px 18px", borderRight: "1px solid #E2E8F0" }}>

          {/* Label size + copies row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 80 }}>
              <div style={ctrlLabel}>Width (mm)</div>
              <input style={ctrlInp} type="text" inputMode="decimal"
                value={labelW} onChange={(e) => setLabelW(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <div style={ctrlLabel}>Height (mm)</div>
              <input style={ctrlInp} type="text" inputMode="decimal"
                value={labelH} onChange={(e) => setLabelH(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <div style={ctrlLabel}>Copies</div>
              <input style={ctrlInp} type="text" inputMode="numeric"
                value={copies} onChange={(e) => setCopies(e.target.value)} />
            </div>
          </div>

          {/* Barcode options */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <CheckRow
              checked={showBar}
              onToggle={() => setShowBar((p) => !p)}
              label="Show barcode bars"
            />
            <CheckRow
              checked={showNum}
              onToggle={() => setShowNum((p) => !p)}
              label="Show barcode number"
            />
          </div>

          {/* Text rows */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
              Label Rows
              <span style={{ fontSize: 10, fontWeight: 400, color: "#94A3B8", marginLeft: 6, textTransform: "none" }}>
                Use {"{name}"}, {"{code}"}, {"{mrp}"}, {"{price}"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((row, idx) => (
                <div key={row.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 8, padding: "8px 10px",
                }}>
                  {/* Drag handle (visual only) */}
                  <GripVertical size={14} color="#CBD5E1" style={{ flexShrink: 0, cursor: "grab" }} />

                  {/* Enable checkbox */}
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(row.id, "enabled", e.target.checked)}
                    style={{ width: 14, height: 14, cursor: "pointer", flexShrink: 0, accentColor: "#F97316" }}
                  />

                  {/* Text input */}
                  <input
                    type="text"
                    value={row.text}
                    onChange={(e) => updateRow(row.id, "text", e.target.value)}
                    placeholder={`Row ${idx + 1}`}
                    style={{
                      flex: 1, border: "1.5px solid #E2E8F0", borderRadius: 6,
                      padding: "5px 8px", fontSize: 12, color: "#1E293B",
                      outline: "none", fontFamily: "inherit", background: "#F8FAFC",
                      opacity: row.enabled ? 1 : 0.4,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
                  />

                  {/* Font size */}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={String(row.fontSize)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 10;
                      updateRow(row.id, "fontSize", Math.min(18, Math.max(7, v)));
                    }}
                    style={{ width: 38, border: "1.5px solid #E2E8F0", borderRadius: 6, padding: "5px 6px", fontSize: 12, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", textAlign: "center" }}
                    title="Font size"
                  />

                  {/* Bold */}
                  <button type="button"
                    onClick={() => updateRow(row.id, "bold", !row.bold)}
                    title="Bold"
                    style={{ width: 26, height: 26, borderRadius: 5, border: `1.5px solid ${row.bold ? "#F97316" : "#E2E8F0"}`, background: row.bold ? "rgba(249,115,22,0.08)" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bold size={12} color={row.bold ? "#F97316" : "#94A3B8"} />
                  </button>

                  {/* Align */}
                  {(["left", "center", "right"] as const).map((a) => {
                    const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                    return (
                      <button key={a} type="button"
                        onClick={() => updateRow(row.id, "align", a)}
                        title={a}
                        style={{ width: 26, height: 26, borderRadius: 5, border: `1.5px solid ${row.align === a ? "#F97316" : "#E2E8F0"}`, background: row.align === a ? "rgba(249,115,22,0.08)" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={11} color={row.align === a ? "#F97316" : "#94A3B8"} />
                      </button>
                    );
                  })}

                  {/* Delete */}
                  <button type="button" onClick={() => deleteRow(row.id)} title="Delete row"
                    style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#CBD5E1" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <button type="button" onClick={addRow}
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#F97316", background: "rgba(249,115,22,0.06)", border: "1.5px dashed rgba(249,115,22,0.3)", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
              <Plus size={13} /> Add Text Row
            </button>
          </div>
        </div>

        {/* ── Right: Live Preview ────────────────────────── */}
        <div style={{ width: 340, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            Preview ({copiesNum} {copiesNum === 1 ? "copy" : "copies"})
          </div>

          {/* Scrollable preview area */}
          <div ref={printRef} style={{
            display: "flex", flexWrap: "wrap", gap: 8,
            maxHeight: 360, overflowY: "auto",
            padding: 4,
          }}>
            {Array.from({ length: Math.min(copiesNum, 12) }).map((_, i) => (
              <LabelCard
                key={i}
                rows={rows}
                ctx={ctx}
                showBar={showBar}
                showNum={showNum}
                widthMm={parseFloat(labelW) || 50}
                heightMm={parseFloat(labelH) || 30}
              />
            ))}
            {copiesNum > 12 && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "#94A3B8", fontStyle: "italic", alignSelf: "center" }}>
                + {copiesNum - 12} more (shown on print)
              </div>
            )}
          </div>

          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
            Label size: {labelW} × {labelH} mm &nbsp;·&nbsp; Click "Print Labels" to print
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single label card ────────────────────────────────────────

function LabelCard({
  rows, ctx, showBar, showNum, widthMm, heightMm,
}: {
  rows: LabelRow[];
  ctx: { name: string; code: string; mrp: number; price: number; barcode: string };
  showBar: boolean;
  showNum: boolean;
  widthMm: number;
  heightMm: number;
}) {
  // Scale mm → px for preview (1mm ≈ 3.78px at 96dpi, we use 2.2 for compact display)
  const scale = 2.2;
  const w = Math.round(widthMm * scale);
  const h = Math.round(heightMm * scale);

  return (
    <div style={{
      width: w, height: h,
      background: "#fff", border: "1px solid #E2E8F0",
      borderRadius: 5, padding: "5px 6px",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 2,
      overflow: "hidden", flexShrink: 0, boxSizing: "border-box",
    }}>
      {showBar && (
        <BarcodeVisual value={ctx.barcode || ctx.code || "000000000"} height={Math.max(20, Math.round(h * 0.38))} />
      )}
      {showNum && (
        <div style={{ fontSize: 8, fontFamily: "monospace", color: "#0F172A", letterSpacing: "0.02em" }}>
          {ctx.barcode || ctx.code || "000000000"}
        </div>
      )}
      {rows.filter((r) => r.enabled && r.text.trim()).map((row) => (
        <div key={row.id} style={{
          fontSize: row.fontSize,
          fontWeight: row.bold ? 700 : 400,
          color: "#0F172A",
          textAlign: row.align,
          width: "100%",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}>
          {resolvePlaceholders(row.text, ctx)}
        </div>
      ))}
    </div>
  );
}

// ── CheckRow ─────────────────────────────────────────────────
function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#F97316" }}
      />
      <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
    </label>
  );
}

// ── Styles ────────────────────────────────────────────────────
const ctrlLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 };
const ctrlInp:   React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
