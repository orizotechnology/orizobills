import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, RotateCcw, Plus, Search, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";

interface PurchaseReturn {
  id: string;
  returnNumber: string;
  supplierName: string;
  returnDate: string;
  totalAmt: number;
  status: string;
  reason?: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "rgba(234,179,8,0.1)", color: "#A16207" },
  COMPLETED: { bg: "rgba(34,197,94,0.1)", color: "#16A34A" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
};

const STATUS_FILTERS = ["All", "PENDING", "COMPLETED", "CANCELLED"];
const FILTERS = ["All", "This Month", "Today"];

function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function exportCsv(returns: PurchaseReturn[]) {
  const header = ["Return #", "Supplier", "Date", "Total", "Status", "Reason"];
  const rows = returns.map((r) => [
    r.returnNumber,
    r.supplierName,
    r.returnDate,
    r.totalAmt.toFixed(2),
    r.status,
    r.reason ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchase-returns-${toStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PurchaseReturnPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [fromDate, setFromDate] = useState(toStr(new Date()));
  const [toDate, setToDate] = useState(toStr(new Date()));

  const dateRange = (() => {
    const now = new Date();
    const today = toStr(now);
    if (filter === "All") return { start: "", end: "" };
    if (filter === "Custom") return { start: fromDate, end: toDate };
    if (filter === "Today") return { start: today, end: today };
    if (filter === "This Month") {
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
    }
    return { start: "", end: "" };
  })();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["purchase-returns", page, dateRange.start, dateRange.end],
    queryFn: async () => {
      let url = `/purchases/returns?page=${page}&pageSize=20`;
      if (dateRange.start && dateRange.end) url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const res = await http.get<ApiResponse<{ data: PurchaseReturn[]; total: number }>>(url);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allReturns = data?.data ?? [];
  const returns = useMemo(() => {
    return allReturns.filter((r) => {
      const matchSearch = !search ||
        r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.supplierName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusF === "All" || r.status === statusF;
      return matchSearch && matchStatus;
    });
  }, [allReturns, search, statusF]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const sumTotal = returns.reduce((s, r) => s + r.totalAmt, 0);

  const handleRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["purchase-returns"], refetchType: "active" }),
      qc.invalidateQueries({ queryKey: ["inventory"], refetchType: "active" }),
      qc.refetchQueries({ queryKey: ["purchase-returns"], type: "active" }),
      qc.refetchQueries({ queryKey: ["inventory"], type: "active" }),
    ]);
    await refetch();
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Purchase Returns</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} return{total !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => returns.length && exportCsv(returns)} style={iconBtn} title="Export CSV" disabled={!returns.length}>
            <Download size={15} color={returns.length ? "#64748B" : "#CBD5E1"} />
          </button>
          <button type="button" onClick={() => { void handleRefresh(); }} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button type="button" onClick={() => navigate("/app/purchase/returns/new")} style={primaryBtn}>
            <Plus size={15} /> New Return
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search return or supplier…"
              style={{
                width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
                padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569",
                background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
          </div>

          <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>PERIOD</span>
            {FILTERS.map((f) => (
              <button key={f} type="button" onClick={() => handleFilterChange(f)}
                style={{
                  padding: "5px 13px", borderRadius: 6,
                  border: filter === f ? "none" : "1px solid #E2E8F0",
                  background: filter === f ? "#F97316" : "#fff",
                  color: filter === f ? "#fff" : "#64748B",
                  fontWeight: filter === f ? 700 : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
                }}>
                {f}
              </button>
            ))}
          </div>

          {filter === "Custom" && (
            <>
              <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>From</span>
                <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} style={dateInp} />
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>To</span>
                <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} style={dateInp} />
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>STATUS</span>
          {STATUS_FILTERS.map((s) => {
            const active = statusF === s;
            const sc = STATUS_COLOR[s];
            return (
              <button key={s} type="button" onClick={() => { setStatusF(s); setPage(1); }}
                style={{
                  padding: "4px 12px", borderRadius: 6,
                  border: active ? "none" : "1px solid #E2E8F0",
                  background: active ? (sc?.bg ?? "#F97316") : "#fff",
                  color: active ? (sc?.color ?? "#fff") : "#64748B",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
                }}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {returns.length > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 10, padding: "10px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>{returns.length} return{returns.length !== 1 ? "s" : ""} shown</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#EF4444" }}>₹{sumTotal.toFixed(2)}</span>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Return #", "Supplier", "Date", "Reason", "Total", "Status"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} style={tdStyle}>
                    <div style={{ height: 14, borderRadius: 4, background: "#F1F5F9", animation: "pulse 1.4s ease-in-out infinite", width: j === 1 ? "70%" : j === 4 ? "50%" : "60%" }} />
                  </td>
                ))}
              </tr>
            ))}

            {isError && (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Backend not connected
                </div>
              </td></tr>
            )}

            {!isLoading && !isError && returns.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RotateCcw size={20} color="#94A3B8" />
                  </div>
                  <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                    {search ? `No returns matching "${search}"` : "No purchase returns yet"}
                  </div>
                  {(statusF !== "All" || filter !== "All") && (
                    <button type="button" onClick={() => { setStatusF("All"); setFilter("All"); setPage(1); }}
                      style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Clear filters
                    </button>
                  )}
                  {!search && statusF === "All" && filter === "All" && (
                    <button type="button" onClick={() => navigate("/app/purchase/returns/new")} style={{ ...primaryBtn, marginTop: 4 }}>
                      <Plus size={14} /> Create first return
                    </button>
                  )}
                </div>
              </td></tr>
            )}

            <AnimatePresence initial={false}>
              {returns.map((r, idx) => {
                const sc = STATUS_COLOR[r.status] ?? STATUS_COLOR.PENDING;
                return (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < returns.length - 1 ? "1px solid #F1F5F9" : "none", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}><code style={chip}>{r.returnNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{r.supplierName}</td>
                    <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(r.returnDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ ...tdStyle, color: "#94A3B8" }}>{r.reason ?? "—"}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#EF4444" }}>₹{r.totalAmt.toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: sc.bg, color: sc.color }}>{r.status}</span>
                    </td>
                  </motion.tr>
                );
              })}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const dateInp: React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "#0F172A", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });