import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, Truck } from "lucide-react";
import { http } from "@/lib/axios";

interface Challan {
  id: string;
  challanNumber: string;
  customerName: string;
  challanDate: string;
  vehicleNo: string | null;
  status: string;
  itemCount: number;
}
interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "rgba(234,179,8,0.1)",  color: "#A16207" },
  DELIVERED: { bg: "rgba(34,197,94,0.1)",  color: "#16A34A" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

export default function DeliveryChallanPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["challans", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: Challan[]; total: number }>>(`/sales/challans?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const challans = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["challans"], refetchType: "active" });
    await qc.refetchQueries({ queryKey: ["challans"], type: "active" });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Delivery Challans</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} challan{total !== 1 ? "s" : ""}</div>
        </div>
        <button type="button" onClick={() => { void handleRefresh(); }} style={iconBtn}>
          <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Challan #", "Customer", "Date", "Vehicle No.", "Items", "Status"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>}
            {isError && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#EF4444" }}><AlertTriangle size={18} /> Backend not connected</td></tr>}
            {!isLoading && !isError && challans.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>
                <Truck size={40} color="#E2E8F0" />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94A3B8" }}>No delivery challans yet</div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {challans.map((c, idx) => {
                const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.PENDING;
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < challans.length - 1 ? "1px solid #F1F5F9" : "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}><code style={chip}>{c.challanNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c.customerName}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(c.challanDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...tdStyle, color: "#94A3B8" }}>{c.vehicleNo ?? "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{c.itemCount}</td>
                    <td style={tdStyle}><span style={{ ...badge, background: sc.bg, color: sc.color }}>{c.status}</span></td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>Page <strong>{page}</strong> of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer" });
