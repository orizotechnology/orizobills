import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, AlertTriangle, ShoppingBag, Search, Plus, Download,
  ArrowUpDown, ArrowUp, ArrowDown, X, CheckCircle, Truck, FileText,
  XCircle, Phone, Tag, Calendar, StickyNote, Loader2,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// TYPES
// =============================================================

interface SaleOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  orderDate: string;
  dueDate: string | null;
  source: string;
  totalAmt: number;
  status: string;
  itemCount: number;
}

interface OrderItem {
  id: string; itemName: string; itemCode: string;
  productId: string | null;
  quantity: number; unitPrice: number; mrp: number; taxPct: number; totalAmount: number;
}

interface OrderDetail extends SaleOrder {
  notes: string | null;
  items: OrderItem[];
}

interface ApiResponse<T> { success: boolean; data: T; }

// =============================================================
// CONSTANTS
// =============================================================

const ORANGE = "#F97316";

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  CONFIRMED: { bg: "rgba(59,130,246,0.1)",   color: "#1D4ED8" },
  DELIVERED: { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const SOURCE_COLOR: Record<string, { bg: string; color: string }> = {
  "Walk-in":  { bg: "rgba(249,115,22,0.1)",  color: ORANGE    },
  "Phone":    { bg: "rgba(59,130,246,0.1)",  color: "#1D4ED8" },
  "WhatsApp": { bg: "rgba(34,197,94,0.1)",   color: "#16A34A" },
  "Online":   { bg: "rgba(139,92,246,0.1)",  color: "#7C3AED" },
  "Other":    { bg: "rgba(100,116,139,0.1)", color: "#475569" },
};

const STATUS_FILTERS = ["ALL", "PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];
type SortKey = "orderDate" | "totalAmt" | "status" | null;
type SortDir = "asc" | "desc";

// =============================================================
// HELPERS
// =============================================================

function toStr(d: Date) { return d.toISOString().slice(0, 10); }
function fmtAmt(n: number) { return `₹${Math.round(n)}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getPreset(f: string) {
  const now = new Date(); const today = toStr(now);
  if (f === "Today")      return { start: today, end: today };
  if (f === "This Week")  { const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); return { start: toStr(mon), end: today }; }
  if (f === "This Month") return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
  return { start: "", end: "" };
}

function exportCsv(orders: SaleOrder[]) {
  const header = ["Order #", "Customer", "Phone", "Source", "Order Date", "Due Date", "Items", "Total", "Status"];
  const rows = orders.map(o => [o.orderNumber, o.customerName, o.phone ?? "", o.source, o.orderDate, o.dueDate ?? "", String(o.itemCount), String(o.totalAmt), o.status]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `orders-${toStr(new Date())}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// =============================================================
// DETAIL PANEL
// =============================================================

function DetailPanel({ orderId, onClose, onAction }: {
  orderId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: async () => {
      const res = await http.get<ApiResponse<OrderDetail>>(`/sales/orders/${orderId}`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 10_000,
  });

  const doAction = async (action: string) => {
    setBusy(action);
    try {
      if (action === "confirm") {
        await http.patch(`/sales/orders/${orderId}/status`, { status: "CONFIRMED" });
      } else if (action === "challan") {
        await http.post(`/sales/orders/${orderId}/create-challan`, {});
      } else if (action === "invoice") {
        await http.post(`/sales/orders/${orderId}/convert-to-invoice`, {});
      } else if (action === "cancel") {
        await http.patch(`/sales/orders/${orderId}/status`, { status: "CANCELLED" });
      }
      await qc.invalidateQueries({ queryKey: ["sale-orders"] });
      await qc.invalidateQueries({ queryKey: ["challans"] });
      await qc.invalidateQueries({ queryKey: ["order-detail", orderId] });
      onAction();
    } finally { setBusy(null); }
  };

  const o = data;
  const sc = o ? STATUS_COLOR[o.status] ?? STATUS_COLOR.PENDING : null;
  const src = o ? SOURCE_COLOR[o.source] ?? SOURCE_COLOR["Other"] : null;

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        width: 380, flexShrink: 0, background: "#fff",
        borderLeft: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          {isLoading ? "Loading…" : o?.orderNumber ?? "Order"}
        </div>
        <button onClick={onClose}
          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0",
            background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={13} color="#64748B" />
        </button>
      </div>

      {isLoading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={22} color={ORANGE} style={{ animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : o ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>

          {/* Status + source badges */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px",
              background: sc!.bg, color: sc!.color }}>{o.status}</span>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px",
              background: src!.bg, color: src!.color }}>{o.source}</span>
          </div>

          {/* Customer info */}
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{o.customerName}</div>
            {o.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B" }}>
                <Phone size={11} /> {o.phone}
              </div>
            )}
          </div>

          {/* Meta rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <MetaRow icon={<Calendar size={12} />} label="Order Date" value={fmtDate(o.orderDate)} />
            {o.dueDate && <MetaRow icon={<Calendar size={12} />} label="Expected Delivery" value={fmtDate(o.dueDate)} />}
            <MetaRow icon={<Tag size={12} />} label="Total" value={<span style={{ fontWeight: 800, color: ORANGE }}>{fmtAmt(o.totalAmt)}</span>} />
            {o.notes && <MetaRow icon={<StickyNote size={12} />} label="Notes" value={o.notes} />}
          </div>

          {/* Items */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", marginBottom: 8 }}>
            ITEMS ({o.items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {o.items.map(item => (
              <div key={item.id} style={{ background: "#F8FAFC", borderRadius: 8, padding: "9px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{item.itemName}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {item.itemCode} · Qty: {item.quantity} · ₹{Math.round(item.unitPrice)}/unit
                    {item.taxPct > 0 && ` · GST ${item.taxPct}%`}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{fmtAmt(item.totalAmount)}</div>
              </div>
            ))}
          </div>

          {/* Total box */}
          <div style={{ background: `rgba(249,115,22,0.06)`, border: `1px solid rgba(249,115,22,0.2)`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Order Total</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{fmtAmt(o.totalAmt)}</span>
          </div>

          {/* Action buttons */}
          {o.status !== "CANCELLED" && o.status !== "DELIVERED" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", marginBottom: 2 }}>ACTIONS</div>

              {o.status === "PENDING" && (
                <ActionBtn icon={<CheckCircle size={14} />} label="Confirm Order"
                  color="#1D4ED8" bg="rgba(59,130,246,0.1)"
                  loading={busy === "confirm"} onClick={() => doAction("confirm")} />
              )}
              {(o.status === "PENDING" || o.status === "CONFIRMED") && (
                <ActionBtn icon={<Truck size={14} />} label="Create Delivery Challan"
                  color="#16A34A" bg="rgba(34,197,94,0.1)"
                  loading={busy === "challan"} onClick={() => doAction("challan")} />
              )}
              {(o.status === "PENDING" || o.status === "CONFIRMED") && (
                <ActionBtn icon={<FileText size={14} />} label="Convert to Invoice"
                  color={ORANGE} bg="rgba(249,115,22,0.1)"
                  loading={busy === "invoice"} onClick={() => doAction("invoice")} />
              )}
              <ActionBtn icon={<XCircle size={14} />} label="Cancel Order"
                color="#EF4444" bg="rgba(239,68,68,0.08)"
                loading={busy === "cancel"} onClick={() => doAction("cancel")} />
            </div>
          )}
        </div>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "#94A3B8", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#94A3B8", minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, color, bg, loading, onClick }: {
  icon: React.ReactNode; label: string; color: string; bg: string; loading: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
        borderRadius: 8, border: `1.5px solid ${color}22`, background: bg,
        color, fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer",
        fontFamily: "inherit", opacity: loading ? 0.7 : 1, transition: "opacity 0.15s" }}>
      {loading ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : icon}
      {label}
    </button>
  );
}

// =============================================================
// SUMMARY CARD
// =============================================================
function StatCard({ label, value, color, active, onClick }: { label: string; value: string | number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "#fff", border: `1.5px solid ${active ? color : "#E2E8F0"}`,
      borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left",
      boxShadow: active ? `0 0 0 3px ${color}20` : "none", transition: "all 0.15s", fontFamily: "inherit",
    }}>
      <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </button>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================

export default function SaleOrderPage() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const today    = toStr(new Date());

  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [period,    setPeriod]    = useState("All");
  const [fromDate,  setFromDate]  = useState(today);
  const [toDate,    setToDate]    = useState(today);
  const [statusF,   setStatusF]   = useState("ALL");
  const [sortKey,   setSortKey]   = useState<SortKey>(null);
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");
  const [selected,  setSelected]  = useState<string | null>(null);

  const PERIODS = ["All", "Today", "This Week", "This Month", "Custom"];

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
    placeholderData: prev => prev,
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => http.delete(`/sales/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-orders"] });
      if (selected) setSelected(null);
    },
  });

  const allOrders = data?.data ?? [];
  const filtered = allOrders.filter(o =>
    !search ||
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (o.phone ?? "").includes(search)
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

  // Summary counts from all orders
  const countPending   = allOrders.filter(o => o.status === "PENDING").length;
  const countConfirmed = allOrders.filter(o => o.status === "CONFIRMED").length;
  const countDelivered = allOrders.filter(o => o.status === "DELIVERED").length;
  const valueDelivered = allOrders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + o.totalAmt, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={11} color={ORANGE} /> : <ArrowDown size={11} color={ORANGE} />;
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#F8FAFC" }}>

      {/* ── MAIN COLUMN ────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 20px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Sale Orders</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
              {total} order{total !== 1 ? "s" : ""}
              {dateRange.start && dateRange.end ? ` · ${fmtDate(dateRange.start)} – ${fmtDate(dateRange.end)}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => orders.length && exportCsv(orders)} style={iconBtn} title="Export CSV" disabled={!orders.length}>
              <Download size={15} color={orders.length ? "#64748B" : "#CBD5E1"} />
            </button>
            <button onClick={() => void refetch()} style={iconBtn} title="Refresh">
              <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
            </button>
            <button onClick={() => navigate("/app/sales/orders/new")} style={createBtn}>
              <Plus size={15} /> New Order
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <StatCard label="PENDING"   value={countPending}         color="#A16207"  active={statusF === "PENDING"}   onClick={() => { setStatusF(s => s === "PENDING"   ? "ALL" : "PENDING");   setPage(1); }} />
          <StatCard label="CONFIRMED" value={countConfirmed}       color="#1D4ED8"  active={statusF === "CONFIRMED"} onClick={() => { setStatusF(s => s === "CONFIRMED" ? "ALL" : "CONFIRMED"); setPage(1); }} />
          <StatCard label="DELIVERED" value={countDelivered}       color="#16A34A"  active={statusF === "DELIVERED"} onClick={() => { setStatusF(s => s === "DELIVERED" ? "ALL" : "DELIVERED"); setPage(1); }} />
          <StatCard label="DELIVERED VALUE" value={fmtAmt(valueDelivered)} color={ORANGE} active={false} onClick={() => {}} />
        </div>

        {/* Toolbar */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
          padding: "10px 12px", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 180px", minWidth: 140 }}>
              <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Order #, customer, phone…"
                style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "6px 10px 6px 26px", fontSize: 12, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
                onFocus={e => { e.currentTarget.style.borderColor = ORANGE; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
            </div>
            <div style={{ width: 1, height: 22, background: "#E2E8F0", flexShrink: 0 }} />
            {/* Period */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => { setPeriod(p); setPage(1); }}
                  style={{ padding: "4px 11px", borderRadius: 6, border: period === p ? "none" : "1px solid #E2E8F0",
                    background: period === p ? ORANGE : "#fff", color: period === p ? "#fff" : "#64748B",
                    fontWeight: period === p ? 700 : 500, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {p}
                </button>
              ))}
            </div>
            {period === "Custom" && (
              <>
                <div style={{ width: 1, height: 22, background: "#E2E8F0", flexShrink: 0 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#64748B" }}>From</span>
                  <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={dateInp} />
                  <span style={{ fontSize: 11, color: "#64748B" }}>To</span>
                  <input type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} style={dateInp} />
                </div>
              </>
            )}
          </div>
          {/* Status row */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", alignSelf: "center" }}>STATUS</span>
            {STATUS_FILTERS.map(s => {
              const active = statusF === s; const sc = STATUS_COLOR[s];
              return (
                <button key={s} onClick={() => { setStatusF(s); setPage(1); }}
                  style={{ padding: "3px 10px", borderRadius: 6, border: active ? "none" : "1px solid #E2E8F0",
                    background: active ? (sc?.bg ?? "rgba(249,115,22,0.1)") : "#fff",
                    color: active ? (sc?.color ?? "#0F172A") : "#64748B",
                    fontWeight: active ? 700 : 500, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {s === "ALL" ? "All" : s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary strip */}
        {orders.length > 0 && (
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 8, padding: "8px 16px", marginBottom: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>{orders.length} order{orders.length !== 1 ? "s" : ""} shown</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>{fmtAmt(sumTotal)}</span>
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff",
          borderRadius: 12, border: "1px solid #E2E8F0", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0 }}>
                  <th style={thStyle}>Order #</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}><button style={sortBtn} onClick={() => handleSort("orderDate")}>Date <SortIcon col="orderDate" /></button></th>
                  <th style={thStyle}>Due</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Items</th>
                  <th style={{ ...thStyle, textAlign: "right" }}><button style={{ ...sortBtn, marginLeft: "auto" }} onClick={() => handleSort("totalAmt")}>Total <SortIcon col="totalAmt" /></button></th>
                  <th style={thStyle}><button style={sortBtn} onClick={() => handleSort("status")}>Status <SortIcon col="status" /></button></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 13, borderRadius: 4, background: "#F1F5F9", animation: "pulse 1.4s ease-in-out infinite", width: j === 1 ? "65%" : "55%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {isError && (
                  <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <AlertTriangle size={16} /> Backend not connected
                    </div>
                  </td></tr>
                )}
                {!isLoading && !isError && orders.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "60px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <ShoppingBag size={32} color="#CBD5E1" strokeWidth={1.2} />
                      <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                        {search ? `No orders matching "${search}"` : "No orders in this period"}
                      </div>
                      <button onClick={() => navigate("/app/sales/orders/new")}
                        style={{ fontSize: 12, color: ORANGE, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        Book first order
                      </button>
                    </div>
                  </td></tr>
                )}
                <AnimatePresence initial={false}>
                  {orders.map((o, idx) => {
                    const sc  = STATUS_COLOR[o.status] ?? STATUS_COLOR.PENDING;
                    const src = SOURCE_COLOR[o.source]  ?? SOURCE_COLOR["Other"];
                    const isSelected = selected === o.id;
                    return (
                      <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelected(s => s === o.id ? null : o.id)}
                        style={{ borderBottom: idx < orders.length - 1 ? "1px solid #F1F5F9" : "none",
                          cursor: "pointer", background: isSelected ? "#FFF7ED" : undefined }}>
                        <td style={tdStyle}><code style={chip}>{o.orderNumber}</code></td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{o.customerName}</td>
                        <td style={{ ...tdStyle, color: "#64748B" }}>{o.phone ?? "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
                            background: src.bg, color: src.color }}>{o.source}</span>
                        </td>
                        <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>{fmtDate(o.orderDate)}</td>
                        <td style={{ ...tdStyle, color: o.dueDate ? "#64748B" : "#CBD5E1", whiteSpace: "nowrap" }}>
                          {o.dueDate ? fmtDate(o.dueDate) : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", color: "#64748B" }}>{o.itemCount}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtAmt(o.totalAmt)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                            background: sc.bg, color: sc.color }}>{o.status}</span>
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
              <span style={{ fontSize: 12, color: "#64748B" }}>Page <strong>{page}</strong> of {totalPages} · {total} total</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1}          onClick={() => setPage(p => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 16, flexShrink: 0 }} />
      </div>

      {/* ── DETAIL PANEL ───────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <DetailPanel
            key={selected}
            orderId={selected}
            onClose={() => setSelected(null)}
            onAction={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const iconBtn:      React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const createBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const dateInp:      React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 7, padding: "5px 9px", fontSize: 12, color: "#0F172A", background: "#fff", outline: "none", fontFamily: "inherit", cursor: "pointer" };
const thStyle:      React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em", whiteSpace: "nowrap", background: "#F8FAFC" };
const sortBtn:      React.CSSProperties = { display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", cursor: "pointer" };
const tdStyle:      React.CSSProperties = { padding: "11px 12px", fontSize: 12 };
const chip:         React.CSSProperties = { fontSize: 11, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow:React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #F1F5F9", flexShrink: 0 };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 12, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
