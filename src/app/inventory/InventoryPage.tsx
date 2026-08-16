import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Package, TrendingUp, AlertTriangle, TrendingDown, RefreshCw, X, Loader2, CheckCircle2, Edit2, Plus, Search, Trash2, Download } from "lucide-react";
import { http } from "@/lib/axios";
import { useInfiniteScroll } from "@/hooks";

interface InventoryItem {
  id: string; productId: string; productName: string; productCode: string;
  unit: string; openingStock: number; stockIn: number; stockOut: number;
  currentStock: number; lowStockAlert: number; stockValue: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}
interface InventorySummary {
  total: number; inStock: number; lowStock: number; outOfStock: number; totalValue: number;
}
interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  IN_STOCK:     { bg: "rgba(34,197,94,0.1)",  color: "#16A34A", label: "In Stock"    },
  LOW_STOCK:    { bg: "rgba(234,179,8,0.1)",  color: "#A16207", label: "Low Stock"   },
  OUT_OF_STOCK: { bg: "rgba(239,68,68,0.1)",  color: "#DC2626", label: "Out of Stock" },
};

const UNIT_OPTIONS = ["PIECES", "METERS", "KG", "BOX", "DOZEN", "PAIR"];

const PAGE_SIZE = 50;

/* ---------------- Animated rolling number ---------------- */

