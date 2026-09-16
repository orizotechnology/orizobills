import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import {
  Search, Loader2, Trash2, ChevronDown, X, CheckCircle2, AlertTriangle,
  ShoppingBag, Phone, User, StickyNote, CalendarDays, Tag,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// TYPES
// =============================================================

interface Product {
  id: string; name: string; code: string; barcode: string | null;
  mrp: number; salePrice: number; taxPct: number; unit: string;
  currentStock: number | null;
}

interface OrderRow {
  id: string; productId?: string; product: string; code: string;
  qty: number; mrp: number; price: number; taxPct: number;
  taxAmt: number; total: number;
}

const SOURCES = ["Walk-in", "Phone", "WhatsApp", "Online", "Other"];

const ORANGE = "#F97316";

// =============================================================
// HELPERS
// =============================================================
function fmtAmt(n: number) { return "₹" + Math.round(n); }

function calcRow(r: OrderRow, qty = r.qty, price = r.price, taxPct = r.taxPct): OrderRow {
  const taxAmt = Math.round((price * qty * taxPct) / 100);
  const total  = Math.round(price * qty + taxAmt);
  return { ...r, qty, price, taxPct, taxAmt, total };
}

// =============================================================
// SEARCH BAR
// =============================================================
function SearchBar({ onAdd }: { onAdd: (p: Product) => void }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [flash,     setFlash]     = useState<"ok" | "err" | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const dropRef   = useRef<HTMLDivElement>(null);
  const debRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey   = useRef(0);
  const isScan    = useRef(false);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setShowDrop(false); return; }
    setLoading(true);
    try {
      const res = await http.get<{ success: boolean; data: Product[] }>("/products", { params: { search: q } });
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data.slice(0, 12)); setShowDrop(res.data.length > 0); setActiveIdx(-1);
      }
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const lookupExact = useCallback(async (code: string) => {
    try {
      const res = await http.get<{ success: boolean; data: Product }>(`/products/barcode/${encodeURIComponent(code)}`);
      if (res.success && res.data) { onAdd(res.data); setFlash("ok"); setTimeout(() => setFlash(null), 700); return; }
    } catch { /* fall */ }
    setFlash("err"); setTimeout(() => setFlash(null), 900);
  }, [onAdd]);

  const pick = useCallback((p: Product) => {
    onAdd(p); setQuery(""); setResults([]); setShowDrop(false); inputRef.current?.focus();
  }, [onAdd]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setQuery(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { if (!isScan.current) doSearch(v); }, 220);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now(); const gap = now - lastKey.current; lastKey.current = now;
    if (e.key !== "Enter" && e.key.length === 1) {
      if (gap < 80) isScan.current = true;
      else if (query.length === 0) isScan.current = false;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (isScan.current && query.trim()) {
        const code = query.trim(); setQuery(""); setShowDrop(false); isScan.current = false;
        if (debRef.current) clearTimeout(debRef.current);
        lookupExact(code);
      } else if (showDrop && activeIdx >= 0) { pick(results[activeIdx]); }
      else if (results.length > 0) { pick(results[0]); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Escape")    { setShowDrop(false); setQuery(""); }
  };

  const border = flash === "ok" ? "#22C55E" : flash === "err" ? "#EF4444" : showDrop ? ORANGE : "#CBD5E1";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
          {loading ? <Loader2 size={16} color={ORANGE} style={{ animation: "spin 0.7s linear infinite" }} />
            : flash === "ok" ? <CheckCircle2 size={16} color="#22C55E" />
            : flash === "err" ? <AlertTriangle size={16} color="#EF4444" />
            : <Search size={16} color="#94A3B8" />}
        </span>
        <input ref={inputRef} value={query} onChange={handleChange} onKeyDown={handleKeyDown}
          onFocus={() => results.length && setShowDrop(true)}
          placeholder="Search product or scan barcode — F1 to focus"
          autoComplete="off" spellCheck={false}
          style={{
            width: "100%", height: 42, border: `2px solid ${border}`, borderRadius: 9,
            padding: "0 12px 0 38px", fontSize: 13, outline: "none",
            fontFamily: "inherit", background: "#FAFAFA", color: "#1E293B",
            transition: "border-color 0.15s", boxSizing: "border-box",
          }} />
      </div>
      {showDrop && results.length > 0 && (
        <div ref={dropRef} style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 400,
          background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)", maxHeight: 320, overflowY: "auto",
        }}>
          {results.map((p, idx) => {
            const oos = p.currentStock !== null && p.currentStock <= 0;
            return (
              <div key={p.id} onMouseDown={e => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F8FAFC",
                  background: idx === activeIdx ? "#FFF7ED" : oos ? "#FFF5F5" : "transparent",
                  opacity: oos ? 0.65 : 1,
                }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1, display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{p.code}</span>
                    {p.taxPct > 0 && <span>· GST {p.taxPct}%</span>}
                    {p.currentStock !== null && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "1px 5px",
                        background: oos ? "rgba(239,68,68,0.1)" : p.currentStock <= 5 ? "rgba(249,115,22,0.1)" : "rgba(34,197,94,0.1)",
                        color: oos ? "#EF4444" : p.currentStock <= 5 ? ORANGE : "#16A34A",
                      }}>
                        {oos ? "Out of stock" : `${Math.floor(p.currentStock)} in stock`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: oos ? "#94A3B8" : ORANGE }}>₹{Math.round(p.salePrice)}</div>
                  {p.mrp > p.salePrice && <div style={{ fontSize: 10, color: "#CBD5E1", textDecoration: "line-through" }}>₹{Math.round(p.mrp)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================
export default function OrderEntryPage() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().slice(0, 10);

  const [rows,      setRows]      = useState<OrderRow[]>([]);
  const [customer,  setCustomer]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [source,    setSource]    = useState("Walk-in");
  const [dueDate,   setDueDate]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [feedback,  setFeedback]  = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ── Totals ────────────────────────────────────────────────
  const subTotal   = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const taxTotal   = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalAmt   = rows.reduce((s, r) => s + r.total, 0);
  const totalItems = rows.length;
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);

  // ── Add product ───────────────────────────────────────────
  const addProduct = useCallback((p: Product) => {
    setRows(prev => {
      const existIdx = prev.findIndex(r => r.productId === p.id);
      if (existIdx !== -1) {
        return prev.map((r, i) => i !== existIdx ? r : calcRow(r, r.qty + 1));
      }
      const row: OrderRow = { id: nanoid(), productId: p.id, product: p.name, code: p.code,
        qty: 1, mrp: p.mrp, price: p.salePrice, taxPct: p.taxPct, taxAmt: 0, total: 0 };
      return [...prev, calcRow(row)];
    });
  }, []);

  const updateRow = useCallback((id: string, field: "qty" | "price" | "taxPct", raw: string) => {
    const v = parseFloat(raw) || 0;
    setRows(prev => prev.map(r => r.id !== id ? r : calcRow(r, field === "qty" ? v : r.qty, field === "price" ? v : r.price, field === "taxPct" ? v : r.taxPct)));
  }, []);

  const removeRow = useCallback((id: string) => setRows(prev => prev.filter(r => r.id !== id)), []);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!rows.length) { setFeedback({ type: "err", msg: "Add at least one item." }); setTimeout(() => setFeedback(null), 3000); return; }
    setSaving(true);
    try {
      const payload = {
        customerName: customer.trim() || "Walk-in Customer",
        phone:        phone.trim() || undefined,
        orderDate:    today,
        dueDate:      dueDate || undefined,
        source,
        notes:        notes.trim() || undefined,
        items: rows.map(r => ({
          productId:   r.productId,
          itemName:    r.product,
          itemCode:    r.code,
          quantity:    r.qty,
          unitPrice:   r.price,
          mrp:         r.mrp,
          taxPct:      r.taxPct,
          totalAmount: r.total,
        })),
      };
      await http.post("/sales/orders", payload);
      setFeedback({ type: "ok", msg: "Order booked!" });
      setTimeout(() => navigate("/app/sales/orders"), 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setFeedback({ type: "err", msg }); setTimeout(() => setFeedback(null), 4000);
    } finally { setSaving(false); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: "#F8FAFC", fontFamily: "inherit", overflow: "hidden" }}>

      {/* ── LEFT: item entry ───────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Header bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navigate("/app/sales/orders")}
              style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #E2E8F0",
                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color="#64748B" />
            </button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>New Order Booking</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Book an order · items are reserved, not invoiced yet</div>
            </div>
          </div>
          {feedback && (
            <div style={{ fontSize: 12, fontWeight: 600, borderRadius: 7, padding: "6px 14px",
              background: feedback.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: feedback.type === "ok" ? "#16A34A" : "#EF4444" }}>
              {feedback.type === "ok" ? "✓ " : "⚠ "}{feedback.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setRows([]); setCustomer(""); setPhone(""); setNotes(""); setDueDate(""); setSource("Walk-in"); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
                background: "#fff", fontSize: 12, fontWeight: 600, color: "#64748B", cursor: "pointer" }}>
              Clear
            </button>
            <button onClick={handleSave} disabled={saving || !rows.length}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none",
                background: saving || !rows.length ? "#CBD5E1" : ORANGE,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving || !rows.length ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Book Order"}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: "12px 20px 0", flexShrink: 0, background: "#fff",
          borderBottom: "1px solid #F1F5F9" }}>
          <SearchBar onAdd={addProduct} />
          <div style={{ display: "flex", gap: 20, padding: "8px 0 10px", fontSize: 12, color: "#94A3B8" }}>
            <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{totalQty} qty</span>
            <span>·</span>
            <span style={{ color: ORANGE, fontWeight: 700 }}>{fmtAmt(totalAmt)}</span>
          </div>
        </div>

        {/* Items table */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {rows.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 10, color: "#94A3B8" }}>
              <ShoppingBag size={36} strokeWidth={1.2} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Search a product above to add it</div>
              <div style={{ fontSize: 12 }}>Scan a barcode or type to search</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0 }}>
                  {["#", "PRODUCT", "CODE", "QTY", "MRP (₹)", "PRICE (₹)", "TAX %", "TAX AMT", "TOTAL", ""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", textAlign: i === 0 ? "center" : i >= 3 ? "right" : "left",
                      fontSize: 10, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8" }}>{idx + 1}</td>
                    <td style={{ padding: "6px 10px", fontWeight: 500, color: "#1E293B" }}>{r.product}</td>
                    <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.code}</td>
                    {(["qty", "price", "taxPct"] as const).map(f => (
                      <td key={f} style={{ padding: "4px 6px" }}>
                        <input type="text" inputMode="decimal" defaultValue={f === "taxPct" ? r.taxPct : f === "price" ? Math.round(r.price) : r.qty}
                          key={`${r.id}-${f}-${f === "qty" ? r.qty : f === "price" ? r.price : r.taxPct}`}
                          onBlur={e => updateRow(r.id, f, e.target.value)}
                          style={{ width: "100%", border: "none", background: "transparent", textAlign: "right",
                            fontSize: 12, color: "#1E293B", outline: "none", fontFamily: "inherit" }}
                          onFocus={e => { e.target.style.background = "#FFF7ED"; e.target.style.borderRadius = "4px"; }}
                          onBlurCapture={e => { e.target.style.background = "transparent"; }} />
                      </td>
                    ))}
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtAmt(r.taxAmt)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#1E293B" }}>{fmtAmt(r.total)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <button onClick={() => removeRow(r.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 3, borderRadius: 5 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── RIGHT: order details sidebar ───────────────────── */}
      <div style={{ width: 300, display: "flex", flexDirection: "column", background: "#fff",
        borderLeft: "1px solid #E2E8F0", flexShrink: 0, overflow: "hidden" }}>

        {/* Customer & booking info */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "0.06em", marginBottom: 10 }}>
            ORDER DETAILS
          </div>

          {/* Customer name */}
          <div style={{ marginBottom: 10 }}>
            <label style={lblStyle}><User size={11} /> Customer Name</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)}
              placeholder="Walk-in Customer"
              style={inputStyle} />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 10 }}>
            <label style={lblStyle}><Phone size={11} /> Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="Mobile number"
              style={inputStyle} />
          </div>

          {/* Source */}
          <div style={{ marginBottom: 10 }}>
            <label style={lblStyle}><Tag size={11} /> Order Source</label>
            <div style={{ position: "relative" }}>
              <select value={source} onChange={e => setSource(e.target.value)}
                style={{ ...inputStyle, appearance: "none", paddingRight: 28, cursor: "pointer" }}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={12} color="#94A3B8" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Due date */}
          <div style={{ marginBottom: 10 }}>
            <label style={lblStyle}><CalendarDays size={11} /> Expected Delivery</label>
            <input type="date" value={dueDate} min={today}
              onChange={e => setDueDate(e.target.value)}
              style={inputStyle} />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <label style={lblStyle}><StickyNote size={11} /> Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions, address, etc."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", height: "auto", lineHeight: 1.4, paddingTop: 7 }} />
          </div>

          {/* Source badge */}
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 8, padding: "8px 10px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>Channel</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE,
              background: "rgba(249,115,22,0.1)", borderRadius: 5, padding: "2px 9px" }}>
              {source}
            </span>
          </div>
        </div>

        {/* Bill summary */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>ORDER SUMMARY</div>
          {[
            { label: "Subtotal",  value: fmtAmt(subTotal), color: "#1E293B" },
            { label: "Tax",       value: fmtAmt(taxTotal),  color: "#64748B" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: "#64748B" }}>{label}</span>
              <span style={{ fontWeight: 500, color }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F1F5F9",
            paddingTop: 7, marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: ORANGE }}>{fmtAmt(totalAmt)}</span>
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: "10px 14px 14px", flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !rows.length}
            style={{ width: "100%", padding: "11px 0", borderRadius: 9, border: "none",
              background: saving || !rows.length ? "#CBD5E1" : ORANGE,
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: saving || !rows.length ? "not-allowed" : "pointer",
              fontFamily: "inherit" }}>
            {saving ? "Saving…" : `Book Order · ${fmtAmt(totalAmt)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const lblStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, color: "#94A3B8",
  letterSpacing: "0.04em", marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8,
  padding: "7px 10px", fontSize: 13, color: "#1E293B",
  background: "#FAFAFA", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};
