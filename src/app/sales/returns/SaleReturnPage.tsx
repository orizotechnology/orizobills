import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, RotateCcw, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";

interface SaleReturn {
  id: string;
  returnNumber: string;
  customerName: string;
  returnDate: string;
  totalAmt: number;
  status: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function fmtAmt(n: number) {
  const s = n.toFixed(2);
  return `₹${s.endsWith(".00") ? s.slice(0, -3) : s}`;
}

export default function SaleReturnPage() {
  const qc      = useQueryClient();
  const navigate = useNavigate();
  const today   = toStr(new Date());

  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

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

  // Client-side filter by search + date range
  const returns = useMemo(() => {
    return allReturns.filter((r) => {
      const matchSearch = !search ||
        r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.customerName.toLowerCase().includes(search.toLowerCase());
      const rDate = r.returnDate.slice(0, 10);
      const matchFrom = !fromDate || rDate >= fromDate;
      const matchTo   = !toDate   || rDate <= toDate;
      return matchSearch && matchFrom && matchTo;
    });
  }, [allReturns, search, fromDate, toDate]);

  const sumTotal = returns.reduce((s, r) => s + r.totalAmt, 0);

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["sale-returns"], refetchType: "active" });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #E2E8F0" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Sale Returns</div>
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

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
        padding: "12px 14px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
            transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return or customer…"
            style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
              padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569",
              background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        </div>

        <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />

        {/* From / To date filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>From</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={dateInp} />
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>To</span>
          <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   style={dateInp} />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); }}
              style={{ fontSize: 11, color: "#F97316", background: "none", border: "none",
                cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }}>
              Clear
            </button>
          )}
        </div>

        {/* Quick shortcuts */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {[
            { label: "Today",      from: today,                                to: today },
            { label: "This Month", from: today.slice(0, 8) + "01",             to: today },
          ].map(({ label, from, to }) => (
            <button key={label}
              onClick={() => { setFromDate(from); setToDate(to); }}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: fromDate === from && toDate === to ? "none" : "1px solid #E2E8F0",
                background: fromDate === from && toDate === to ? "#F97316" : "#fff",
                color:      fromDate === from && toDate === to ? "#fff"    : "#64748B",
                cursor: "pointer", fontFamily: "inherit", outline: "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────── */}
      {returns.length > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 10, padding: "10px 18px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {returns.length} return{returns.length !== 1 ? "s" : ""} shown
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#F97316" }}>
            {fmtAmt(sumTotal)}
          </span>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Return No", "Customer", "Date", "Amount", "Status"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Loading returns…
                </div>
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Backend not connected
                </div>
              </td></tr>
            )}
            {!isLoading && !isError && returns.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "64px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={40} color="#E2E8F0" />
                  <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                    {search ? `No returns matching "${search}"` : "No sale returns yet"}
                  </div>
                </div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {returns.map((r, idx) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < returns.length - 1 ? "1px solid #F1F5F9" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                  <td style={tdStyle}><code style={chip}>{r.returnNumber}</code></td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{r.customerName}</td>
                  <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                    {new Date(r.returnDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#EF4444" }}>{fmtAmt(r.totalAmt)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                      background: "rgba(34,197,94,0.1)", color: "#16A34A" }}>
                      {r.status}
                    </span>
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
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn:    React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const dateInp:    React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "#1E293B", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer" };
const thStyle:    React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle:    React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:       React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
