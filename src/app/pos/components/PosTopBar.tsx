import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Settings, Maximize2, X, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { usePosStore } from "@/store/pos.store";
import { http } from "@/lib/axios";
import type { ProductRow } from "./ProductTable";

// =============================================================
// POS TOP BAR — unified search + barcode scanner input
//
// How it works:
//   Barcode scanner:  types full code very fast (< 80 ms between
//                     chars) then fires Enter. Detected by tracking
//                     inter-keystroke timing. On Enter → immediate
//                     DB lookup → product added silently, no dropdown.
//
//   Manual typing:    slower. After 220 ms idle → search DB and show
//                     dropdown. User clicks or uses ↑↓ Enter to pick.
//
// The input is ALWAYS focused on mount and keeps focus so the
// scanner can fire at any time without clicking first.
// =============================================================

interface PosTopBarProps { invoiceNo: string }

interface Product {
  id: string; name: string; code: string;
  barcode: string | null; mrp: number;
  salePrice: number; taxPct: number; unit: string;
}

// Max ms between scanner keystrokes to be treated as scanner input
const SCANNER_THRESHOLD_MS = 80;

export function PosTopBar({ invoiceNo }: PosTopBarProps) {
  const navigate = useNavigate();
  const { bills, activeBillId, addRowToBill } = usePosStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState<Product[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [showDrop,    setShowDrop]    = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [scanFlash,   setScanFlash]   = useState<"ok" | "err" | null>(null);

  const searchRef    = useRef<HTMLInputElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTime  = useRef<number>(0);   // timestamp of last keydown
  const isScannerRef = useRef(false);       // are we in scanner mode?

  const now  = new Date();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  const hasItems = bills.some((b) => b.rows.length > 0);

  // ── Always keep input focused ──────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // ── Add product row to bill ────────────────────────────────
  const addProduct = useCallback((p: Product) => {
    if (!activeBillId) return;
    const taxAmt = parseFloat(((p.salePrice * p.taxPct) / 100).toFixed(2));
    const row: ProductRow = {
      id: nanoid(), product: p.name, code: p.code,
      productId: p.id, qty: 1,
      mrp: p.mrp, price: p.salePrice,
      discPct: 0, discAmt: 0, taxPct: p.taxPct, taxAmt,
      total: parseFloat((p.salePrice + taxAmt).toFixed(2)),
    };
    addRowToBill(activeBillId, row);
  }, [activeBillId, addRowToBill]);

  // ── DB lookup ──────────────────────────────────────────────
  const lookupExact = useCallback(async (code: string) => {
    // Used by scanner — lookup by barcode/code exactly first
    try {
      const res = await http.get<{ success: boolean; data: Product }>(
        `/products/barcode/${encodeURIComponent(code.trim())}`
      );
      if (res.success && res.data) {
        addProduct(res.data);
        setScanFlash("ok");
        setTimeout(() => setScanFlash(null), 700);
        return true;
      }
    } catch { /* fall through to search */ }
    return false;
  }, [addProduct]);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    try {
      const res = await http.get<{ success: boolean; data: Product[] }>(
        `/products`, { params: { search: trimmed } }
      );
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data.slice(0, 12));
        setShowDrop(res.data.length > 0);
        setActiveIdx(-1);
      }
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  // ── Keystroke handler — detect scanner vs manual ───────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const gap = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // Track if keystrokes are coming in fast (scanner pattern)
    if (e.key !== "Enter" && e.key.length === 1) {
      if (gap < SCANNER_THRESHOLD_MS) {
        isScannerRef.current = true;
      } else {
        // First character — reset scanner flag; decide after more chars
        if (query.length === 0) isScannerRef.current = false;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();

      if (isScannerRef.current && query.trim()) {
        // ── SCANNER path: immediate lookup, no dropdown ────
        const code = query.trim();
        setQuery("");
        setShowDrop(false);
        isScannerRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        lookupExact(code).then((found) => {
          if (!found) {
            setScanFlash("err");
            setTimeout(() => setScanFlash(null), 1000);
          }
        });
      } else if (showDrop && activeIdx >= 0) {
        // ── Manual path: Enter picks highlighted result ────
        addProduct(results[activeIdx]);
        setQuery(""); setResults([]); setShowDrop(false);
      }
      return;
    }

    // Dropdown keyboard nav
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setShowDrop(false);
    }
  }, [query, showDrop, activeIdx, results, addProduct, lookupExact]);

  // ── Input change — debounce search for manual typing ──────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!isScannerRef.current) doSearch(val);
    }, 220);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // F1 focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Scan flash border colour ───────────────────────────────
  const borderColor = scanFlash === "ok"  ? "#22C55E"
                    : scanFlash === "err" ? "#EF4444"
                    : showDrop            ? "#F97316"
                    : "#E2E8F0";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 52, background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0, position: "relative", zIndex: 100 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff" }}>
            <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: "contain" }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const p = el.parentElement;
                if (p) { p.style.background = "#F97316"; p.innerHTML = `<span style="color:#fff;font-weight:800;font-size:14px">O</span>`; }
              }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#F97316", lineHeight: 1.1 }}>Orizo Bills</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.08em" }}>POINT OF SALE</div>
          </div>
        </div>

        {/* ── Unified search / scanner input ──────────────── */}
        <div style={{ flex: 1, maxWidth: 520, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none", zIndex: 1 }} />

          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length) setShowDrop(true); }}
            placeholder="Search product or scan barcode — press F1 to focus"
            autoComplete="off"
            style={{
              width: "100%", border: `1.5px solid ${borderColor}`,
              borderRadius: 8, padding: "7px 64px 7px 32px",
              fontSize: 13, color: "#1E293B", background: "#fff",
              outline: "none", fontFamily: "inherit",
              transition: "border-color 0.15s",
              boxShadow: scanFlash === "ok"  ? "0 0 0 3px rgba(34,197,94,0.15)"
                       : scanFlash === "err" ? "0 0 0 3px rgba(239,68,68,0.15)"
                       : showDrop           ? "0 0 0 3px rgba(249,115,22,0.10)"
                       : "none",
            }}
          />

          {/* Right indicators */}
          <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
            {searching && <Loader2 size={13} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />}
            {scanFlash === "ok"  && <CheckCircle2  size={14} color="#22C55E" />}
            {scanFlash === "err" && <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 700 }}>Not found</span>}
            {!searching && !scanFlash && (
              <span style={{ background: "#E2E8F0", borderRadius: 4, padding: "2px 5px", fontSize: 10, fontWeight: 600, color: "#64748B" }}>F1</span>
            )}
          </div>

          {/* Results dropdown — manual search only */}
          <AnimatePresence>
            {showDrop && results.length > 0 && (
              <motion.div ref={dropRef}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 320, overflowY: "auto", zIndex: 500 }}>
                <div style={{ padding: "5px 12px 4px", borderBottom: "1px solid #F1F5F9", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                  {results.length} result{results.length !== 1 ? "s" : ""} — click or ↑↓ Enter
                </div>
                {results.map((p, idx) => (
                  <div key={p.id} onClick={() => { addProduct(p); setQuery(""); setResults([]); setShowDrop(false); searchRef.current?.focus(); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", cursor: "pointer", background: idx === activeIdx ? "#FFF7ED" : "transparent", borderBottom: "1px solid #F8FAFC" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                        {p.code}{p.taxPct > 0 ? ` · GST ${p.taxPct}%` : ""}{p.unit ? ` · ${p.unit}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>₹{p.salePrice.toFixed(2)}</div>
                      {p.mrp !== p.salePrice && <div style={{ fontSize: 10, color: "#CBD5E1", textDecoration: "line-through" }}>₹{p.mrp.toFixed(2)}</div>}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
            {showDrop && !searching && results.length === 0 && query.trim() && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "14px", textAlign: "center", fontSize: 13, color: "#94A3B8", zIndex: 500 }}>
                No products found for "<strong>{query}</strong>"
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Invoice info */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#64748B" }}>Invoice No. <span style={{ fontWeight: 700, color: "#F97316" }}>{invoiceNo}</span></div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Date <span style={{ fontWeight: 600, color: "#1E293B" }}>{date}</span></div>
          <div style={{ fontSize: 12, color: "#64748B" }}>Time <span style={{ fontWeight: 600, color: "#1E293B" }}>{time}</span></div>
        </div>

        {/* Window actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
          <button style={iconBtn} title="Settings"><Settings size={16} strokeWidth={1.8} color="#64748B" /></button>
          <button style={iconBtn} title="Fullscreen"><Maximize2 size={16} strokeWidth={1.8} color="#64748B" /></button>
          <button onClick={() => setShowConfirm(true)} style={iconBtn} title="Close POS"><X size={18} strokeWidth={2} color="#EF4444" /></button>
        </div>
      </div>

      {/* Confirm close dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle size={20} color="#F97316" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Close POS?</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                    {hasItems ? "You have unsaved bill items" : "Return to dashboard?"}
                  </div>
                </div>
              </div>
              <div style={{ padding: "16px 22px 20px" }}>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
                  {hasItems
                    ? <><strong style={{ color: "#F97316" }}>Unsaved items</strong> will be lost if you close without saving.</>
                    : "Are you sure you want to exit the POS?"}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowConfirm(false)}
                    style={{ flex: 1, padding: "11px 0", border: "1px solid #E2E8F0", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    Stay in POS
                  </button>
                  <button onClick={() => { setShowConfirm(false); navigate("/app/dashboard"); }}
                    style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 10, background: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    Yes, Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", borderRadius: 8, cursor: "pointer", outline: "none",
};
