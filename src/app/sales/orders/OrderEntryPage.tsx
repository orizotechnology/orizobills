import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import {
  Search, Loader2, Trash2, ChevronDown, X, CheckCircle2, AlertTriangle,
  ShoppingBag, Phone, User, StickyNote, CalendarDays, Tag, Plus, Minus,
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
  taxAmt: number; total: number; stock: number | null;
}

const SOURCES = ["Walk-in", "Phone", "WhatsApp", "Online", "Other"];
const ORANGE = "#F97316";

// =============================================================
// HELPERS
// =============================================================
const fmtAmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// Local date (not UTC) so "today" is correct in India after midnight
const localISO = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function calcRow(r: OrderRow, qty = r.qty, price = r.price, taxPct = r.taxPct): OrderRow {
  const taxAmt = Math.round((price * qty * taxPct) / 100);
  const total = Math.round(price * qty + taxAmt);
  return { ...r, qty, price, taxPct, taxAmt, total };
}

function useIsNarrow(bp = 900) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const h = () => setNarrow(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return narrow;
}

// =============================================================
// EDITABLE NUMBER CELL  (commits on blur / Enter, Esc reverts)
// =============================================================
function NumCell({
  value, onCommit, onEnter, min = 0, max = Infinity, label,
}: {
  value: number; onCommit: (n: number) => void; onEnter?: () => void;
  min?: number; max?: number; label: string;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);

  const commit = () => {
    const n = Number(txt);
    if (txt.trim() === "" || Number.isNaN(n)) { setTxt(String(value)); return; }
    const clamped = Math.min(max, Math.max(min, n));
    setTxt(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      className="oe-cell" type="text" inputMode="decimal" aria-label={label}
      value={txt}
      onChange={e => setTxt(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); commit(); onEnter?.(); }
        if (e.key === "Escape") { setTxt(String(value)); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

// =============================================================
// SEARCH BAR
// =============================================================
function SearchBar({
  onAdd, inputRef,
}: { onAdd: (p: Product) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [flash,     setFlash]     = useState<"ok" | "err" | null>(null);
  const [notice,    setNotice]    = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef(0);
  const isScan  = useRef(false);
  const reqId   = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [inputRef]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [inputRef]);

  // keep highlighted result visible when using arrow keys
  useEffect(() => {
    if (activeIdx < 0) return;
    dropRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const doSearch = useCallback(async (q: string) => {
    const id = ++reqId.current;
    if (!q.trim()) { setResults([]); setShowDrop(false); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await http.get<{ success: boolean; data: Product[] }>("/products", { params: { search: q } });
      if (id !== reqId.current) return; // a newer search replaced this one
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data.slice(0, 12));
        setShowDrop(res.data.length > 0);
        setActiveIdx(res.data.length > 0 ? 0 : -1);
        setNotice(res.data.length === 0 ? `No product matches “${q.trim()}”` : null);
      }
    } catch {
      if (id !== reqId.current) return;
      setResults([]); setShowDrop(false); setNotice("Search failed. Check your connection and try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const lookupExact = useCallback(async (code: string) => {
    try {
      const res = await http.get<{ success: boolean; data: Product }>(`/products/barcode/${encodeURIComponent(code)}`);
      if (res.success && res.data) {
        onAdd(res.data); setNotice(null); setFlash("ok"); setTimeout(() => setFlash(null), 700);
        return;
      }
    } catch { /* fall through */ }
    setFlash("err"); setNotice(`No product found for barcode ${code}`);
    setTimeout(() => setFlash(null), 900);
  }, [onAdd]);

  const pick = useCallback((p: Product) => {
    onAdd(p);
    setQuery(""); setResults([]); setShowDrop(false); setActiveIdx(-1); setNotice(null);
    isScan.current = false;
    inputRef.current?.focus();
  }, [onAdd, inputRef]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v); setNotice(null);
    if (debRef.current) clearTimeout(debRef.current);
    if (!v.trim()) { isScan.current = false; reqId.current++; setResults([]); setShowDrop(false); setLoading(false); return; }
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
      const q = query.trim();
      if (!q) return;
      if (debRef.current) clearTimeout(debRef.current);
      if (isScan.current) {
        setQuery(""); setShowDrop(false); isScan.current = false;
        lookupExact(q);
      } else if (showDrop && results.length > 0) {
        pick(results[activeIdx >= 0 ? activeIdx : 0]);
      } else {
        doSearch(q); // Enter before the debounce fired: search right away
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDrop && results.length) { setShowDrop(true); return; }
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Escape") { setShowDrop(false); setQuery(""); setNotice(null); isScan.current = false; }
  };

  const border = flash === "ok" ? "#22C55E" : flash === "err" ? "#EF4444" : showDrop ? ORANGE : "#CBD5E1";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
          {loading ? <Loader2 size={16} color={ORANGE} style={{ animation: "oe-spin 0.7s linear infinite" }} />
            : flash === "ok" ? <CheckCircle2 size={16} color="#22C55E" />
            : flash === "err" ? <AlertTriangle size={16} color="#EF4444" />
            : <Search size={16} color="#94A3B8" />}
        </span>
        <input ref={inputRef} value={query} onChange={handleChange} onKeyDown={handleKeyDown}
          onFocus={() => results.length && setShowDrop(true)}
          placeholder="Search product or scan barcode (F1 to focus)"
          aria-label="Search product or scan barcode"
          autoComplete="off" spellCheck={false}
          style={{
            width: "100%", height: 42, border: `2px solid ${border}`, borderRadius: 9,
            padding: "0 36px 0 38px", fontSize: 13, outline: "none",
            fontFamily: "inherit", background: "#FAFAFA", color: "#1E293B",
            transition: "border-color 0.15s", boxSizing: "border-box",
          }} />
        {query && (
          <button type="button" className="oe-btn" aria-label="Clear search"
            onClick={() => { setQuery(""); setResults([]); setShowDrop(false); setNotice(null); isScan.current = false; inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 24, height: 24,
              border: "none", background: "transparent", borderRadius: 6, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#94A3B8" />
          </button>
        )}
      </div>

      {notice && <div role="status" style={{ fontSize: 12, color: "#EF4444", marginTop: 6 }}>{notice}</div>}

      {showDrop && results.length > 0 && (
        <div ref={dropRef} role="listbox" style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 400,
          background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)", maxHeight: 320, overflowY: "auto",
        }}>
          {results.map((p, idx) => {
            const oos = p.currentStock !== null && p.currentStock <= 0;
            return (
              <div key={p.id} data-idx={idx} role="option" aria-selected={idx === activeIdx}
                onMouseDown={e => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F1F5F9",
                  background: idx === activeIdx ? "#FFF7ED" : oos ? "#FFF5F5" : "transparent",
                  opacity: oos ? 0.75 : 1,
                }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{p.code}</span>
                    {p.taxPct > 0 && <span>GST {p.taxPct}%</span>}
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
                  {p.mrp > p.salePrice && <div style={{ fontSize: 10, color: "#94A3B8", textDecoration: "line-through" }}>₹{Math.round(p.mrp)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================
const COLS: { h: string; a: "left" | "right" | "center"; w?: number }[] = [
  { h: "#", a: "center", w: 40 },
  { h: "Product", a: "left" },
  { h: "Code", a: "left", w: 110 },
  { h: "Qty", a: "center", w: 116 },
  { h: "MRP (₹)", a: "right", w: 80 },
  { h: "Price (₹)", a: "right", w: 96 },
  { h: "Tax %", a: "right", w: 76 },
  { h: "Tax amt", a: "right", w: 84 },
  { h: "Total", a: "right", w: 96 },
  { h: "", a: "center", w: 44 },
];

export default function OrderEntryPage() {
  const navigate = useNavigate();
  const narrow = useIsNarrow();
  const today = localISO();
  const searchRef = useRef<HTMLInputElement>(null);

  const [rows,     setRows]     = useState<OrderRow[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone,    setPhone]    = useState("");
  const [source,   setSource]   = useState("Walk-in");
  const [dueDate,  setDueDate]  = useState("");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [booked,   setBooked]   = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((type: "ok" | "err", msg: string, ms = 3500) => {
    if (fbTimer.current) clearTimeout(fbTimer.current);
    setFeedback({ type, msg });
    if (ms > 0) fbTimer.current = setTimeout(() => setFeedback(null), ms);
  }, []);
  useEffect(() => () => { if (fbTimer.current) clearTimeout(fbTimer.current); }, []);

  // ── Totals ────────────────────────────────────────────────
  const taxTotal   = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalAmt   = rows.reduce((s, r) => s + r.total, 0);
  const subTotal   = totalAmt - taxTotal; // always adds up on screen
  const totalItems = rows.length;
  const totalQty   = rows.reduce((s, r) => s + r.qty, 0);

  const dirty = rows.length > 0 || !!(customer || phone || notes || dueDate) || source !== "Walk-in";
  const canBook = !saving && !booked && rows.length > 0;

  // ── Rows ──────────────────────────────────────────────────
  const addProduct = useCallback((p: Product) => {
    setRows(prev => {
      const existIdx = prev.findIndex(r => r.productId === p.id);
      if (existIdx !== -1) {
        return prev.map((r, i) => i !== existIdx ? r : calcRow({ ...r, stock: p.currentStock }, r.qty + 1));
      }
      const row: OrderRow = {
        id: nanoid(), productId: p.id, product: p.name, code: p.code,
        qty: 1, mrp: p.mrp, price: p.salePrice, taxPct: p.taxPct, taxAmt: 0, total: 0,
        stock: p.currentStock,
      };
      return [...prev, calcRow(row)];
    });
  }, []);

  const updateRow = useCallback((id: string, field: "qty" | "price" | "taxPct", v: number) => {
    setRows(prev => prev.map(r => r.id !== id ? r : calcRow(
      r,
      field === "qty" ? v : r.qty,
      field === "price" ? v : r.price,
      field === "taxPct" ? v : r.taxPct,
    )));
  }, []);

  const removeRow = useCallback((id: string) => setRows(prev => prev.filter(r => r.id !== id)), []);

  // ── Clear / close ─────────────────────────────────────────
  const resetForm = () => {
    setRows([]); setCustomer(""); setPhone(""); setNotes(""); setDueDate(""); setSource("Walk-in");
    setFeedback(null); searchRef.current?.focus();
  };
  const handleClear = () => {
    if (!dirty) return;
    if (window.confirm("Clear this order and start over?")) resetForm();
  };
  const handleClose = () => {
    if (dirty && !booked && !window.confirm("Discard this order? Items you added will be lost.")) return;
    navigate("/app/sales/orders");
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving || booked) return;
    if (!rows.length) { showFeedback("err", "Add at least one item."); return; }
    if (rows.some(r => r.price <= 0)) { showFeedback("err", "Every item needs a price above ₹0."); return; }

    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && !(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) {
      showFeedback("err", "Enter a valid 10-digit mobile number."); return;
    }
    if (dueDate && dueDate < today) { showFeedback("err", "Delivery date can't be in the past."); return; }

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
      setBooked(true);
      showFeedback("ok", "Order booked", 0);
      setTimeout(() => navigate("/app/sales/orders"), 900);
    } catch (err: any) {
      // show the real server message when the backend sends one
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : "Couldn't save the order. Try again.");
      showFeedback("err", msg, 5000);
    } finally { setSaving(false); }
  };

  // ── Keyboard shortcuts: F1 focus search, Ctrl/Cmd+S book ───
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const focusSearch = () => searchRef.current?.focus();

  // ── Render ────────────────────────────────────────────────
  const bookLabel = saving ? "Saving…" : booked ? "Booked" : "Book order";

  return (
    <div style={{
      display: "flex", flexDirection: narrow ? "column" : "row",
      height: narrow ? "auto" : "100vh", minHeight: "100vh",
      background: "#F8FAFC", fontFamily: "inherit", overflow: narrow ? "visible" : "hidden",
    }}>
      <style>{`
        @keyframes oe-spin { to { transform: rotate(360deg); } }
        .oe-btn { transition: background .15s, border-color .15s, color .15s, opacity .15s; }
        .oe-btn:focus-visible { outline: 2px solid ${ORANGE}; outline-offset: 2px; }
        .oe-btn-ghost:not(:disabled):hover { background: #F1F5F9; }
        .oe-btn-primary:not(:disabled):hover { background: #EA580C !important; }
        .oe-btn-icon:not(:disabled):hover { background: #F1F5F9; border-color: #CBD5E1; }
        .oe-btn-del:hover { color: #EF4444 !important; background: #FEF2F2 !important; }
        .oe-field { width: 100%; box-sizing: border-box; border: 1.5px solid #E2E8F0; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; color: #1E293B; background: #FAFAFA; outline: none;
          font-family: inherit; transition: border-color .15s, box-shadow .15s, background .15s; }
        .oe-field:focus { border-color: ${ORANGE}; background: #fff; box-shadow: 0 0 0 3px rgba(249,115,22,.14); }
        .oe-cell { width: 100%; box-sizing: border-box; border: 1px solid #E2E8F0; border-radius: 6px; background: #fff;
          text-align: right; font-size: 12px; color: #1E293B; padding: 5px 7px; outline: none; font-family: inherit; }
        .oe-cell:hover { border-color: #CBD5E1; }
        .oe-cell:focus { border-color: ${ORANGE}; box-shadow: 0 0 0 2px rgba(249,115,22,.14); }
        .oe-row:hover { background: #FAFAFA; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* Feedback toast */}
      {feedback && (
  <div role="status" aria-live="polite" style={{
    position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
    width: "max-content", maxWidth: "min(480px, 90vw)", maxHeight: 120, overflowY: "auto",
    fontSize: 13, fontWeight: 600, borderRadius: 9, padding: "9px 16px",
    background: feedback.type === "ok" ? "#F0FDF4" : "#FEF2F2",
    border: `1px solid ${feedback.type === "ok" ? "#BBF7D0" : "#FECACA"}`,
    color: feedback.type === "ok" ? "#16A34A" : "#DC2626",
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)", display: "flex", alignItems: "flex-start", gap: 8,
  }}>
    <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}>
      {feedback.type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
    </span>
    <span style={{ wordBreak: "break-word" }}>{feedback.msg}</span>
    {feedback.type === "err" && (
      <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss"
        style={{ marginLeft: 4, border: "none", background: "transparent", cursor: "pointer",
          color: "inherit", padding: 0, display: "flex", flexShrink: 0 }}>
        <X size={14} />
      </button>
    )}
  </div>
)}

      {/* ── LEFT: item entry ───────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: narrow ? "visible" : "hidden" }}>

        {/* Header bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" className="oe-btn oe-btn-icon" onClick={handleClose} aria-label="Close and go back to orders" title="Close"
              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <X size={14} color="#64748B" />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>New order booking</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Items are reserved, not invoiced yet</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="oe-btn oe-btn-ghost" onClick={handleClear} disabled={!dirty || saving || booked}
              title={dirty ? "Clear the order" : "Nothing to clear"}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff",
                fontSize: 12, fontWeight: 600, color: "#475569", fontFamily: "inherit",
                cursor: !dirty || saving || booked ? "not-allowed" : "pointer", opacity: !dirty ? 0.55 : 1 }}>
              Clear
            </button>
            <button type="button" className="oe-btn oe-btn-primary" onClick={handleSave} disabled={!canBook}
              title={rows.length ? "Book order (Ctrl+S)" : "Add at least one item first"}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontFamily: "inherit",
                background: canBook ? ORANGE : "#CBD5E1", color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: canBook ? "pointer" : "not-allowed" }}>
              {bookLabel}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: "12px 20px 0", flexShrink: 0, background: "#fff", borderBottom: "1px solid #F1F5F9", position: "relative", zIndex: 5 }}>
          <SearchBar onAdd={addProduct} inputRef={searchRef} />
          <div style={{ display: "flex", gap: 16, padding: "8px 0 10px", fontSize: 12, color: "#64748B" }}>
            <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
            <span>{totalQty} qty</span>
            <span style={{ color: ORANGE, fontWeight: 700 }}>{fmtAmt(totalAmt)}</span>
          </div>
        </div>

        {/* Items table */}
        <div style={{ flex: 1, overflow: "auto", minHeight: narrow ? 220 : 0 }}>
          {rows.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", minHeight: 220, gap: 8, color: "#94A3B8", padding: 24, textAlign: "center" }}>
              <ShoppingBag size={36} strokeWidth={1.2} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>No items yet</div>
              <div style={{ fontSize: 12 }}>Search by name or code, or scan a barcode to add the first item.</div>
            </div>
          ) : (
            <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {COLS.map((c, i) => (
                    <th key={i} style={{
                      position: "sticky", top: 0, zIndex: 1, background: "#F8FAFC",
                      boxShadow: "inset 0 -1px 0 #E2E8F0", padding: "9px 10px", textAlign: c.a,
                      width: c.w, fontSize: 11, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap",
                    }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const over = r.stock !== null && r.qty > r.stock;
                  return (
                    <tr key={r.id} className="oe-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <div style={{ fontWeight: 500, color: "#1E293B" }}>{r.product}</div>
                        {over && (
                          <div style={{ fontSize: 11, color: ORANGE, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <AlertTriangle size={11} /> Only {Math.max(0, Math.floor(r.stock as number))} in stock
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.code}</td>
                      <td style={{ padding: "4px 6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button type="button" className="oe-btn oe-btn-icon" aria-label={`Decrease quantity of ${r.product}`}
                            disabled={r.qty <= 1} onClick={() => updateRow(r.id, "qty", Math.max(1, r.qty - 1))}
                            style={stepBtn(r.qty <= 1)}>
                            <Minus size={12} />
                          </button>
                          <NumCell value={r.qty} min={1} label={`Quantity of ${r.product}`}
                            onCommit={v => updateRow(r.id, "qty", v)} onEnter={focusSearch} />
                          <button type="button" className="oe-btn oe-btn-icon" aria-label={`Increase quantity of ${r.product}`}
                            onClick={() => updateRow(r.id, "qty", r.qty + 1)} style={stepBtn(false)}>
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#94A3B8" }}>
                        {r.mrp > 0 ? Math.round(r.mrp) : "—"}
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <NumCell value={r.price} label={`Price of ${r.product}`}
                          onCommit={v => updateRow(r.id, "price", v)} onEnter={focusSearch} />
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <NumCell value={r.taxPct} max={100} label={`Tax percent of ${r.product}`}
                          onCommit={v => updateRow(r.id, "taxPct", v)} onEnter={focusSearch} />
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtAmt(r.taxAmt)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#1E293B" }}>{fmtAmt(r.total)}</td>
                      <td style={{ padding: "6px 6px", textAlign: "center" }}>
                        <button type="button" className="oe-btn oe-btn-del" onClick={() => removeRow(r.id)}
                          aria-label={`Remove ${r.product}`} title="Remove item"
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8",
                            width: 28, height: 28, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── RIGHT: order details sidebar ───────────────────── */}
      <div style={{
        width: narrow ? "100%" : 300, display: "flex", flexDirection: "column", background: "#fff",
        borderLeft: narrow ? "none" : "1px solid #E2E8F0", borderTop: narrow ? "1px solid #E2E8F0" : "none",
        flexShrink: 0, overflow: narrow ? "visible" : "hidden",
      }}>
        <div style={{ flex: 1, overflowY: narrow ? "visible" : "auto", padding: "16px 16px 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Order details</div>

          <div style={fieldWrap}>
            <label htmlFor="oe-customer" style={lblStyle}><User size={12} /> Customer name</label>
            <input id="oe-customer" className="oe-field" value={customer} onChange={e => setCustomer(e.target.value)}
              placeholder="Walk-in Customer" autoComplete="off" />
          </div>

          <div style={fieldWrap}>
            <label htmlFor="oe-phone" style={lblStyle}><Phone size={12} /> Phone</label>
            <input id="oe-phone" className="oe-field" value={phone} type="tel" inputMode="tel" maxLength={15}
              onChange={e => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
              placeholder="10-digit mobile number" autoComplete="off" />
          </div>

          <div style={fieldWrap}>
            <label htmlFor="oe-source" style={lblStyle}><Tag size={12} /> Order source</label>
            <div style={{ position: "relative" }}>
              <select id="oe-source" className="oe-field" value={source} onChange={e => setSource(e.target.value)}
                style={{ appearance: "none", WebkitAppearance: "none", paddingRight: 28, cursor: "pointer" }}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} color="#94A3B8" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          <div style={fieldWrap}>
            <label htmlFor="oe-due" style={lblStyle}><CalendarDays size={12} /> Expected delivery</label>
            <input id="oe-due" className="oe-field" type="date" value={dueDate} min={today}
              onChange={e => setDueDate(e.target.value)} />
          </div>

          <div style={fieldWrap}>
            <label htmlFor="oe-notes" style={lblStyle}><StickyNote size={12} /> Notes</label>
            <textarea id="oe-notes" className="oe-field" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions, address, etc." rows={3} maxLength={500}
              style={{ resize: "none", lineHeight: 1.4 }} />
          </div>
        </div>

        {/* Bill summary */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Order summary</div>
          {[
            { label: "Subtotal", value: fmtAmt(subTotal), color: "#1E293B" },
            { label: "Tax",      value: fmtAmt(taxTotal), color: "#64748B" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: "#64748B" }}>{label}</span>
              <span style={{ fontWeight: 500, color }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
            borderTop: "1px solid #F1F5F9", paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: ORANGE }}>{fmtAmt(totalAmt)}</span>
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: "4px 16px 16px", flexShrink: 0 }}>
          <button type="button" className="oe-btn oe-btn-primary" onClick={handleSave} disabled={!canBook}
            title={rows.length ? "Book order (Ctrl+S)" : "Add at least one item first"}
            style={{ width: "100%", padding: "12px 0", borderRadius: 9, border: "none",
              background: canBook ? ORANGE : "#CBD5E1", color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: canBook ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {saving ? "Saving…" : booked ? "Booked" : `Book order · ${fmtAmt(totalAmt)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const fieldWrap: React.CSSProperties = { marginBottom: 12 };
const lblStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 5,
};
const stepBtn = (disabled: boolean): React.CSSProperties => ({
  width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff",
  color: "#475569", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, padding: 0,
});