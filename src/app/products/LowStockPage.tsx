import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw, TrendingDown, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart } from "lucide-react";
import { http } from "@/lib/axios";

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  currentStock: number;
  lowStockAlert: number;
  stockValue: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}
interface ApiResponse<T> { success: boolean; data: T; }

type SortKey = "currentStock" | "stockValue" | "productName" | null;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

function fmtAmt(n: number) {
  const neg = n < 0;
  const s = Math.abs(n).toFixed(2);
  const val = `₹${s.endsWith(".00") ? s.slice(0, -3) : s}`;
  return neg ? `-${val}` : val;
}

function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function exportCsv(items: InventoryItem[]) {
  const header = ["Product", "Code", "Unit", "Current Stock", "Threshold", "Stock Value", "Status"];
  const rows = items.map((i) => [
    i.productName,
    i.productCode,
    i.unit,
    String(i.currentStock),
    String(i.lowStockAlert),
    i.stockValue.toFixed(2),
    i.status === "OUT_OF_STOCK" ? "Out of Stock" : "Low Stock",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `low-stock-${toStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LowStockPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("currentStock");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["inventory-low"],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ items: InventoryItem[]; summary: unknown }>>("/inventory");
      if (!res.success) throw new Error("Failed");
      return res.data.items;
    },
    staleTime: 30_000,
  });

  const allItems = data ?? [];
  const lowStock  = allItems.filter((i) => i.status === "LOW_STOCK");
  const outOfStock = allItems.filter((i) => i.status === "OUT_OF_STOCK");
  const criticalAll = [...outOfStock, ...lowStock];

  const filtered = useMemo(() => {
    if (!search) return criticalAll;
    const q = search.toLowerCase();
    return criticalAll.filter((i) =>
      i.productName.toLowerCase().includes(q) || i.productCode.toLowerCase().includes(q)
    );
  }, [criticalAll, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "currentStock") cmp = a.currentStock - b.currentStock;
      else if (sortKey === "stockValue") cmp = a.stockValue - b.stockValue;
      else if (sortKey === "productName") cmp = a.productName.localeCompare(b.productName);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["inventory-low"] });
    await refetch();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={12} color="#F97316" /> : <ArrowDown size={12} color="#F97316" />;
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Low Stock Alert</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {outOfStock.length} out of stock · {lowStock.length} below threshold
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => sorted.length && exportCsv(sorted)} style={iconBtn} title="Export CSV" disabled={!sorted.length}>
            <Download size={15} color={sorted.length ? "#64748B" : "#CBD5E1"} />
          </button>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Out of Stock", value: outOfStock.length, color: "#DC2626", bg: "rgba(239,68,68,0.08)", icon: <TrendingDown size={20} color="#DC2626" /> },
          { label: "Low Stock",    value: lowStock.length,   color: "#A16207", bg: "rgba(234,179,8,0.08)", icon: <AlertTriangle size={20} color="#EAB308" /> },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12,
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
        padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 320 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
            transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search product or code…"
            style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
              padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569",
              background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        </div>
      </div>

      {isLoading && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "48px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading inventory…</span>
          </div>
        </div>
      )}

      {isError && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12,
          padding: "20px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
          Backend not connected
        </div>
      )}

      {!isLoading && !isError && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("productName")}>
                    Product <SortIcon col="productName" />
                  </button>
                </th>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("currentStock")}>
                    Current Stock <SortIcon col="currentStock" />
                  </button>
                </th>
                <th style={thStyle}>Threshold</th>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("stockValue")}>
                    Stock Value <SortIcon col="stockValue" />
                  </button>
                </th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "64px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                      {search ? `No products matching "${search}"` : "All products are well stocked 🎉"}
                    </div>
                    {search && (
                      <button onClick={() => setSearch("")}
                        style={{ fontSize: 12, color: "#F97316", background: "none", border: "none",
                          cursor: "pointer", textDecoration: "underline" }}>
                        Clear search
                      </button>
                    )}
                  </div>
                </td></tr>
              )}
              <AnimatePresence initial={false}>
                {pageItems.map((item, idx) => {
                  const isOut = item.status === "OUT_OF_STOCK";
                  const noThreshold = item.lowStockAlert === 0;
                  return (
                    <motion.tr key={item.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: idx < pageItems.length - 1 ? "1px solid #F1F5F9" : "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.productName}</td>
                      <td style={tdStyle}><code style={chip}>{item.productCode}</code></td>
                      <td style={{ ...tdStyle, color: "#64748B" }}>{item.unit}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: isOut ? "#DC2626" : "#A16207", fontSize: 14 }}>
                        {item.currentStock}
                      </td>
                      <td style={{ ...tdStyle, color: noThreshold ? "#CBD5E1" : "#64748B" }}>
                        {noThreshold ? (
                          <span title="No alert threshold set" style={{ fontStyle: "italic" }}>Not set</span>
                        ) : item.lowStockAlert}
                      </td>
                      <td style={{ ...tdStyle, color: item.stockValue < 0 ? "#DC2626" : "#475569" }}>
                        {fmtAmt(item.stockValue)}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                          background: isOut ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                          color:      isOut ? "#DC2626"              : "#A16207" }}>
                          {isOut ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button style={restockBtn} title="Create purchase order">
                          <ShoppingCart size={12} /> Restock
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={paginationRow}>
              <span style={{ fontSize: 13, color: "#64748B" }}>
                Page <strong>{page}</strong> of {totalPages} · {sorted.length} total
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn:       React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle:       React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const sortHeaderBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer" };
const tdStyle:       React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:          React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const restockBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid #FDBA74", background: "rgba(249,115,22,0.06)", color: "#F97316", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });