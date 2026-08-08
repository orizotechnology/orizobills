import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, RotateCcw, Printer, X, Loader2, CheckCircle2,
  AlertCircle, Banknote, Layers, CreditCard, ScanLine,
  UserRound, Plus, Trash2,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";
import { useDialogKeyboard } from "@/hooks";

// =============================================================
// SALE RETURN ENTRY PAGE
// Full-page UI matching POS architecture.
// Opens when user clicks "+ New Return" on SaleReturnPage.
//
// Key differences from POS:
//   - Items being returned come BACK into inventory (stockIn++)
//   - Payment section shows "Refund Method" instead of payment
//   - Saves to POST /api/sales/returns
//   - After save navigates back to /app/sales/returns
// =============================================================

interface ReturnItem {
  id:        string;
  product:   string;
  code:      string;
  productId?: string;
  qty:       number;
  mrp:       number;
  price:     number;
  discPct:   number;
  discAmt:   number;
  taxPct:    number;
  taxAmt:    number;
  total:     number;
}

interface Product {
  id: string; name: string; code: string;
  barcode: string | null; mrp: number;
  salePrice: number; taxPct: number; unit: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtNum(n: number): string {
  const s = n.toFixed(2);
  return s.endsWith(".00") ? String(Math.round(n)) : s;
}

const SCANNER_MS = 80;

// ── Return Search Bar ─────────────────────────────────────────
function ReturnSearchBar({ onAdd }: { onAdd: (p: Product) => void }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [scanFlash, setScanFlash] = useState<"ok" | "err" | null>(null);

  const inputRef   = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const debRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey    = useRef(0);
  const isScan     = useRef(false);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "F1") { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const addItem = useCallback((p: Product) => {
    onAdd(p);
  }, [onAdd]);

  const lookupExact = useCallback(async (code: string): Promise<boolean> => {
    try {
      const res = await http.get<{ success: boolean; data: Product }>(`/products/barcode/${encodeURIComponent(code.trim())}`);
      if (res.success && res.data) { addItem(res.data); setScanFlash("ok"); setTimeout(() => setScanFlash(null), 700); return true; }
    } catch { /* fall */ }
    return false;
  }, [addItem]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    try {
      const res = await http.get<{ success: boolean; data: Product[] }>(`/products`, { params: { search: q.trim() } });
      if (res.success && Array.isArray(res.data)) { setResults(res.data.slice(0, 12)); setShowDrop(res.data.length > 0); setActiveIdx(-1); }
    } catch { setResults([]); } finally { setSearching(false); }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now(); const gap = now - lastKey.current; lastKey.current = now;
    if (e.key !== "Enter" && e.key.length === 1) {
      if (gap < SCANNER_MS) isScan.current = true;
      else if (query.length === 0) isScan.current = false;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (isScan.current && query.trim()) {
        const code = query.trim(); setQuery(""); setShowDrop(false); isScan.current = false;
        if (debRef.current) clearTimeout(debRef.current);
        lookupExact(code).then((f) => { if (!f) { setScanFlash("err"); setTimeout(() => setScanFlash(null), 1000); } });
      } else if (showDrop && activeIdx >= 0) {
        addItem(results[activeIdx]); setQuery(""); setResults([]); setShowDrop(false);
      } else if (query.trim() && results.length > 0) {
        addItem(results[0]); setQuery(""); setResults([]); setShowDrop(false);
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") { setShowDrop(false); setQuery(""); }
  }, [query, showDrop, activeIdx, results, addItem, lookupExact]);

  const borderColor = scanFlash === "ok" ? "#22C55E" : scanFlash === "err" ? "#EF4444" : showDrop ? "#F97316" : "#CBD5E1";

  return (
    <div style={{ padding: "10px 14px 0", background: "#fff", flexShrink: 0, position: "relative", zIndex: 200 }}>
      <div style={{ position: "relative", width: "100%" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}>
          {scanFlash === "ok" ? <CheckCircle2 size={18} color="#22C55E" /> : scanFlash === "err" ? <ScanLine size={18} color="#EF4444" /> : searching ? <Loader2 size={18} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} /> : <Search size={18} color="#94A3B8" />}
        </div>
        <input ref={inputRef} type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); if (debRef.current) clearTimeout(debRef.current); debRef.current = setTimeout(() => { if (!isScan.current) doSearch(e.target.value); }, 220); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length) setShowDrop(true); }}
          placeholder="Search product to return or scan barcode — press F1 to focus"
          autoComplete="off"
          style={{ width: "100%", height: 44, border: `2px solid ${borderColor}`, borderRadius: 10, padding: "0 100px 0 44px", fontSize: 14, color: "#1E293B", background: "#FAFAFA", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <div style={{ position: "absolute", right: 10, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
          {scanFlash === "ok" && <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.10)", borderRadius: 5, padding: "2px 7px" }}>Added ✓</span>}
          {scanFlash === "err" && <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,0.10)", borderRadius: 5, padding: "2px 7px" }}>Not found</span>}
          {!scanFlash && !searching && (
            <><span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", borderRadius: 5, padding: "2px 6px" }}>F1</span><span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", borderRadius: 5, padding: "2px 6px" }}>SCAN</span></>
          )}
        </div>
        <AnimatePresence>
          {showDrop && results.length > 0 && (
            <motion.div ref={dropRef} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.13)", maxHeight: 320, overflowY: "auto", zIndex: 500 }}>
              <div style={{ padding: "7px 14px 6px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 11, color: "#CBD5E1" }}>↑↓ navigate · Enter to add</span>
              </div>
              {results.map((p, idx) => (
                <div key={p.id} onClick={() => { addItem(p); setQuery(""); setResults([]); setShowDrop(false); inputRef.current?.focus(); }} onMouseEnter={() => setActiveIdx(idx)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", cursor: "pointer", background: idx === activeIdx ? "#FFF7ED" : "transparent", borderBottom: "1px solid #F8FAFC" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, display: "flex", gap: 8 }}>
                      <span>{p.code}</span>{p.unit && <span>· {p.unit}</span>}{p.taxPct > 0 && <span>· GST {p.taxPct}%</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#F97316" }}>₹{p.salePrice.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main Return Entry Page ────────────────────────────────────
export default function ReturnEntryPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [rows,        setRows]        = useState<ReturnItem[]>([]);
  const [customer,    setCustomer]    = useState("");
  const [reason,      setReason]      = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [refundMethod, setRefundMethod] = useState<"Cash" | "UPI" | "Bank Transfer">("Cash");
  const [saving,      setSaving]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [feedback,    setFeedback]    = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Add product to return items
  const addProduct = useCallback((p: Product) => {
    setRows(prev => {
      const existing = prev.find(r => r.productId === p.id);
      if (existing) {
        return prev.map(r => r.productId === p.id ? recalc({ ...r, qty: r.qty + 1 }) : r);
      }
      const taxAmt = Math.round((p.salePrice * p.taxPct / 100) * 100) / 100;
      return [...prev, recalc({
        id: nanoid(), product: p.name, code: p.code, productId: p.id,
        qty: 1, mrp: p.mrp, price: p.salePrice,
        discPct: 0, discAmt: 0, taxPct: p.taxPct, taxAmt, total: p.salePrice + taxAmt,
      })];
    });
  }, []);

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id: string, field: keyof ReturnItem, val: number | string) => {
    setRows(prev => prev.map(r => r.id !== id ? r : recalc({ ...r, [field]: val })));
  };

  // Totals
  const disc       = parseFloat(discountPct) || 0;
  const subTotal   = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const discAmt    = subTotal * disc / 100;
  const taxTotal   = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalRefund = Math.max(0, subTotal - discAmt + taxTotal);
  const totalItems = rows.length;
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);

  const fmtAmt = (n: number) => { const s = n.toFixed(2); return s.endsWith(".00") ? String(Math.round(n)) : s; };

  // Save return
  const handleSave = useCallback(async () => {
    if (!rows.length) { setFeedback({ type: "error", msg: "Add at least one item to return." }); setTimeout(() => setFeedback(null), 3000); return; }
    setSaving(true);
    try {
      const res = await http.post<{ success: boolean; data: { returnNumber: string } }>("/sales/returns", {
        customerName: customer.trim() || "Walk-in Customer",
        returnDate:   new Date().toISOString(),
        reason:       reason || undefined,
        items: rows.map(r => ({
          productId:   r.productId, itemName: r.product, itemCode: r.code,
          quantity:    r.qty,       unitPrice: r.price,  totalAmount: r.total,
        })),
      });
      if (res.success) {
        setFeedback({ type: "success", msg: `Return ${res.data?.returnNumber ?? ""} saved!` });
        qc.invalidateQueries({ queryKey: ["sale-returns"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
        setTimeout(() => navigate("/app/sales/returns"), 1500);
      } else {
        setFeedback({ type: "error", msg: "Failed to save return." });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed" });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setSaving(false); }
  }, [rows, customer, reason, navigate, qc]);

  // F2 = save, Escape = confirm close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); void handleSave(); }
      if (e.key === "Escape" && !showConfirm) { setShowConfirm(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleSave, showConfirm]);

  // Enter = confirm close (Yes, Close), Escape = cancel (Stay)
  useDialogKeyboard({
    isOpen:    showConfirm,
    onConfirm: () => navigate("/app/sales/returns"),
    onCancel:  () => setShowConfirm(false),
    disabled:  saving,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Top bar ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 16, padding: "0 14px", height: 48, background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #E2E8F0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, objectFit: "contain" }} onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = "none"; const p = el.parentElement; if (p) { p.style.background = "#EF4444"; p.innerHTML = `<span style="color:#fff;font-weight:800;font-size:13px">R</span>`; } }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#EF4444", lineHeight: 1.2 }}>Sale Return</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", marginTop: 1 }}>CREDIT NOTE</div>
          </div>
        </div>
        <div />
        {/* Close */}
        <button onClick={() => setShowConfirm(true)} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 8, cursor: "pointer", outline: "none" }} title="Close">
          <X size={16} strokeWidth={2} color="#EF4444" />
        </button>
      </div>

      {/* ── Feedback toast ─────────────────────────────── */}
      <AnimatePresence>
        {feedback && (
          <motion.div key="toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: "fixed", top: 16, right: 16, zIndex: 3000, background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2", border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 13, fontWeight: 600, color: feedback.type === "success" ? "#16A34A" : "#EF4444" }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Customer row ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #E2E8F0", background: "#fff", flexShrink: 0 }}>
        <UserRound size={16} color="#64748B" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Customer</span>
        <input type="text" placeholder="Customer name or mobile..." value={customer} onChange={(e) => setCustomer(e.target.value)}
          style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 12px", fontSize: 13, color: "#475569", outline: "none", fontFamily: "inherit", width: 240, background: "#F8FAFC" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#EF4444"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginLeft: 8 }}>Reason</span>
        <input type="text" placeholder="Reason for return..." value={reason} onChange={(e) => setReason(e.target.value)}
          style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 12px", fontSize: 13, color: "#475569", outline: "none", fontFamily: "inherit", flex: 1, background: "#F8FAFC" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#EF4444"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
      </div>

      {/* ── Main body ──────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Left: search + items table ─────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <ReturnSearchBar onAdd={addProduct} />
          <div style={{ height: 10, background: "#fff", flexShrink: 0 }} />

          {/* Items table */}
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["#", "PRODUCT", "CODE", "QTY", "PRICE (₹)", "DISC %", "DISC AMT", "TAX %", "TAX AMT", "TOTAL (₹)", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" ? "center" : h === "PRODUCT" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", position: "sticky", top: 0, background: "#F8FAFC", borderRight: "1px solid #F1F5F9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: "60px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <RotateCcw size={44} color="#E2E8F0" />
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>Search a product above to add return items</div>
                    </div>
                  </td></tr>
                )}
                {rows.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8" }}>{idx + 1}</td>
                    <td style={{ padding: "6px 10px", fontWeight: 500, color: "#1E293B" }}>{r.product}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{r.code}</td>
                    <td style={{ padding: "6px 10px" }}><input type="number" step="1" min={1} value={r.qty} onChange={(e) => updateRow(r.id, "qty", parseFloat(e.target.value) || 1)} style={cellInp} /></td>
                    <td style={{ padding: "6px 10px" }}><input type="number" step="1" value={fmtNum(r.price)} onChange={(e) => updateRow(r.id, "price", parseFloat(e.target.value) || 0)} style={cellInp} /></td>
                    <td style={{ padding: "6px 10px" }}><input type="number" step="1" value={fmtNum(r.discPct)} onChange={(e) => updateRow(r.id, "discPct", parseFloat(e.target.value) || 0)} style={cellInp} /></td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtNum(r.discAmt)}</td>
                    <td style={{ padding: "6px 10px" }}><input type="number" step="1" value={fmtNum(r.taxPct)} onChange={(e) => updateRow(r.id, "taxPct", parseFloat(e.target.value) || 0)} style={cellInp} /></td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtNum(r.taxAmt)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#EF4444" }}>{fmtNum(r.total)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <button onClick={() => removeRow(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, borderRadius: 6 }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom toolbar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "8px 14px", display: "flex", alignItems: "center", gap: 14, background: "#fff", flexShrink: 0 }}>
            <button onClick={() => setRows(p => [...p, { id: nanoid(), product: "", code: "", qty: 1, mrp: 0, price: 0, discPct: 0, discAmt: 0, taxPct: 0, taxAmt: 0, total: 0 }])}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #EF4444", borderRadius: 7, background: "#fff", color: "#EF4444", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              <Plus size={13} /> Add Row
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>
              <input type="text" inputMode="numeric" value={discountPct} placeholder="0"
                onChange={(e) => setDiscountPct(e.target.value.replace(/[^0-9.]/g, ""))}
                style={{ width: 60, border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 8px", fontSize: 13, textAlign: "right", outline: "none", fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
              {[
                { label: "ITEMS", value: String(totalItems) }, { label: "QTY", value: String(totalQty) },
                { label: "DISC",  value: fmtAmt(discAmt)   }, { label: "TAX", value: fmtAmt(taxTotal)  },
                { label: "REFUND", value: fmtAmt(totalRefund), red: true },
              ].map(({ label, value, red }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: red ? "#EF4444" : "#1E293B" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action bar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: saving ? "#F97316" : "#22C55E" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: saving ? "#F97316" : "#22C55E" }}>{saving ? "Saving…" : "Ready"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => window.print()} style={fBtn("outline")}><Printer size={13} /> Print</button>
              <button onClick={() => void handleSave()} disabled={saving} style={fBtn("red")}>
                {saving ? <><Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><RotateCcw size={13} /> Save Return (F2)</>}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", gap: 8, background: "#F8FAFC", flexShrink: 0 }}>
            <button onClick={() => navigate("/app/sales/returns")} style={fBtn("outline")}><X size={13} /> Close</button>
          </div>
        </div>

        {/* ── Right: Return Summary ──────────────────── */}
        <div style={{ width: 280, flexShrink: 0, background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", fontSize: 13, overflowY: "auto" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 8 }}>Return Summary</div>
            {[
              { label: "Sub Total",  value: fmtAmt(subTotal),   color: "#1E293B" },
              { label: "Discount",   value: fmtAmt(discAmt),    color: "#F97316" },
              { label: "Tax",        value: fmtAmt(taxTotal),   color: "#1E293B" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#64748B", fontSize: 12 }}>{label}</span>
                <span style={{ fontWeight: 500, color, fontSize: 12 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F1F5F9", paddingTop: 7, marginTop: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>Total Refund</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#EF4444" }}>₹{fmtAmt(totalRefund)}</span>
            </div>
          </div>

          {/* Refund method */}
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 10 }}>Refund Method</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(["Cash", "UPI", "Bank Transfer"] as const).map(m => {
                const active = refundMethod === m;
                const icon = m === "Cash" ? <Banknote size={15} /> : m === "UPI" ? <Layers size={15} /> : <CreditCard size={15} />;
                return (
                  <button key={m} onClick={() => setRefundMethod(m)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1.5px solid ${active ? "#EF4444" : "#E2E8F0"}`, borderRadius: 8, background: active ? "rgba(239,68,68,0.06)" : "#fff", color: active ? "#EF4444" : "#64748B", cursor: "pointer", fontFamily: "inherit", outline: "none", fontSize: 13, fontWeight: active ? 700 : 400, transition: "all 0.12s" }}>
                    {icon} {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirm close dialog ───────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertCircle size={18} color="#EF4444" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Discard return?</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{rows.length > 0 ? "Unsaved return items will be lost" : "Go back to return list?"}</div>
                </div>
              </div>
              <div style={{ padding: "16px 22px 20px", display: "flex", gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "10px 0", border: "1px solid #E2E8F0", borderRadius: 9, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Stay</button>
                <button onClick={() => navigate("/app/sales/returns")} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 9, background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function recalc(r: ReturnItem): ReturnItem {
  const discAmt = r.mrp * r.qty * r.discPct / 100;
  const taxable = r.price * r.qty - discAmt;
  const taxAmt  = taxable * r.taxPct / 100;
  return { ...r, discAmt: +discAmt.toFixed(2), taxAmt: +taxAmt.toFixed(2), total: +(taxable + taxAmt).toFixed(2) };
}

const cellInp: React.CSSProperties = { width: "100%", border: "none", background: "transparent", fontSize: 12, color: "#1E293B", outline: "none", fontFamily: "inherit", padding: "2px 0", textAlign: "right" };
const fBtn = (v: "outline" | "red"): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  outline: "none", borderRadius: 7,
  ...(v === "red"     ? { background: "#EF4444", color: "#fff",    border: "none"                   } : {}),
  ...(v === "outline" ? { background: "#fff",    color: "#475569", border: "1px solid #E2E8F0"      } : {}),
});
