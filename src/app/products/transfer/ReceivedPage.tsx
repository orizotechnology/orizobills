import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, RefreshCw, AlertTriangle } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// RECEIVED PAGE — products received by this branch from others
// Groups by source branch — each source shown separately
// =============================================================

interface StockTransfer {
  id: string; transferRef: string; direction: "OUT" | "IN";
  fromBranchId: string; fromBranchName: string;
  toBranchId: string; toBranchName: string;
  productId: string | null; productName: string; productCode: string;
  quantity: number; unit: string; notes: string | null;
  status: string; transferDate: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReceivedPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["transfers-received"],
    queryFn:  async () => {
      const res = await http.get<ApiResponse<{ data: StockTransfer[]; total: number }>>("/transfers/received?pageSize=500");
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
  });

  const transfers = data?.data ?? [];
  const total     = data?.total ?? 0;

  // Group by source branch — each branch shown separately
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; items: StockTransfer[] }> = {};
    transfers.forEach((t) => {
      if (!map[t.fromBranchId]) map[t.fromBranchId] = { name: t.fromBranchName, items: [] };
      map[t.fromBranchId].items.push(t);
    });
    return Object.entries(map).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [transfers]);

  const totalQty = transfers.reduce((s, t) => s + t.quantity, 0);

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["transfers-received"] });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Products Received</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            Stock received by this branch from other branches
          </div>
        </div>
        <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
          <RefreshCw size={15} color="#64748B"
            style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Summary strip */}
      {transfers.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Received",       value: String(total),           color: "#22C55E" },
            { label: "Source Branches",       value: String(grouped.length), color: "#8B5CF6" },
            { label: "Total Units Received",  value: totalQty.toFixed(0),    color: "#F97316" },
          ].map((c) => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "48px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading received stock…</span>
          </div>
        </div>
      )}

      {isError && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12,
          padding: "20px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
          <AlertTriangle size={16} style={{ display: "inline", marginRight: 6 }} /> Backend not connected
        </div>
      )}

      {!isLoading && !isError && grouped.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "64px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 600, color: "#94A3B8" }}>No stock received yet</div>
            <div style={{ fontSize: 12, color: "#CBD5E1" }}>When another branch transfers stock to you, it will appear here</div>
          </div>
        </div>
      )}

      {/* Grouped by source branch — each branch in its own card */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {grouped.map(([branchId, { name, items }]) => {
          const branchTotal = items.reduce((s, t) => s + t.quantity, 0);
          return (
            <div key={branchId} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>

              {/* Branch header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowDownLeft size={16} color="#16A34A" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>From: {name}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} transfer{items.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>
                  +{branchTotal.toFixed(0)} units received
                </div>
              </div>

              {/* Transfer rows for this source branch */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Date", "Product", "Code", "Qty", "Unit", "Notes", "Status"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {items.map((t, idx) => (
                      <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>{fmtDate(t.transferDate)}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{t.productName}</td>
                        <td style={tdStyle}><code style={chip}>{t.productCode}</code></td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#22C55E" }}>+{t.quantity}</td>
                        <td style={{ ...tdStyle, color: "#64748B" }}>{t.unit}</td>
                        <td style={{ ...tdStyle, color: "#94A3B8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.notes ?? "—"}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                            background: "rgba(34,197,94,0.1)", color: "#16A34A" }}>
                            {t.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };
const chip:    React.CSSProperties = { fontSize: 12, background: "hsl(var(--muted))", borderRadius: 4, padding: "2px 6px", color: "hsl(var(--foreground))" };
