import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, FileText, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { http } from "@/lib/axios";

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  paymentMethod: string;
  totalAmt: number;
  paidAmt: number;
  balanceDue: number;
  status: string;
  itemCount: number;
}

interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PAID:      { bg: "rgba(34,197,94,0.1)",   color: "#16A34A" },
  PARTIAL:   { bg: "rgba(234,179,8,0.1)",   color: "#A16207" },
  UNPAID:    { bg: "rgba(239,68,68,0.1)",   color: "#DC2626" },
  DRAFT:     { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

export default function SaleInvoicesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sales", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: SaleInvoice[]; total: number }>>(`/sales?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const invoices = (data?.data ?? []).filter((i) =>
    !search || i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || i.customerName.toLowerCase().includes(search.toLowerCase())
  );
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const cancelMutation = useMutation({
    mutationFn: (id: string) => http.delete(`/sales/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Sale Invoices</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} invoice{total !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => refetch()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button style={primaryBtn}><Plus size={15} /> New Invoice</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice or customer…" style={searchInput} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Invoice #", "Customer", "Date", "Payment", "Items", "Total", "Paid", "Balance", "Status", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} style={loadingCell}><Spinner /> Loading invoices…</td></tr>}
            {isError && <tr><td colSpan={10} style={errorCell}><AlertTriangle size={20} color="#F97316" /> Could not load invoices. Is the backend running?</td></tr>}
            {!isLoading && !isError && invoices.length === 0 && (
              <tr><td colSpan={10} style={emptyCell}>
                <FileText size={40} color="#E2E8F0" />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94A3B8" }}>No invoices yet</div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {invoices.map((inv, idx) => {
                const sc = STATUS_COLOR[inv.status] ?? STATUS_COLOR.DRAFT;
                return (
                  <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < invoices.length - 1 ? "1px solid #F1F5F9" : "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}><code style={chip}>{inv.invoiceNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{inv.customerName}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{inv.paymentMethod}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{inv.itemCount}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#0F172A" }}>₹{inv.totalAmt.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: "#22C55E" }}>₹{inv.paidAmt.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: inv.balanceDue > 0 ? "#EF4444" : "#94A3B8" }}>
                      {inv.balanceDue > 0 ? `₹${inv.balanceDue.toFixed(2)}` : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...badge, background: sc.bg, color: sc.color }}>{inv.status}</span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => cancelMutation.mutate(inv.id)} style={rowIconBtn} title="Cancel invoice"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF1F2"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <Trash2 size={13} />
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

// ── Shared micro-styles ──────────────────────────────────────

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const searchInput: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const rowIconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
const loadingCell: React.CSSProperties = { padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13, display: "flex" as never };
const errorCell: React.CSSProperties = { padding: "48px", textAlign: "center", color: "#EF4444", fontSize: 13 };
const emptyCell: React.CSSProperties = { padding: "64px", textAlign: "center" };

function Spinner() {
  return <div style={{ width: 20, height: 20, border: "2.5px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", marginRight: 8 }} />;
}
