import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, AlertTriangle, ShoppingCart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  billDate: string;
  paymentMethod: string;
  subtotal: number;
  discountAmt: number;
  taxAmt: number;
  totalAmt: number;
  status: string;
  itemCount: number;
}
interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  CONFIRMED: { bg: "rgba(34,197,94,0.1)",   color: "#16A34A" },
  DRAFT:     { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
  CANCELLED: { bg: "rgba(239,68,68,0.1)",   color: "#DC2626" },
};

export default function AllPurchasesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["purchases", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: PurchaseInvoice[]; total: number }>>(`/purchases?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const purchases = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const cancelMutation = useMutation({
    mutationFn: (id: string) => http.delete(`/purchases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchases"] }),
  });

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>All Purchases</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} purchase bill{total !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => refetch()} style={iconBtn}>
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => navigate("/app/purchase/new")} style={primaryBtn}>
            <Plus size={15} /> New Purchase
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Bill #", "Supplier", "Date", "Payment", "Items", "Subtotal", "Tax", "Total", "Status", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>}
            {isError && <tr><td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#EF4444" }}><AlertTriangle size={18} /> Backend not connected</td></tr>}
            {!isLoading && !isError && purchases.length === 0 && (
              <tr><td colSpan={10} style={{ padding: "64px", textAlign: "center" }}>
                <ShoppingCart size={40} color="#E2E8F0" />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94A3B8" }}>No purchases yet</div>
                <button onClick={() => navigate("/app/purchase/new")} style={{ ...primaryBtn, marginTop: 12 }}>
                  <Plus size={14} /> Create first purchase
                </button>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {purchases.map((p, idx) => {
                const sc = STATUS_COLOR[p.status] ?? STATUS_COLOR.DRAFT;
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < purchases.length - 1 ? "1px solid #F1F5F9" : "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}><code style={chip}>{p.invoiceNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{p.supplierName}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(p.billDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{p.paymentMethod}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{p.itemCount}</td>
                    <td style={{ ...tdStyle, color: "#475569" }}>₹{p.subtotal.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>₹{p.taxAmt.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#0F172A" }}>₹{p.totalAmt.toFixed(2)}</td>
                    <td style={tdStyle}><span style={{ ...badge, background: sc.bg, color: sc.color }}>{p.status}</span></td>
                    <td style={tdStyle}>
                      {p.status !== "CANCELLED" && (
                        <button onClick={() => cancelMutation.mutate(p.id)}
                          style={rowIconBtn} title="Cancel purchase"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF1F2"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
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

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const rowIconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer" });
