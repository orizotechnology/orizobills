import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, ShoppingBag, Search, Plus, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { http } from "@/lib/axios";

interface SaleOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  dueDate: string | null;
  totalAmt: number;
  status: string;
  itemCount: number;
}
interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  CONFIRMED: { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  DELIVERED: { bg: "rgba(59,130,246,0.1)",   color: "#1D4ED8" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];

type SortKey = "orderDate" | "totalAmt" | "status" | null;
type SortDir = "asc" | "desc";

function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function getPreset(f: string): { start: string; end: string } {
  const now = new Date();
  const today = toStr(now);
  if (f === "Today")      return { start: today, end: today };
  if (f === "This Week") {
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    return { start: toStr(mon), end: today };
  }
  if (f === "This Month") {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
  }
  return { start: "", end: "" };
}

function fmtAmt(n: number) { return `₹${Math.round(n)}`; }

function exportCsv(orders: SaleOrder[]) {
  const header = ["Order #", "Customer", "Order Date", "Due Date", "Items", "Total", "Status"];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.customerName,
    o.orderDate,
    o.dueDate ?? "",
    String(o.itemCount),
    o.totalAmt.toFixed(2),
    o.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sale-orders-${toStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SaleOrderPage() {
  const qc    = useQueryClient();
  const today = toStr(new Date());

  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [period,    setPeriod]    = useState("All");
  const [fromDate,  setFromDate]  = useState(today);
  const [toDate,    setToDate]    = useState(today);
  const [statusF,   setStatusF]   = useState("ALL");
  const [sortKey,   setSortKey]   = useState<SortKey>(null);
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  const PERIODS = ["All", "This Month",  "Today", ];

  const dateRange = useMemo(() => {
    if (period === "All")    return { start: "", end: "" };
    if (period === "Custom") return { start: fromDate, end: toDate };
    return getPreset(period);
  }, [period, fromDate, toDate]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sale-orders", page, dateRange.start, dateRange.end, statusF],
    queryFn: async () => {
      let url = `/sales/orders?page=${page}&pageSize=20`;
      if (dateRange.start && dateRange.end) url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      if (statusF !== "ALL") url += `&status=${statusF}`;
      const res = await http.get<ApiResponse<{ data: SaleOrder[]; total: number }>>(url);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allOrders = data?.data ?? [];
  const filtered = allOrders.filter((o) =>
    !search ||
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase())
  );

  const orders = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "orderDate") cmp = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      else if (sortKey === "totalAmt") cmp = a.totalAmt - b.totalAmt;
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const sumTotal   = orders.reduce((s, o) => s + o.totalAmt, 0);

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["sale-orders"], refetchType: "active" });
    await refetch();
  };

  const handlePeriod = (p: string) => { setPeriod(p); setPage(1); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={12} color="#F97316" /> : <ArrowDown size={12} color="#F97316" />;
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Sale Orders</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {total} order{total !== 1 ? "s" : ""}
            {dateRange.start && dateRange.end
              ? ` · ${new Date(dateRange.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${new Date(dateRange.end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
              : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => orders.length && exportCsv(orders)} style={iconBtn} title="Export CSV" disabled={!orders.length}>
            <Download size={15} color={orders.length ? "#64748B" : "#CBD5E1"} />
          </button>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button style={createBtn} title="New Sale Order">
            <Plus size={15} /> New Order
          </button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
        padding: "12px 14px", marginBottom: 14,
        display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Row 1: Search + Period filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%",
              transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search order or customer…"
              style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
                padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569",
                background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
          </div>

          <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />

          {/* Period chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>PERIOD</span>
            {PERIODS.map((p) => (
              <button key={p} onClick={() => handlePeriod(p)}
                style={{
                  padding: "5px 13px", borderRadius: 6,
                  border: period === p ? "none" : "1px solid #E2E8F0",
                  background: period === p ? "#F97316" : "#fff",
                  color:      period === p ? "#fff"    : "#64748B",
                  fontWeight: period === p ? 700       : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
                }}>
                {p}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {period === "Custom" && (
            <>
              <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>From</span>
                <input type="date" value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPage(1); }} style={dateInp} />
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>To</span>
                <input type="date" value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPage(1); }} style={dateInp} />
              </div>
            </>
          )}
        </div>

        {/* Row 2: Status filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>STATUS</span>
          {STATUS_FILTERS.map((s) => {
            const isActive = statusF === s;
            const sc = STATUS_COLOR[s];
            return (
              <button key={s} onClick={() => { setStatusF(s); setPage(1); }}
                style={{
                  padding: "4px 12px", borderRadius: 6,
                  border: isActive ? "none" : "1px solid #E2E8F0",
                  background: isActive ? (sc?.bg ?? "#F97316") : "#fff",
                  color:      isActive ? (sc?.color ?? "#0F172A") : "#64748B",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
                }}>
                {s === "ALL" ? "All" : s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────── */}
      {orders.length > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 10, padding: "10px 18px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {orders.length} order{orders.length !== 1 ? "s" : ""} shown
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#F97316" }}>
            {fmtAmt(sumTotal)}
          </span>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={thStyle}>Order #</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("orderDate")}>
                    Order Date <SortIcon col="orderDate" />
                  </button>
                </th>
                <th style={thStyle}>Due Date</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Items</th>
                <th style={{ ...thStyle, textAlign: "right" }}>
                  <button style={{ ...sortHeaderBtn, marginLeft: "auto" }} onClick={() => handleSort("totalAmt")}>
                    Total <SortIcon col="totalAmt" />
                  </button>
                </th>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("status")}>
                    Status <SortIcon col="status" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 14, borderRadius: 4, background: "#F1F5F9",
                        animation: "pulse 1.4s ease-in-out infinite",
                        width: j === 1 ? "70%" : j === 5 ? "50%" : "60%" }} />
                    </td>
                  ))}
                </tr>
              ))}
              {isError && (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <AlertTriangle size={18} /> Backend not connected
                  </div>
                </td></tr>
              )}
              {!isLoading && !isError && orders.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "64px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F1F5F9",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShoppingBag size={20} color="#94A3B8" />
                    </div>
                    <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                      {search ? `No orders matching "${search}"` : "No orders in this period"}
                    </div>
                    {(period !== "All" || statusF !== "ALL") && (
                      <button onClick={() => { setPeriod("All"); setStatusF("ALL"); setPage(1); }}
                        style={{ fontSize: 12, color: "#F97316", background: "none", border: "none",
                          cursor: "pointer", textDecoration: "underline" }}>
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              )}
              <AnimatePresence initial={false}>
                {orders.map((o, idx) => {
                  const sc = STATUS_COLOR[o.status] ?? STATUS_COLOR.PENDING;
                  return (
                    <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: idx < orders.length - 1 ? "1px solid #F1F5F9" : "none", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={tdStyle}><code style={chip}>{o.orderNumber}</code></td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{o.customerName}</td>
                      <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                        {new Date(o.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ ...tdStyle, color: "#94A3B8", whiteSpace: "nowrap" }}>
                        {o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td style={{ ...tdStyle, color: "#64748B", textAlign: "center" }}>{o.itemCount}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, textAlign: "right" }}>{fmtAmt(o.totalAmt)}</td>
                      <td style={tdStyle}>
                        <span style={{ ...badge, background: sc.bg, color: sc.color }}>{o.status}</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              Page <strong>{page}</strong> of {totalPages} · {total} total
            </span>
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

// ── Styles ────────────────────────────────────────────────────
const iconBtn:       React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const createBtn:     React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, border: "none", background: "#F97316", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const dateInp:       React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "#0F172A", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer" };
const thStyle:       React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const sortHeaderBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", cursor: "pointer" };
const tdStyle:       React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:          React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge:         React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });