import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, AlertTriangle, RefreshCw, X, Loader2, CheckCircle2,
  Banknote, Layers, CreditCard, TrendingUp,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// PAYMENT-IN PAGE
//
// Shows all payments received — both manually added and
// auto-created from POS saves (every POS bill with paidAmt > 0
// creates a paymentIn record via the sale POST route).
//
// Features:
//   - Today / This Week / This Month / Custom date filter
//   - Stat cards: today's total + count + month total
//   - Payments grouped by day, each day shows subtotal
//   - Payment method badge (Cash / UPI / Card / Split)
//   - Add Payment dialog
// =============================================================

interface PaymentIn {
  id:            string;
  paymentNumber: string;
  customerName:  string;
  invoiceId:     string | null;
  amount:        number;
  paymentMethod: string;
  paymentDate:   string;
  reference:     string | null;
  createdAt:     string;
}

interface Stats {
  todayAmount: number;
  todayCount:  number;
  monthAmount: number;
}

interface ApiResponse<T> { success: boolean; data: T; }

// ── Date helpers ──────────────────────────────────────────────
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmt(n: number) {
  const s = n.toFixed(2);
  return `₹${s.endsWith(".00") ? s.slice(0, -3) : s}`;
}

// ── Payment method badge ──────────────────────────────────────
const METHOD_STYLE: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  Cash:          { bg: "rgba(34,197,94,0.10)",  color: "#16A34A", icon: <Banknote size={11} /> },
  UPI:           { bg: "rgba(249,115,22,0.10)", color: "#EA580C", icon: <Layers size={11} /> },
  Card:          { bg: "rgba(99,102,241,0.10)", color: "#4F46E5", icon: <CreditCard size={11} /> },
  Split:         { bg: "rgba(14,165,233,0.10)", color: "#0284C7", icon: <TrendingUp size={11} /> },
  "Bank Transfer":{ bg: "rgba(148,163,184,0.12)", color: "#475569", icon: <Banknote size={11} /> },
  Cheque:        { bg: "rgba(148,163,184,0.12)", color: "#475569", icon: <Banknote size={11} /> },
};
function MethodBadge({ method }: { method: string }) {
  const s = METHOD_STYLE[method] ?? METHOD_STYLE["Bank Transfer"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
      borderRadius: 20, padding: "2px 8px", background: s.bg, color: s.color }}>
      {s.icon} {method}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PaymentInPage() {
  const qc = useQueryClient();
  const today = toDateStr(new Date());
  const [fromDate,   setFromDate]  = useState(today);
  const [toDate,     setToDate]    = useState(today);
  const [showAdd,    setShowAdd]   = useState(false);
  const [isFetching, setIsFetch]   = useState(false);

  // ── Stats — today's summary ───────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ["payment-stats"],
    queryFn: () => http.get<ApiResponse<Stats>>("/payments/stats"),
    staleTime: 30_000,
  });
  const stats: Stats = statsData?.data ?? { todayAmount: 0, todayCount: 0, monthAmount: 0 };

  // ── Payments list — filtered by From/To ───────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments-in", fromDate, toDate],
    queryFn: async () => {
      const url = `/payments?pageSize=500&startDate=${fromDate}&endDate=${toDate}`;
      const res = await http.get<ApiResponse<{ data: PaymentIn[]; total: number }>>(url);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    enabled: !!fromDate && !!toDate,
  });

  const payments = data?.data ?? [];

  // ── Group by day ──────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, PaymentIn[]> = {};
    payments.forEach((p) => {
      const day = p.paymentDate.slice(0, 10);
      (map[day] ??= []).push(p);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [payments]);

  const handleRefresh = async () => {
    setIsFetch(true);
    await qc.invalidateQueries({ queryKey: ["payments-in"] });
    await qc.invalidateQueries({ queryKey: ["payment-stats"] });
    await refetch();
    setIsFetch(false);
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Payment Received</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            All payments from POS sales and manual entries
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setShowAdd(true)} style={primaryBtn}>
            <Plus size={15} /> Add Payment
          </button>
        </div>
      </div>

      {/* ── Stat cards — Today + This Month only ────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {[
          {
            label: "Today's Collection",
            value: fmtAmt(stats.todayAmount),
            sub:   `${stats.todayCount} transaction${stats.todayCount !== 1 ? "s" : ""}`,
            color: "#F97316",
            bg:    "rgba(249,115,22,0.07)",
            icon:  <Banknote size={20} color="#F97316" />,
          },
          {
            label: "This Month",
            value: fmtAmt(stats.monthAmount),
            sub:   "Month total",
            color: "#8B5CF6",
            bg:    "rgba(139,92,246,0.07)",
            icon:  <TrendingUp size={20} color="#8B5CF6" />,
          },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12,
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── From / To date filter ────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", border: "1px solid #E2E8F0",
        borderRadius: 10, padding: "12px 18px", marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>From</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={dateInp}
        />
        <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>To</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          style={dateInp}
        />
        {/* Quick shortcuts */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[
            { label: "Today",      from: today,                                          to: today },
            { label: "This Month", from: today.slice(0, 8) + "01",                       to: today },
          ].map(({ label, from, to }) => (
            <button key={label}
              onClick={() => { setFromDate(from); setToDate(to); }}
              style={{
                padding: "4px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                background: fromDate === from && toDate === to ? "#F97316" : "#fff",
                color:      fromDate === from && toDate === to ? "#fff"    : "#64748B",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading / Error ───────────────────────────────────── */}
      {isLoading && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 18, height: 18, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Loading payments…
        </div>
      )}

      {isError && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12, padding: "20px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
          <AlertTriangle size={18} style={{ marginBottom: 6 }} /> Backend not connected
        </div>
      )}

      {/* ── Payments grouped by day ───────────────────────────── */}
      {!isLoading && !isError && grouped.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "60px", textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "#94A3B8" }}>No payments in this period</div>
          <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>Payments from POS sales appear here automatically</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.map(([day, rows]) => {
          const dayTotal = rows.reduce((s, r) => s + r.amount, 0);
          const isToday  = day === toDateStr(new Date());

          return (
            <div key={day} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>

              {/* Day header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px",
                background: isToday ? "rgba(249,115,22,0.04)" : "#F8FAFC",
                borderBottom: "1px solid #E2E8F0",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isToday && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#F97316", color: "#fff",
                      borderRadius: 20, padding: "1px 8px", letterSpacing: "0.05em" }}>TODAY</span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                    {fmtDate(day)}
                  </span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>
                    · {rows.length} transaction{rows.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#F97316" }}>
                  {fmtAmt(dayTotal)}
                </span>
              </div>

              {/* Rows for this day */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {rows.map((p, idx) => (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ borderBottom: idx < rows.length - 1 ? "1px solid #F8FAFC" : "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      {/* Payment # */}
                      <td style={{ padding: "11px 16px", width: 110 }}>
                        <code style={{ fontSize: 11, background: "#F1F5F9", borderRadius: 4,
                          padding: "2px 7px", color: "#475569" }}>{p.paymentNumber}</code>
                      </td>
                      {/* Customer */}
                      <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 500, color: "#1E293B" }}>
                        {p.customerName}
                      </td>
                      {/* Invoice ref */}
                      <td style={{ padding: "11px 12px", fontSize: 12, color: "#94A3B8" }}>
                        {p.reference ?? (p.invoiceId ? "Invoice" : "—")}
                      </td>
                      {/* Method badge */}
                      <td style={{ padding: "11px 12px" }}>
                        <MethodBadge method={p.paymentMethod} />
                      </td>
                      {/* Amount */}
                      <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 14,
                        fontWeight: 800, color: "#22C55E" }}>
                        {fmtAmt(p.amount)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Add payment dialog */}
      <AnimatePresence>
        {showAdd && (
          <AddPaymentDialog
            onClose={() => setShowAdd(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["payments-in"] });
              qc.invalidateQueries({ queryKey: ["payment-stats"] });
              setShowAdd(false);
            }}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Add Payment Dialog ────────────────────────────────────────
function AddPaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customerName: "", amount: "", paymentMethod: "Cash",
    paymentDate: new Date().toISOString().slice(0, 10), reference: "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.amount) {
      setError("Customer name and amount are required."); return;
    }
    setLoading(true);
    try {
      const res = await http.post<{ success: boolean }>("/payments", {
        ...form, amount: parseFloat(form.amount),
      });
      if (res.success) onSaved();
      else setError("Failed to save payment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Record Payment</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {([
            { label: "Customer Name", key: "customerName", placeholder: "Customer name",        type: "text"   },
            { label: "Amount (₹)",    key: "amount",       placeholder: "0",                    type: "number" },
            { label: "Reference",     key: "reference",    placeholder: "Invoice # / UTR No.",  type: "text"   },
          ] as { label: string; key: string; placeholder: string; type: string }[]).map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <input type={type ?? "text"} value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder} style={inp} />
            </div>
          ))}
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} style={inp}>
              {["Cash", "UPI", "Card", "Bank Transfer", "Cheque"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input type="date" value={form.paymentDate}
              onChange={(e) => set("paymentDate", e.target.value)} style={inp} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px 0", border: "1.5px solid #E2E8F0", borderRadius: 8,
                background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: "9px 0", border: "none", borderRadius: 8, background: "#F97316",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", outline: "none", opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {loading
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</>
                : <><CheckCircle2 size={14} /> Save Payment</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, background: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))", border: "none", borderRadius: 8, padding: "9px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};
const dateInp: React.CSSProperties = {
  border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "7px 12px",
  fontSize: 13, color: "hsl(var(--foreground))", background: "hsl(var(--card))", outline: "none",
  fontFamily: "inherit", cursor: "pointer",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 5,
};
const inp: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", boxSizing: "border-box" as const,
};
