import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { AnimatePresence } from "framer-motion";
import { Plus, Upload, ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";
import { ItemRow } from "./components/ItemRow";
import { AddProductModal } from "./components/AddProductModal";
import type { PurchaseRow, ProductOption, Supplier, PurchasePayload } from "./purchase.types";
import { calcRow } from "./purchase.types";

// =============================================================
// PURCHASE ENTRY PAGE — Full-screen, production-grade
// =============================================================

interface ApiResponse<T> { success: boolean; data: T; message?: string; error?: { message: string }; }

function makeRow(): PurchaseRow {
  return { id: nanoid(), productId: "", item: "", code: "", count: "", mrp: 0, size: "", qty: 1, unit: "NONE", priceUnit: 0, discPct: 0, discAmt: 0, taxPct: "", taxAmt: 0, amount: 0 };
}

export default function PurchaseEntryPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  // ── Form state ──────────────────────────────────────────────
  const [party,     setParty]     = useState("");
  const [_partyId,  setPartyId]   = useState("");
  const [partyBal,  setPartyBal]  = useState(0);
  const [poNo,      setPoNo]      = useState("");
  const [poDate,    setPoDate]    = useState("");
  const [billDate,  setBillDate]  = useState(new Date().toISOString().slice(0, 10));
  const [billNo,    setBillNo]    = useState("PUR0001");
  const [terms,     setTerms]     = useState("Purchase Bill");
  const [termsNote, setTermsNote] = useState("Thanks for doing business with us!");
  const [payType,   setPayType]   = useState("Cash");
  const [notes,     setNotes]     = useState("");
  const [discPct,   setDiscPct]   = useState("0");
  const [taxType,   setTaxType]   = useState("NONE");
  const [rows,      setRows]      = useState<PurchaseRow[]>([{ ...makeRow(), id: "flash" }, makeRow()]);

  // ── Data state ───────────────────────────────────────────────
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [products,   setProducts]   = useState<ProductOption[]>([]);
  const [showAddProd, setShowAddProd] = useState(false);
  const [addProdPrefill, setAddProdPrefill] = useState("");
  const [addProdRowId,   setAddProdRowId]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [feedback,  setFeedback]  = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

  // ── Fetch initial data ───────────────────────────────────────
  useEffect(() => {
    // Fetch next bill number
    http.get<ApiResponse<{ number: string }>>("/purchases/next-number")
      .then((r) => { if (r.success) setBillNo(r.data.number); })
      .catch(() => {});

    // Fetch products (all active, no pagination limit)
    http.get<ApiResponse<{ data: ProductOption[] } | ProductOption[]>>("/products?pageSize=9999&filter=active")
      .then((r) => {
        if (r.success) {
          const raw = r.data;
          setProducts(Array.isArray(raw) ? raw : (raw as { data: ProductOption[] }).data ?? []);
        }
      })
      .catch(() => {});

    // Fetch suppliers
    http.get<ApiResponse<Supplier[]>>("/suppliers")
      .then((r) => { if (r.success) setSuppliers(r.data); })
      .catch(() => {});
  }, []);

  // ── Totals ───────────────────────────────────────────────────
  const totalQty    = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalDisc   = rows.reduce((s, r) => s + r.discAmt, 0);
  const totalTax    = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalAmt    = rows.reduce((s, r) => s + r.amount, 0);
  const billDisc    = totalAmt * (parseFloat(discPct) || 0) / 100;
  const grandTotal  = +(totalAmt - billDisc).toFixed(2);

  // ── Row operations ───────────────────────────────────────────
  const addRow = () => setRows((p) => [...p, makeRow()]);

  const removeRow = useCallback((id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, updated: PurchaseRow) => {
    setRows((p) => p.map((r) => r.id === id ? updated : r));
  }, []);

  // ── Add product callback ─────────────────────────────────────
  const handleOpenAddProduct = (prefill: string, rowId: string) => {
    setAddProdPrefill(prefill);
    setAddProdRowId(rowId);
    setShowAddProd(true);
  };

  const handleProductCreated = (p: ProductOption) => {
    setProducts((prev) => [...prev, p]);
    setShowAddProd(false);
    // Auto-fill the row that triggered add
    if (addProdRowId) {
      setRows((prev) => prev.map((r) =>
        r.id === addProdRowId
          ? calcRow({ ...r, productId: p.id, item: p.name, code: p.code, mrp: p.mrp, priceUnit: p.salePrice, unit: p.unit, taxPct: String(p.taxPct) })
          : r
      ));
    }
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = (): string | null => {
    if (!party.trim()) return "Please select or enter a supplier.";
    const validRows = rows.filter((r) => r.item.trim());
    if (validRows.length === 0) return "Please add at least one item.";
    return null;
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { setFeedback({ type: "error", msg: err }); setTimeout(() => setFeedback(null), 3000); return; }

    setSaving(true);
    setFeedback(null);

    const validRows = rows.filter((r) => r.item.trim());
    const payload: PurchasePayload = {
      supplierName: party.trim(),
      billNumber: billNo,
      billDate,
      poNumber: poNo || undefined,
      poDate: poDate || undefined,
      paymentMethod: payType,
      discountPct: parseFloat(discPct) || 0,
      taxType,
      terms: terms || undefined,
      notes: notes || undefined,
      items: validRows.map((r) => ({
        itemName:    r.item,
        itemCode:    r.code,
        quantity:    Number(r.qty),
        unit:        r.unit,
        mrp:         parseFloat(String(r.mrp)) || 0,
        unitPrice:   parseFloat(String(r.priceUnit)) || 0,
        discountPct: parseFloat(String(r.discPct)) || 0,
        discountAmt: r.discAmt,
        taxPercent:  parseFloat(String(r.taxPct)) || 0,
        taxAmount:   r.taxAmt,
        totalAmount: r.amount,
      })),
    };

    try {
      const res = await http.post<ApiResponse<unknown>>("/purchases", payload);
      if (res.success) {
        setFeedback({ type: "success", msg: "Purchase saved successfully!" });
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        setTimeout(() => navigate("/app/purchase/all"), 1200);
      } else {
        setFeedback({ type: "error", msg: "Failed to save purchase." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save purchase.";
      setFeedback({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = supplierQuery.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(supplierQuery.toLowerCase()))
    : suppliers.slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 13, overflow: "hidden" }}>

      {/* ── Feedback toast ──────────────────────────────── */}
      <AnimatePresence>
        {feedback && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 3000,
            background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2",
            border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`,
            borderRadius: 10, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: 13, fontWeight: 600,
            color: feedback.type === "success" ? "#16A34A" : "#EF4444",
          }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}
      </AnimatePresence>

      {/* ── Page header ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 8px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Purchase</span>
        <button
          onClick={() => navigate("/app/purchase/all")}
          style={{ width: 26, height: 26, borderRadius: "50%", background: "#EF4444", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, outline: "none" }}
        >×</button>
      </div>

      {/* ── Top fields ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 18px 8px", gap: 20, borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 14, flex: 1, flexWrap: "wrap" }}>

          {/* Party */}
          <div>
            <label style={lbl}>Party <span style={{ color: "#EF4444" }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, width: 170 }}
                placeholder="Select party..."
                value={supplierQuery || party}
                onChange={(e) => { setSupplierQuery(e.target.value); setParty(e.target.value); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 160)}
              />
              {showSupplierDrop && filteredSuppliers.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 200 }}>
                  {filteredSuppliers.map((s) => (
                    <div key={s.id}
                      onMouseDown={() => { setParty(s.name); setPartyId(s.id); setPartyBal(s.balance ?? 0); setSupplierQuery(""); setShowSupplierDrop(false); }}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F8FAFC" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.balance !== undefined && <span style={{ float: "right", color: "#F97316", fontSize: 12 }}>₹{s.balance}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#F97316", marginTop: 2 }}>BAL: {partyBal}</div>
          </div>

          {/* PO No */}
          <div>
            <label style={lbl}>PO No.</label>
            <input style={{ ...inp, width: 110 }} placeholder="PO No." value={poNo} onChange={(e) => setPoNo(e.target.value)} />
          </div>

          {/* PO Date */}
          <div>
            <label style={lbl}>PO Date</label>
            <input style={{ ...inp, width: 130 }} type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
        </div>

        {/* Bill info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#64748B" }}>Bill Number <span style={{ fontWeight: 700, color: "#1E293B", marginLeft: 6 }}>{billNo}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Bill Date</span>
            <input style={{ ...inp, width: 130 }} type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Time <span style={{ fontWeight: 600, color: "#1E293B", marginLeft: 6 }}>{timeStr}</span></div>
        </div>
      </div>

      {/* ── Item table ──────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["#","ITEM","ITEM CODE","COUNT","MRP","SIZE","QTY","UNIT","PRICE/UNIT","DISC %","DISC AMT","TAX %","TAX AMT","AMOUNT",""].map((h, i) => (
                <th key={i} style={{ padding: "7px 6px", textAlign: i === 0 || i === 14 ? "center" : "left", fontSize: 10, fontWeight: 700, color: "#94A3B8", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#F8FAFC", borderRight: "1px solid #F1F5F9" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <ItemRow
                key={row.id}
                row={row}
                index={idx}
                isFlash={row.id === "flash"}
                products={products}
                canRemove={rows.length > 1}
                onChange={updateRow}
                onRemove={removeRow}
                onAddProduct={handleOpenAddProduct}
              />
            ))}
            {/* Totals */}
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC", fontWeight: 700 }}>
              <td colSpan={6} style={{ padding: "7px 8px", fontSize: 12, color: "#1E293B" }}>TOTAL</td>
              <td style={{ padding: "7px 6px", textAlign: "right" }}>{totalQty}</td>
              <td /><td /><td />
              <td style={{ padding: "7px 8px", textAlign: "right" }}>{totalDisc.toFixed(2)}</td>
              <td />
              <td style={{ padding: "7px 8px", textAlign: "right" }}>{totalTax.toFixed(2)}</td>
              <td style={{ padding: "7px 8px", textAlign: "right" }}>{totalAmt.toFixed(2)}</td>
              <td />
            </tr>
          </tbody>
        </table>

        {/* Add Row */}
        <button onClick={addRow} style={{ display: "flex", alignItems: "center", gap: 5, margin: "8px 14px", background: "none", border: "none", color: "#F97316", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          <Plus size={14} strokeWidth={2.5} /> ADD ROW
        </button>
      </div>

      {/* ── Bottom section ───────────────────────────────── */}
      <div style={{ borderTop: "1px solid #E2E8F0", padding: "12px 18px", display: "flex", alignItems: "flex-start", gap: 24, flexShrink: 0 }}>

        {/* Terms */}
        <div style={{ width: 155, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Terms &amp; Conditions</div>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 3 }}>Info</div>
          <input style={{ ...inp, width: "100%", marginBottom: 5, fontSize: 11 }} value={terms} onChange={(e) => setTerms(e.target.value)} />
          <textarea style={{ ...inp, width: "100%", height: 54, resize: "none", fontSize: 11 }} value={termsNote} onChange={(e) => setTermsNote(e.target.value)} />
        </div>

        {/* Payment */}
        <div style={{ width: 155, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Payment Type</div>
          <select style={{ ...inp, width: "100%", marginBottom: 8 }} value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Credit</option>
          </select>
          <div style={{ fontSize: 11, color: "#F97316", cursor: "pointer", marginBottom: 5 }}>📎 ADD DESCRIPTION</div>
          <textarea style={{ ...inp, width: "100%", height: 40, resize: "none", fontSize: 11 }} placeholder="Add notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Summary */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" value={discPct} onChange={(e) => setDiscPct(e.target.value)} style={{ ...inp, width: 58, textAlign: "right", fontSize: 12 }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
              <span style={{ fontSize: 12, color: "#64748B", width: 44, textAlign: "right" }}>({billDisc.toFixed(0)})</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Tax</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <select style={{ ...inp, width: 80, fontSize: 12 }} value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                <option>NONE</option><option>5%</option><option>12%</option><option>18%</option>
              </select>
              <span style={{ fontSize: 12, color: "#64748B", width: 44, textAlign: "right" }}>0</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #E2E8F0", paddingTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#F97316" }}>
              ₹{grandTotal === 0 ? "0" : grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #E2E8F0", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E8F0", borderRadius: 7, background: "#fff", color: "#475569", padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          <Upload size={14} /> Upload Bill
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E8F0", borderRadius: 7, background: "#fff", color: "#475569", padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            Print <ChevronDown size={13} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: saving ? "#FDA35C" : "#F97316", color: "#fff", border: "none", borderRadius: 7, padding: "7px 28px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProd && (
          <AddProductModal
            prefill={addProdPrefill}
            onCreated={handleProductCreated}
            onClose={() => setShowAddProd(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 };
const inp: React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#fff" };
