import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Receipt, Edit2, Trash2, RefreshCw, AlertTriangle, X, Loader2, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";

interface Expense {
  id: string;
  expenseNumber: string;
  category: string;
  description: string | null;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  reference: string | null;
  createdAt: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

const CATEGORIES = ["General", "Rent", "Salaries", "Utilities", "Transport", "Marketing", "Maintenance", "Office Supplies", "Other"];

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Expense | null | "new">(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["expenses", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: Expense[]; total: number }>>(`/expenses?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const expenses = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const totalAmt = expenses.reduce((s, e) => s + e.amount, 0);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    setDialog(null);
  };

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["expenses"], refetchType: "active" });
    await qc.refetchQueries({ queryKey: ["expenses"], type: "active" });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Expenses</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} expense{total !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => { void handleRefresh(); }} style={iconBtn}>
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setDialog("new")} style={primaryBtn}><Plus size={15} /> Add Expense</button>
        </div>
      </div>

      {expenses.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>Total expenses shown</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>₹{totalAmt.toFixed(2)}</span>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Expense #", "Category", "Description", "Date", "Payment", "Reference", "Amount", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>}
            {isError && <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#EF4444" }}><AlertTriangle size={18} /> Backend not connected</td></tr>}
            {!isLoading && !isError && expenses.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "64px", textAlign: "center" }}>
                <Receipt size={40} color="#E2E8F0" />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94A3B8" }}>No expenses recorded yet</div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {expenses.map((e, idx) => (
                <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < expenses.length - 1 ? "1px solid #F1F5F9" : "none" }}
                  onMouseEnter={(ev) => { (ev.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(ev) => { (ev.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={tdStyle}><code style={chip}>{e.expenseNumber}</code></td>
                  <td style={tdStyle}><span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: "rgba(249,115,22,0.08)", color: "#F97316" }}>{e.category}</span></td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{e.description ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{e.paymentMethod}</td>
                  <td style={{ ...tdStyle, color: "#94A3B8" }}>{e.reference ?? "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#EF4444" }}>₹{e.amount.toFixed(2)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setDialog(e)} style={rowIconBtn} title="Edit"
                        onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.color = "#F97316"; (ev.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
                        onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.color = "#64748B"; (ev.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(e.id)}
                        style={{ ...rowIconBtn, color: "#CBD5E1" }} title="Delete"
                        onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (ev.currentTarget as HTMLButtonElement).style.background = "#FFF1F2"; }}
                        onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; (ev.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
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
            <span style={{ fontSize: 13, color: "#64748B" }}>Page <strong>{page}</strong> of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {dialog !== null && (
          <ExpenseDialog expense={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} onSaved={onSaved} />
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ExpenseDialog({ expense, onClose, onSaved }: { expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!expense;
  const [form, setForm] = useState({
    category:      expense?.category      ?? "General",
    description:   expense?.description   ?? "",
    amount:        expense?.amount        != null ? String(expense.amount) : "",
    paymentMethod: expense?.paymentMethod ?? "Cash",
    expenseDate:   expense?.expenseDate   ? expense.expenseDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    reference:     expense?.reference     ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Enter a valid amount."); return; }
    setLoading(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount), description: form.description || undefined, reference: form.reference || undefined };
      const res = isEdit
        ? await http.put<{ success: boolean }>(`/expenses/${expense.id}`, payload)
        : await http.post<{ success: boolean }>("/expenses", payload);
      if (res.success) onSaved();
      else setError("Failed to save.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{isEdit ? "Edit Expense" : "Add Expense"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was this expense for?" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Amount (₹) *</label>
            <input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} style={inputStyle}>
              {["Cash", "UPI", "Bank Transfer", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={form.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Reference</label>
            <input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Receipt / bill no." style={inputStyle} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...primaryBtn, flex: 2, justifyContent: "center" }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> {isEdit ? "Update" : "Add Expense"}</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { flex: 1, padding: "9px 0", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const rowIconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer" });
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const };