function AnimatedDigit({ digit }: { digit: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
        height: "1.2em",
        lineHeight: "1.2em",
        width: "0.62em",
        textAlign: "center",
      }}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            display: "block",
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef  = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf: number;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed  = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.round(fromRef.current + (value - fromRef.current) * eased);
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const chars = String(display).split("");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
      {chars.map((ch, i) => <AnimatedDigit key={i} digit={ch} />)}
    </span>
  );
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [filter,       setFilter]       = useState<"ALL"|"IN_STOCK"|"LOW_STOCK"|"OUT_OF_STOCK">("ALL");
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, isFetching, refetch,
  } = useInfiniteQuery({
    queryKey: ["inventory", filter],
    queryFn: async ({ pageParam = 1 }) => {
      const url = `/inventory?page=${pageParam}&pageSize=${PAGE_SIZE}${filter !== "ALL" ? `&status=${filter}` : ""}`;
      const res = await http.get<ApiResponse<{ items: InventoryItem[]; summary: InventorySummary; total: number }>>(url);
      if (!res.success) throw new Error("Failed");
      return { ...res.data, page: pageParam as number };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * PAGE_SIZE;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const summary  = data?.pages[0]?.summary ?? { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
  const total    = data?.pages[0]?.total ?? 0;

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) => it.productName.toLowerCase().includes(q) || it.productCode.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); },
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
  });

  const onSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["inventory"] });
    setAdjustTarget(null);
  }, [qc]);

  const onCreated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["inventory"] });
    setShowCreate(false);
  }, [qc]);

  const handleRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["inventory"], refetchType: "active" });
    await refetch();
  }, [qc, refetch]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = items.length > 0 && items.every((it) => selected.has(it.id));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        items.forEach((it) => next.delete(it.id));
      } else {
        items.forEach((it) => next.add(it.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ok = window.confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`);
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      const res = await http.post<{ success: boolean }>("/products/bulk-delete", { ids });
      if (res.success) {
        clearSelection();
        qc.invalidateQueries({ queryKey: ["inventory"] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportSelected = () => {
    const rows = items.filter((it) => selected.has(it.id));
    const header = ["Product", "Code", "Unit", "Opening", "Stock In", "Stock Out", "Current Stock", "Stock Value", "Status"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [r.productName, r.productCode, r.unit, r.openingStock, r.stockIn, r.stockOut, r.currentStock, r.stockValue.toFixed(2), STATUS_STYLE[r.status]?.label ?? r.status]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "24px 28px", height: "100%", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Inventory</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            Real-time stock levels · Total value:{" "}
            <strong style={{ color: "#F97316" }}>₹{summary.totalValue.toFixed(2)}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button type="button" onClick={() => setShowCreate(true)} style={primaryBtn}>
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16, flexShrink: 0 }}>
        {[
          { icon: <Package size={20} color="#F97316" />,       label: "Total Products", value: summary.total,      color: "#F97316", f: "ALL"          },
          { icon: <TrendingUp size={20} color="#22C55E" />,    label: "In Stock",       value: summary.inStock,    color: "#22C55E", f: "IN_STOCK"     },
          { icon: <AlertTriangle size={20} color="#EAB308" />, label: "Low Stock",      value: summary.lowStock,   color: "#EAB308", f: "LOW_STOCK"    },
          { icon: <TrendingDown size={20} color="#EF4444" />,  label: "Out of Stock",   value: summary.outOfStock, color: "#EF4444", f: "OUT_OF_STOCK" },
        ].map((c) => (
          <button key={c.label} onClick={() => setFilter(c.f as typeof filter)} style={{
            background: "#fff", border: `1.5px solid ${filter === c.f ? c.color : "#E2E8F0"}`,
            borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
            cursor: "pointer", textAlign: "left",
            boxShadow: filter === c.f ? `0 0 0 3px ${c.color}22` : "none", transition: "all 0.15s",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>
                <AnimatedNumber value={c.value} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + Bulk action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or code..."
            style={{ ...inputStyle, paddingLeft: 34, background: "#fff" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 8, padding: "6px 12px" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#9A3412" }}>{selected.size} selected</span>
              <button onClick={handleExportSelected} style={bulkBtn} title="Export selected as CSV">
                <Download size={13} /> Export
              </button>
              <button onClick={() => void handleBulkDelete()} disabled={bulkDeleting} style={{ ...bulkBtn, color: "#DC2626", borderColor: "#FCA5A5" }} title="Delete selected">
                {bulkDeleting ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Trash2 size={13} />} Delete
              </button>
              <button onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412" }}>
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {search && (
          <span style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} result{items.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Scrollable table */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ ...thStyle, width: 36 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} style={{ cursor: "pointer" }} />
                </th>
                {["Product","Code","Unit","Opening","Stock In","Stock Out","Current Stock","Stock Value","Status",""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} style={{ padding: "48px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading inventory…</span>
                </div>
              </td></tr>}
              {isError && <tr><td colSpan={11} style={{ padding: "48px", textAlign: "center", color: "#EF4444" }}>
                <AlertTriangle size={22} /> Backend not connected
              </td></tr>}
              {!isLoading && !isError && items.length === 0 && (
                <tr><td colSpan={11} style={{ padding: "64px", textAlign: "center" }}>
                  <div style={{ marginTop: 10, fontWeight: 600, color: "#94A3B8" }}>
                    {search ? `No products match "${search}"` : filter === "ALL" ? "No products in inventory yet." : `No products with status "${filter.replace("_"," ")}"`}
                  </div>
                </td></tr>
              )}
              <AnimatePresence initial={false}>
                {items.map((item, idx) => {
                  const ss = STATUS_STYLE[item.status] ?? STATUS_STYLE.OUT_OF_STOCK;
                  const isSelected = selected.has(item.id);
                  return (
                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: idx < items.length - 1 ? "1px solid #F1F5F9" : "none", background: isSelected ? "#FFF7ED" : "transparent" }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isSelected ? "#FFF7ED" : "transparent"; }}>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(item.id)} style={{ cursor: "pointer" }} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.productName}</td>
                      <td style={tdStyle}><code style={chip}>{item.productCode}</code></td>
                      <td style={{ ...tdStyle, color: "#64748B" }}>{item.unit}</td>
                      <td style={{ ...tdStyle, color: "#64748B" }}>{item.openingStock}</td>
                      <td style={{ ...tdStyle, color: "#22C55E", fontWeight: 600 }}>+{item.stockIn}</td>
                      <td style={{ ...tdStyle, color: "#EF4444", fontWeight: 600 }}>-{item.stockOut}</td>
                      <td style={{ ...tdStyle, fontSize: 14, fontWeight: 800, color: item.currentStock <= 0 ? "#EF4444" : item.currentStock <= item.lowStockAlert ? "#EAB308" : "#0F172A" }}>
                        {item.currentStock}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#475569" }}>₹{item.stockValue.toFixed(2)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: ss.bg, color: ss.color }}>{ss.label}</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => setAdjustTarget(item)} style={rowIconBtn} title="Adjust stock"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {isFetchingNextPage && (
          <div style={{ padding: "14px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#94A3B8", fontSize: 13 }}>
            <Loader2 size={16} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} /> Loading more…
          </div>
        )}
        {!hasNextPage && items.length > 0 && !search && (
          <div style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#CBD5E1" }}>
            All {total} items loaded
          </div>
        )}
      </div>

      <AnimatePresence>
        {adjustTarget && <AdjustStockDialog item={adjustTarget} onClose={() => setAdjustTarget(null)} onSaved={onSaved} />}
        {showCreate && <CreateProductDialog onClose={() => setShowCreate(false)} onSaved={onCreated} />}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ---------------- Adjust existing stock ---------------- */

function AdjustStockDialog({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [openingStock, setOpeningStock] = useState(String(item.openingStock));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingStock);
    if (isNaN(val) || val < 0) { setError("Enter a valid non-negative number."); return; }
    setLoading(true);
    try {
      const res = await http.put<{ success: boolean }>(`/inventory/${item.productId}/adjust`, { openingStock: val });
      if (res.success) onSaved(); else setError("Failed to adjust stock.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  };

  const newCurrent = (parseFloat(openingStock) || 0) + item.stockIn - item.stockOut;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Adjust Opening Stock</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{item.productName} · {item.productCode}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[{ label: "Stock In", value: `+${item.stockIn}`, color: "#22C55E" }, { label: "Stock Out", value: `-${item.stockOut}`, color: "#EF4444" }, { label: "New Total", value: String(newCurrent), color: newCurrent <= 0 ? "#EF4444" : "#0F172A" }].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <label style={labelStyle}>Opening Stock ({item.unit})</label>
          <input type="text" inputMode="decimal" value={openingStock} onChange={(e) => { setOpeningStock(e.target.value); setError(""); }} style={inputStyle} autoFocus />
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 5 }}>
            Current stock will become <strong style={{ color: "#F97316" }}>{newCurrent}</strong> {item.unit}
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...primaryBtnFull, flex: 2, justifyContent: "center" }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> Apply Adjustment</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ---------------- Add new product ---------------- */

function CreateProductDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [productName,   setProductName]   = useState("");
  const [productCode,   setProductCode]   = useState("");
  const [unit,          setUnit]          = useState("PIECES");
  const [openingStock,  setOpeningStock]  = useState("0");
  const [lowStockAlert, setLowStockAlert] = useState("5");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice,  setSellingPrice]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!productName.trim())  return setError("Product name is required.");
    if (!productCode.trim())  return setError("Product code / SKU is required.");

    const opening = parseFloat(openingStock);
    const low     = parseFloat(lowStockAlert);
    const cost    = purchasePrice ? parseFloat(purchasePrice) : 0;
    const sell    = sellingPrice  ? parseFloat(sellingPrice)  : 0;

    if (isNaN(opening) || opening < 0) return setError("Opening stock must be a valid non-negative number.");
    if (isNaN(low) || low < 0)         return setError("Low stock alert must be a valid non-negative number.");
    if (purchasePrice && (isNaN(cost) || cost < 0)) return setError("Purchase price must be a valid non-negative number.");
    if (sellingPrice  && (isNaN(sell) || sell < 0)) return setError("Selling price must be a valid non-negative number.");

    setLoading(true);
    try {
      const res = await http.post<{ success: boolean }>("/products", {
        productName: productName.trim(),
        productCode: productCode.trim(),
        unit,
        openingStock: opening,
        lowStockAlert: low,
        purchasePrice: cost,
        sellingPrice: sell,
      });
      if (res.success) onSaved(); else setError("Failed to create product.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Add Product</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Create a new inventory item</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px", overflowY: "auto" }}>
          <label style={labelStyle}>Product Name *</label>
          <input type="text" value={productName} onChange={(e) => { setProductName(e.target.value); setError(""); }}
            placeholder="e.g. 1056 RAMA 30 SAREE" style={{ ...inputStyle, marginBottom: 14 }} autoFocus />

          <label style={labelStyle}>Product Code / SKU *</label>
          <input type="text" value={productCode} onChange={(e) => { setProductCode(e.target.value); setError(""); }}
            placeholder="e.g. 1110285257" style={{ ...inputStyle, marginBottom: 14 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle}>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Opening Stock</label>
              <input type="text" inputMode="decimal" value={openingStock}
                onChange={(e) => { setOpeningStock(e.target.value); setError(""); }} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Low Stock Alert Level</label>
            <input type="text" inputMode="decimal" value={lowStockAlert}
              onChange={(e) => { setLowStockAlert(e.target.value); setError(""); }} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
            <div>
              <label style={labelStyle}>Purchase Price (₹)</label>
              <input type="text" inputMode="decimal" value={purchasePrice}
                onChange={(e) => { setPurchasePrice(e.target.value); setError(""); }} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Selling Price (₹)</label>
              <input type="text" inputMode="decimal" value={sellingPrice}
                onChange={(e) => { setSellingPrice(e.target.value); setError(""); }} placeholder="0.00" style={inputStyle} />
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 10 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...primaryBtnFull, flex: 2, justifyContent: "center" }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> Add Product</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const iconBtn:       React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle:       React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em", whiteSpace: "nowrap", background: "hsl(var(--background))" };
const tdStyle:       React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:          React.CSSProperties = { fontSize: 12, background: "hsl(var(--muted))", borderRadius: 4, padding: "2px 6px", color: "hsl(var(--foreground))" };
const rowIconBtn:    React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", justifyContent: "center" };
const primaryBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const primaryBtnFull:React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const cancelBtn:     React.CSSProperties = { flex: 1, padding: "9px 0", border: "1.5px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const labelStyle:    React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 5 };
const inputStyle:    React.CSSProperties = { width: "100%", border: "1.5px solid hsl(var(--border))", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "hsl(var(--foreground))", outline: "none", fontFamily: "inherit", background: "hsl(var(--background))", boxSizing: "border-box" as const };
const bulkBtn:        React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", cursor: "pointer", fontFamily: "inherit" };