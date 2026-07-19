import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, TrendingUp, AlertTriangle, TrendingDown,
  RefreshCw, X, Loader2, CheckCircle2, Edit2,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// INVENTORY PAGE — live stock from DB
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

interface InventorySummary {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  IN_STOCK:     { bg: "rgba(34,197,94,0.1)",  color: "#16A34A", label: "In Stock"    },
  LOW_STOCK:    { bg: "rgba(234,179,8,0.1)",  color: "#A16207", label: "Low Stock"   },
  OUT_OF_STOCK: { bg: "rgba(239,68,68,0.1)",  color: "#DC2626", label: "Out of Stock" },
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ items: InventoryItem[]; summary: InventorySummary }>>("/inventory");
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
  });

  const items   = data?.items   ?? [];
  const summary = data?.summary ?? { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["inventory"] });
    setAdjustTarget(null);
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Inventory</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            Real-time stock levels · Total value: <strong style={{ color: "#F97316" }}>₹{summary.totalValue.toFixed(2)}</strong>
          </div>
        </div>
        <button onClick={() => refetch()} style={iconBtn} title="Refresh">
          <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: <Package size={20} color="#F97316" />,       label: "Total Products", value: String(summary.total),       color: "#F97316", filter: "ALL"          },
          { icon: <TrendingUp size={20} color="#22C55E" />,    label: "In Stock",       value: String(summary.inStock),     color: "#22C55E", filter: "IN_STOCK"     },
          { icon: <AlertTriangle size={20} color="#EAB308" />, label: "Low Stock",      value: String(summary.lowStock),    color: "#EAB308", filter: "LOW_STOCK"    },
          { icon: <TrendingDown size={20} color="#EF4444" />,  label: "Out of Stock",   value: String(summary.outOfStock),  color: "#EF4444", filter: "OUT_OF_STOCK" },
        ].map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter(c.filter as typeof filter)}
            style={{
              background: "#fff", border: `1.5px solid ${filter === c.filter ? c.color : "#E2E8F0"}`,
              borderRadius: 12, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", textAlign: "left",
              boxShadow: filter === c.filter ? `0 0 0 3px ${c.color}22` : "none",
              transition: "all 0.15s",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>{c.value}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Product", "Code", "Unit", "Opening", "Stock In", "Stock Out", "Current Stock", "Stock Value", "Status", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} style={{ padding: "48px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading inventory…</span>
                  </div>
                </td></tr>
              )}
              {isError && (
                <tr><td colSpan={10} style={{ padding: "48px", textAlign: "center", color: "#EF4444" }}>
                  <AlertTriangle size={22} /> Backend not connected — start the server to see live stock
                </td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ padding: "64px", textAlign: "center" }}>
                  <Package size={44} color="#E2E8F0" />
                  <div style={{ marginTop: 10, fontWeight: 600, color: "#94A3B8" }}>
                    {filter === "ALL" ? "No products in inventory yet. Add products to start tracking." : `No products with status "${filter.replace("_", " ")}"`}
                  </div>
                </td></tr>
              )}
              <AnimatePresence initial={false}>
                {filtered.map((item, idx) => {
                  const ss = STATUS_STYLE[item.status] ?? STATUS_STYLE.OUT_OF_STOCK;
                  return (
                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
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
                        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: ss.bg, color: ss.color }}>
                          {ss.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setAdjustTarget(item)}
                          style={rowIconBtn}
                          title="Adjust opening stock"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
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
      </div>

      {/* Adjust stock dialog */}
      <AnimatePresence>
        {adjustTarget && (
          <AdjustStockDialog item={adjustTarget} onClose={() => setAdjustTarget(null)} onSaved={onSaved} />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Adjust Opening Stock Dialog ───────────────────────────────

function AdjustStockDialog({
  item, onClose, onSaved,
}: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
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
      if (res.success) onSaved();
      else setError("Failed to adjust stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const newCurrent = (parseFloat(openingStock) || 0) + item.stockIn - item.stockOut;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Adjust Opening Stock</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{item.productName} · {item.productCode}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          {/* Read-only stock breakdown */}
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Stock In",  value: `+${item.stockIn}`,  color: "#22C55E" },
              { label: "Stock Out", value: `-${item.stockOut}`, color: "#EF4444" },
              { label: "New Total", value: String(newCurrent),  color: newCurrent <= 0 ? "#EF4444" : "#0F172A" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <label style={labelStyle}>Opening Stock ({item.unit})</label>
          <input
            type="number" min={0} step={0.001}
            value={openingStock}
            onChange={(e) => { setOpeningStock(e.target.value); setError(""); }}
            style={inputStyle}
            autoFocus
          />
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 5 }}>
            Current stock will become <strong style={{ color: "#F97316" }}>{newCurrent}</strong> {item.unit}
          </div>

          {error && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 8 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...primaryBtn, flex: 2, justifyContent: "center" }}>
              {loading
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                : <><CheckCircle2 size={14} /> Apply Adjustment</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const rowIconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { flex: 1, padding: "9px 0", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const };
