import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Truck, RefreshCw, Plus, Search } from "lucide-react";
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
  PENDING:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  DELIVERED: { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const STATUS_FILTERS = ["All", "PENDING", "DELIVERED", "CANCELLED"];

export default function DeliveryChallanPage() {
  const qc = useQueryClient();
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All");

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

  const allChallans = data?.data ?? [];
  const challans = allChallans.filter((c) => {
    const matchSearch  = !search || c.challanNumber.toLowerCase().includes(search.toLowerCase()) || c.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus  = statusF === "All" || c.status === statusF;
    return matchSearch && matchStatus;
  });
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["challans"], refetchType: "active" });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #E2E8F0" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Delivery Challans</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {total} challan{total !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button style={primaryBtn}><Plus size={15} /> New Challan</button>
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
            placeholder="Search challan or party…"
            style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
              padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569",
              background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        </div>
        <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />
        {/* Status chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>STATUS</span>
          {STATUS_FILTERS.map((s) => {
            const active = statusF === s;
            const sc = STATUS_COLOR[s];
            return (
              <button key={s} onClick={() => setStatusF(s)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: active ? "none" : "1px solid #E2E8F0",
                  background: active ? (sc?.bg ?? "rgba(249,115,22,0.1)") : "#fff",
                  color:      active ? (sc?.color ?? "#F97316") : "#64748B",
                  cursor: "pointer", fontFamily: "inherit", outline: "none",
                }}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────── */}
      {challans.length > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          borderRadius: 10, padding: "10px 18px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {challans.length} challan{challans.length !== 1 ? "s" : ""} shown
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>
            Total Items: {challans.reduce((s, c) => s + c.itemCount, 0)}
          </span>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Challan No", "Party", "Date", "Vehicle No", "Items", "Status"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Loading challans…
                </div>
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Backend not connected
                </div>
              </td></tr>
            )}
            {!isLoading && !isError && challans.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                    {search ? `No challans matching "${search}"` : "No delivery challans yet"}
                  </div>
                </div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {challans.map((c, idx) => {
                const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.PENDING;
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < challans.length - 1 ? "1px solid #F1F5F9" : "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                    <td style={tdStyle}><code style={chip}>{c.challanNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c.customerName}</td>
                    <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(c.challanDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ ...tdStyle, color: "#94A3B8" }}>{c.vehicleNo ?? "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748B", textAlign: "center" }}>{c.itemCount}</td>
                    <td style={tdStyle}><span style={{ ...badge, background: sc.bg, color: sc.color }}>{c.status}</span></td>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn:    React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle:    React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle:    React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:       React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge:      React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
