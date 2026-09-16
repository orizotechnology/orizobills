import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, TrendingDown, Wallet, Clock, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";

interface SaleReturnItem {
  id: string;
  productName: string;
  qty: number;
  price: number;
}

interface SaleReturn {
  id: string;
  returnNumber: string;
  customerName: string;
  returnDate: string;
  items: SaleReturnItem[];
  totalAmt: number;
  refundedAmt: number;
  status: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function fmtAmt(n: number | undefined | null) {
  const safe = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  return `₹${Math.round(safe)}`;
}

function SummaryCard({ icon, iconBg, label, value, valueColor }: {
  icon: ReactNode; iconBg: string; label: string; value: string; valueColor: string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: valueColor }}>{value}</div>
      </div>
    </div>
  );
}

type FilterKey = "all" | "month" | "today";

export default function SaleReturnPage() {
  const qc      = useQueryClient();
  const navigate = useNavigate();
  const today   = toStr(new Date());

  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deleteTarget, setDeleteTarget] = useState<SaleReturn | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete<{ success: boolean }>(`/sales/returns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-returns"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Failed to delete return");
      setDeleteTarget(null);
    },
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sale-returns", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: SaleReturn[]; total: number }>>(`/sales/returns?page=${page}&pageSize=100`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allReturns = data?.data ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const returns = useMemo(() => {
    const monthStart = today.slice(0, 8) + "01";
    return allReturns.filter((r) => {
      const matchSearch = !search ||
        r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.customerName.toLowerCase().includes(search.toLowerCase());
      const rDate = (r.returnDate ?? "").slice(0, 10);
      let matchFilter = true;
      if (filter === "today") matchFilter = rDate === today;
      if (filter === "month") matchFilter = rDate >= monthStart && rDate <= today;
      return matchSearch && matchFilter;
    });
  }, [allReturns, search, filter, today]);

  const totalReturnAmt = returns.reduce((s, r) => s + (r.totalAmt ?? 0), 0);
  const totalRefunded  = returns.reduce((s, r) => s + (r.refundedAmt ?? 0), 0);
  const totalPending   = returns.reduce((s, r) => s + Math.max((r.totalAmt ?? 0) - (r.refundedAmt ?? 0), 0), 0);

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["sale-returns"], refetchType: "active" });
    await refetch();
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all",   label: "All" },
    { key: "month", label: "This Month" },
    { key: "today", label: "Today" },
  ];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #E2E8F0" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>Sale Returns</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {total} return{total !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => navigate("/app/sales/returns/new")} style={primaryBtn}><Plus size={15} /> New Return</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12,
        padding: "12px 14px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", flex: 1, height: 40 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%",
            transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return or customer…"
            style={{ width: "100%", height: 40, border: "1px solid #E2E8F0", borderRadius: 8,
              padding: "0 14px 0 34px", fontSize: 13, color: "#475569",
              background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        </div>

        <div style={{ display: "flex", gap: 6, height: 40, flexShrink: 0 }}>
          {filters.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{
                height: 40, padding: "0 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                border: filter === key ? "none" : "1px solid #E2E8F0",
                background: filter === key ? "#F97316" : "#fff",
                color:      filter === key ? "#fff"    : "#64748B",
                cursor: "pointer", fontFamily: "inherit", outline: "none",
                whiteSpace: "nowrap",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
        <SummaryCard icon={<TrendingDown size={15} color="#EF4444" />} iconBg="rgba(239,68,68,0.1)"
          label="TOTAL RETURNED" value={fmtAmt(totalReturnAmt)} valueColor="#0F172A" />
        <SummaryCard icon={<Wallet size={15} color="#16A34A" />} iconBg="rgba(34,197,94,0.1)"
          label="TOTAL REFUNDED" value={fmtAmt(totalRefunded)} valueColor="#16A34A" />
        <SummaryCard icon={<Clock size={15} color="#F97316" />} iconBg="rgba(249,115,22,0.1)"
          label="PENDING REFUND" value={fmtAmt(totalPending)} valueColor="#F97316" />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Return #", "Customer", "Date", "Items", "Total", "Refunded", "Status", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Loading returns…
                </div>
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Backend not connected
                </div>
              </td></tr>
            )}
            {!isLoading && !isError && returns.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "64px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                    {search ? `No returns matching "${search}"` : "No sale returns yet"}
                  </div>
                </div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {returns.map((r, idx) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < returns.length - 1 ? "1px solid #F1F5F9" : "none", height: 52 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                  <td style={tdStyle}><code style={chip}>{r.returnNumber ?? "—"}</code></td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>{r.customerName ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                    {r.returnDate
                      ? new Date(r.returnDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{r.items?.length ?? 0}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#EF4444" }}>{fmtAmt(r.totalAmt)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#16A34A" }}>{fmtAmt(r.refundedAmt)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                      background: r.status === "PENDING" ? "rgba(249,115,22,0.1)" : "rgba(34,197,94,0.1)",
                      color: r.status === "PENDING" ? "#F97316" : "#16A34A" }}>
                      {r.status ?? "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => navigate(`/app/sales/returns/${r.id}/edit`)}
                        style={rowIconBtn} title="Edit"
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#F97316"; e.currentTarget.style.background = "#FFF7ED"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#CBD5E1"; e.currentTarget.style.background = "transparent"; }}>
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        style={rowIconBtn} title="Delete"
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FFF1F2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#CBD5E1"; e.currentTarget.style.background = "transparent"; }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>Page <strong>{page}</strong> of {totalPages} · {total} total</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setDeleteTarget(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Delete Return?</div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
                Return <strong>{deleteTarget.returnNumber}</strong> will be permanently deleted.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8,
                    background: "#EF4444", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: deleteMutation.isPending ? "not-allowed" : "pointer", opacity: deleteMutation.isPending ? 0.7 : 1 }}>
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn:    React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const rowIconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" };
const dateInp:    React.CSSProperties = { border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "hsl(var(--foreground))", background: "hsl(var(--card))", outline: "none", fontFamily: "inherit", cursor: "pointer" };
const thStyle:    React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle:    React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:       React.CSSProperties = { fontSize: 12, background: "hsl(var(--muted))", borderRadius: 4, padding: "2px 6px", color: "hsl(var(--foreground))" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid hsl(var(--muted))" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
