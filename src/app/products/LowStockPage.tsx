import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw, TrendingDown, Package } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// LOW STOCK PAGE
// Shows products whose currentStock <= lowStockAlert threshold.
// Data comes from GET /api/inventory which already calculates
// currentStock and status (IN_STOCK / LOW_STOCK / OUT_OF_STOCK).
// =============================================================

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

function fmtAmt(n: number) {
  const s = n.toFixed(2);
  return `₹${s.endsWith(".00") ? s.slice(0, -3) : s}`;
}

export default function LowStockPage() {
  const qc = useQueryClient();

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
  const critical   = [...outOfStock, ...lowStock]; // out of stock first, then low

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["inventory-low"] });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Low Stock Alert</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {outOfStock.length} out of stock · {lowStock.length} below threshold
          </div>
        </div>
        <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
          <RefreshCw size={15} color="#64748B"
            style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Summary cards */}
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

      {/* Loading */}
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

      {/* Table */}
      {!isLoading && !isError && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Product", "Code", "Unit", "Current Stock", "Threshold", "Stock Value", "Status"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {critical.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "64px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: "#94A3B8" }}>All products are well stocked 🎉</div>
                  </div>
                </td></tr>
              )}
              <AnimatePresence initial={false}>
                {critical.map((item, idx) => {
                  const isOut = item.status === "OUT_OF_STOCK";
                  return (
                    <motion.tr key={item.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: idx < critical.length - 1 ? "1px solid #F1F5F9" : "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.productName}</td>
                      <td style={tdStyle}><code style={chip}>{item.productCode}</code></td>
                      <td style={{ ...tdStyle, color: "#64748B" }}>{item.unit}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: isOut ? "#DC2626" : "#A16207", fontSize: 14 }}>
                        {item.currentStock}
                      </td>
                      <td style={{ ...tdStyle, color: "#64748B" }}>{item.lowStockAlert}</td>
                      <td style={{ ...tdStyle, color: "#475569" }}>{fmtAmt(item.stockValue)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                          background: isOut ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                          color:      isOut ? "#DC2626"              : "#A16207" }}>
                          {isOut ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:    React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
