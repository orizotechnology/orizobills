import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, CheckCircle2, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { usePosStore } from "@/store/pos.store";
import { http } from "@/lib/axios";
import type { ProductRow } from "./ProductTable";

// =============================================================
// POS SEARCH BAR — centered product entry zone
//
// Sits at the TOP of the product area, full-width, prominent.
// Two input modes handled transparently:
//
//   Barcode scanner   → keystrokes arrive < 80 ms apart, then
//                       Enter fires → immediate DB lookup → row
//                       added silently with a green flash.
//
//   Manual typing     → 220 ms idle debounce → live dropdown
//                       with up to 12 results → click or ↑↓ Enter
//                       to select.
//
// Always auto-focused. F1 refocuses from anywhere.
// =============================================================

interface PosSearchBarProps {
  /** Called after a product is successfully added to the bill */
  onProductAdded?: () => void;
}

interface Product {
  id: string; name: string; code: string;
  barcode: string | null; mrp: number;
  salePrice: number; taxPct: number; unit: string;
}

const SCANNER_THRESHOLD_MS = 80;

export function PosSearchBar({ onProductAdded }: PosSearchBarProps) {
  const { activeBillId, addRowToBill } = usePosStore();

  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [scanFlash, setScanFlash] = useState<"ok" | "err" | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropRef     = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTime = useRef<number>(0);
  const isScanRef   = useRef(false);

  // ── Auto-focus on mount ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // ── F1 refocus ──────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Close dropdown on outside click ────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Add product row ─────────────────────────────────────────
  const addProduct = useCallback((p: Product) => {
    if (!activeBillId) return;
    const taxAmt = Math.round((p.salePrice * p.taxPct) / 100 * 100) / 100;
    const total  = Math.round((p.salePrice + taxAmt) * 100) / 100;
    const row: ProductRow = {
      id: nanoid(), product: p.name, code: p.code,
      productId: p.id, qty: 1,
      mrp: p.mrp, price: p.salePrice,
      discPct: 0, discAmt: 0, taxPct: p.taxPct, taxAmt,
      total,
    };
    addRowToBill(activeBillId, row);
    onProductAdded?.();
  }, [activeBillId, addRowToBill, onProductAdded]);

  // ── Barcode exact lookup ────────────────────────────────────
  const lookupExact = useCallback(async (code: string): Promise<boolean> => {
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
    } catch { /* fall through */ }
    return false;
  }, [addProduct]);

  // ── Manual search (debounced) ───────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    const t = q.trim();
    if (!t) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    try {
      const res = await http.get<{ success: boolean; data: Product[] }>(
        `/products`, { params: { search: t } }
      );
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data.slice(0, 12));
        setShowDrop(res.data.length > 0);
        setActiveIdx(-1);
      }
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  // ── Keyboard handler ────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const gap = now - lastKeyTime.current;
    lastKeyTime.current = now;

    if (e.key !== "Enter" && e.key.length === 1) {
      if (gap < SCANNER_THRESHOLD_MS) {
        isScanRef.current = true;
      } else {
        if (query.length === 0) isScanRef.current = false;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (isScanRef.current && query.trim()) {
        // Scanner path
        const code = query.trim();
        setQuery(""); setShowDrop(false); isScanRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        lookupExact(code).then((found) => {
          if (!found) { setScanFlash("err"); setTimeout(() => setScanFlash(null), 1000); }
        });
      } else if (showDrop && activeIdx >= 0) {
        // Manual path — pick highlighted
        addProduct(results[activeIdx]);
        setQuery(""); setResults([]); setShowDrop(false);
      } else if (query.trim() && results.length > 0) {
        // Auto-select first result on Enter
        addProduct(results[0]);
        setQuery(""); setResults([]); setShowDrop(false);
      }
      return;
    }

    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") { setShowDrop(false); setQuery(""); }
  }, [query, showDrop, activeIdx, results, addProduct, lookupExact]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!isScanRef.current) doSearch(val);
    }, 220);
  };

  // Border + glow based on state
  const borderColor = scanFlash === "ok"  ? "#22C55E"
                    : scanFlash === "err" ? "#EF4444"
                    : showDrop            ? "#F97316"
                    : "#CBD5E1";

  const boxShadow   = scanFlash === "ok"  ? "0 0 0 3px rgba(34,197,94,0.18)"
                    : scanFlash === "err" ? "0 0 0 3px rgba(239,68,68,0.18)"
                    : showDrop            ? "0 0 0 3px rgba(249,115,22,0.13)"
                    : "none";

  return (
    <div style={{
      padding: "10px 14px 0",
      background: "#fff",
      flexShrink: 0,
      position: "relative",
      zIndex: 200,
    }}>

      {/* ── Search bar container ────────────────────────────── */}
      <div style={{ position: "relative", width: "100%" }}>

        {/* Left: scanner / search icon with mode indicator */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 1,
        }}>
          {scanFlash === "ok" ? (
            <CheckCircle2 size={18} color="#22C55E" />
          ) : scanFlash === "err" ? (
            <ScanLine size={18} color="#EF4444" />
          ) : searching ? (
            <Loader2 size={18} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
          ) : (
            <Search size={18} color="#94A3B8" />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length) setShowDrop(true); }}
          placeholder="Search product name / code or scan barcode — press F1 to focus"
          autoComplete="off"
          spellCheck={false}
          style={{
            width: "100%",
            height: 44,
            border: `2px solid ${borderColor}`,
            borderRadius: 10,
            padding: "0 100px 0 44px",
            fontSize: 14,
            color: "#1E293B",
            background: "#FAFAFA",
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
            boxShadow,
            boxSizing: "border-box",
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.background = "#FAFAFA";
          }}
        />

        {/* Right side of input: status badges */}
        <div style={{
          position: "absolute", right: 10, top: 0, bottom: 0,
          display: "flex", alignItems: "center", gap: 6,
          pointerEvents: "none",
        }}>
          {scanFlash === "ok" && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.10)", borderRadius: 5, padding: "2px 7px" }}>Added ✓</span>
          )}
          {scanFlash === "err" && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,0.10)", borderRadius: 5, padding: "2px 7px" }}>Not found</span>
          )}
          {!scanFlash && !searching && (
            <>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", borderRadius: 5, padding: "2px 6px", letterSpacing: "0.03em" }}>F1</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", borderRadius: 5, padding: "2px 6px", letterSpacing: "0.03em" }}>SCAN</span>
            </>
          )}
        </div>

        {/* ── Dropdown results ───────────────────────────────── */}
        <AnimatePresence>
          {showDrop && results.length > 0 && (
            <motion.div
              ref={dropRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0, right: 0,
                background: "#fff",
                border: "1.5px solid #E2E8F0",
                borderRadius: 12,
                boxShadow: "0 12px 40px rgba(0,0,0,0.13)",
                maxHeight: 340,
                overflowY: "auto",
                zIndex: 500,
              }}
            >
              {/* Dropdown header */}
              <div style={{
                padding: "7px 14px 6px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: 11, color: "#CBD5E1" }}>↑↓ navigate · Enter to add</span>
              </div>

              {/* Results */}
              {results.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => {
                    addProduct(p);
                    setQuery(""); setResults([]); setShowDrop(false);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 14px",
                    cursor: "pointer",
                    background: idx === activeIdx ? "#FFF7ED" : "transparent",
                    borderBottom: "1px solid #F8FAFC",
                    transition: "background 0.08s",
                  }}
                >
                  {/* Left: product info */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: "#1E293B",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, display: "flex", gap: 8 }}>
                      <span>{p.code}</span>
                      {p.unit && <span>· {p.unit}</span>}
                      {p.taxPct > 0 && <span>· GST {p.taxPct}%</span>}
                      {p.barcode && <span style={{ color: "#CBD5E1" }}>· {p.barcode}</span>}
                    </div>
                  </div>

                  {/* Right: price */}
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#F97316" }}>
                      ₹{p.salePrice.toFixed(2)}
                    </div>
                    {p.mrp > p.salePrice && (
                      <div style={{ fontSize: 10, color: "#CBD5E1", textDecoration: "line-through" }}>
                        ₹{p.mrp.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* No results state */}
          {showDrop && !searching && results.length === 0 && query.trim() && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0, right: 0,
                background: "#fff",
                border: "1.5px solid #E2E8F0",
                borderRadius: 12,
                boxShadow: "0 12px 40px rgba(0,0,0,0.13)",
                padding: "18px 14px",
                textAlign: "center",
                fontSize: 13,
                color: "#94A3B8",
                zIndex: 500,
              }}
            >
              No products found for "<strong style={{ color: "#475569" }}>{query}</strong>"
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
