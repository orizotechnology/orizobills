import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, AlertTriangle, RefreshCw, X, Loader2, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";

interface PaymentIn {
  id: string;
  paymentNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string | null;
  createdAt: string;
}

interface ApiResponse<T> { success: boolean; data: T; }

export default function PaymentInPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["payments-in", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: PaymentIn[]; total: number }>>(`/payments?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const payments = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const grandTotal = payments.reduce((s, p) => s + p.amount, 0);
  const [status, setStatus] = useState("All");

  const filters = ["All", "Received", "Pending"];
  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Payment-In</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} payment{total !== 1 ? "s" : ""} recorded</div>
        </div>
 
   


    
 

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => refetch()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setShowAdd(true)} style={primaryBtn}><Plus size={15} /> Add Payment</button>
        </div>
      </div>
     <div className="status-filter">
      <span className="status-label">Status:</span>

      {filters.map((item) => (
        <button
          key={item}
          className={`filter-btn ${status === item ? "active" : ""}`}
          onClick={() => setStatus(item)}
        >
          {item}
        </button>
      ))}
    </div>
      {/* Summary card */}
      {payments.length > 0 && (
        <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>Total received this view</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#F97316" }}>₹{grandTotal.toFixed(2)}</span>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Payment #", "Customer", "Date", "Method", "Reference", "Amount"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>}
            {isError && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#EF4444" }}><AlertTriangle size={18} /> Backend not connected</td></tr>}
            {!isLoading && !isError && payments.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "60px", textAlign: "center", color: "#94A3B8" }}>No payments recorded yet</td></tr>
            )}
            <AnimatePresence initial={false}>
              {payments.map((p, idx) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < payments.length - 1 ? "1px solid #F1F5F9" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={tdStyle}><code style={chip}>{p.paymentNumber}</code></td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{p.customerName}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{p.paymentMethod}</td>
                  <td style={{ ...tdStyle, color: "#94A3B8" }}>{p.reference ?? "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#22C55E" }}>₹{p.amount.toFixed(2)}</td>
                </motion.tr>
              ))}
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

      <AnimatePresence>
        {showAdd && <AddPaymentDialog onClose={() => setShowAdd(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["payments-in"] }); setShowAdd(false); }} />}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Quick-add payment dialog ─────────────────────────────────

function AddPaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customerName: "", amount: "", paymentMethod: "Cash", paymentDate: new Date().toISOString().slice(0, 10), reference: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.amount) { setError("Customer name and amount are required."); return; }
    setLoading(true);
    try {
      const res = await http.post<{ success: boolean }>("/payments", { ...form, amount: parseFloat(form.amount) });
      if (res.success) onSaved();
      else setError("Failed to save payment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Record Payment</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[{ label: "Customer Name", key: "customerName", placeholder: "Customer name" },
            { label: "Amount (₹)",    key: "amount",       placeholder: "0.00", type: "number" },
            { label: "Reference",     key: "reference",    placeholder: "Cheque / UTR No." }].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type={type ?? "text"} value={(form as Record<string, string>)[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} style={inputStyle}>
              {["Cash", "UPI", "Bank Transfer", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, justifyContent: "center", marginTop: 4 }}>
            {loading ? <><Loader2 size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={15} /> Save Payment</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer" });
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
