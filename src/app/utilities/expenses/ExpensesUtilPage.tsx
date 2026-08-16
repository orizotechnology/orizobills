import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

// =============================================================
// EXPENSES UTILITY — localStorage-based daily expense tracker
// =============================================================

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  payment: string;
  notes: string;
}

const STORAGE_KEY = "orizo_expenses";
const CATEGORIES = ["Food & Drinks","Transport","Office Supplies","Utilities","Salary","Marketing","Maintenance","Other"];
const PAYMENTS = ["Cash","UPI","Bank Transfer","Credit Card","Cheque"];

function load(): Expense[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function save(data: Expense[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);

export default function ExpensesUtilPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: today, category: "Office Supplies", amount: "", payment: "Cash", notes: "" });
  const [error, setError] = useState("");

  useEffect(() => { save(expenses); }, [expenses]);

  const todayTotal   = expenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const monthTotal   = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);

  const handleAdd = () => {
    setError("");
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Enter a valid amount."); return; }
    const entry: Expense = { id: Date.now().toString(), date: form.date, category: form.category, amount: parseFloat(form.amount), payment: form.payment, notes: form.notes };
    setExpenses(p => [entry, ...p]);
    setForm({ date: today, category: "Office Supplies", amount: "", payment: "Cash", notes: "" });
    setShowForm(false);
  };

  const handleDelete = (id: string) => setExpenses(p => p.filter(e => e.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Expenses</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowForm(p => !p)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={14} /> Add Expense
          </button>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid #E2E8F0", borderRadius: 7, cursor: "pointer" }}>
            <X size={15} color="#64748B" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Today's Total", value: `₹${todayTotal.toFixed(2)}`, color: "#F97316" },
            { label: "This Month", value: `₹${monthTotal.toFixed(2)}`, color: "#8B5CF6" },
            { label: "Total Entries", value: expenses.length, color: "#0EA5E9" },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 14 }}>New Expense</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label style={lbl}>Category</label><select style={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Amount (₹) *</label><input style={inp} type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div><label style={lbl}>Payment Mode</label><select style={inp} value={form.payment} onChange={e => setForm(p => ({ ...p, payment: e.target.value }))}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select></div>
              <div style={{ gridColumn: "2/-1" }}><label style={lbl}>Notes</label><input style={inp} placeholder="Optional notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "9px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: "9px", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save Expense</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["DATE","CATEGORY","AMOUNT","PAYMENT","NOTES",""].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.length === 0
                ? <tr><td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No expenses yet. Click "+ Add Expense" to start tracking.</td></tr>
                : expenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFC" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={td}>{e.date}</td>
                      <td style={td}><span style={{ background: "#FFF7ED", color: "#F97316", borderRadius: 5, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>{e.category}</span></td>
                      <td style={{ ...td, fontWeight: 700, color: "#1E293B" }}>₹{e.amount.toFixed(2)}</td>
                      <td style={td}>{e.payment}</td>
                      <td style={{ ...td, color: "#94A3B8" }}>{e.notes || "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 4 }}
                          onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                          onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 9px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, color: "#475569" };
