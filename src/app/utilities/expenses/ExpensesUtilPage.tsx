import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Search, Download, Pencil, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
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

const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  "Food & Drinks":    { bg: "#FEF2F2", color: "#DC2626" },
  "Transport":        { bg: "#EFF6FF", color: "#2563EB" },
  "Office Supplies":  { bg: "#FFF7ED", color: "#F97316" },
  "Utilities":        { bg: "#F0FDF4", color: "#16A34A" },
  "Salary":           { bg: "#FAF5FF", color: "#9333EA" },
  "Marketing":        { bg: "#FDF2F8", color: "#DB2777" },
  "Maintenance":      { bg: "#FEFCE8", color: "#A16207" },
  "Other":            { bg: "#F1F5F9", color: "#64748B" },
};

type SortKey = "date" | "amount" | null;
type SortDir = "asc" | "desc";

function load(): Expense[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function save(data: Expense[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);

function exportCsv(expenses: Expense[]) {
  const header = ["Date", "Category", "Amount", "Payment", "Notes"];
  const rows = expenses.map((e) => [e.date, e.category, e.amount.toFixed(2), e.payment, e.notes]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExpensesUtilPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: today, category: "Office Supplies", amount: "", payment: "Cash", notes: "" });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryF, setCategoryF] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => { save(expenses); }, [expenses]);

  const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const monthTotal = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch = !search ||
        e.notes.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryF === "All" || e.category === categoryF;
      return matchSearch && matchCategory;
    });
  }, [expenses, search, categoryF]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const shownTotal = sorted.reduce((s, e) => s + e.amount, 0);

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

  const openAddForm = () => {
    setEditId(null);
    setForm({ date: today, category: "Office Supplies", amount: "", payment: "Cash", notes: "" });
    setError("");
    setShowForm(true);
  };

  const openEditForm = (e: Expense) => {
    setEditId(e.id);
    setForm({ date: e.date, category: e.category, amount: String(e.amount), payment: e.payment, notes: e.notes });
    setError("");
    setShowForm(true);
  };

  const handleSave = () => {
    setError("");
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) { setError("Enter a valid amount greater than 0."); return; }
    if (!form.date) { setError("Select a date."); return; }

    if (editId) {
      setExpenses((p) => p.map((e) => e.id === editId ? { ...e, date: form.date, category: form.category, amount: amt, payment: form.payment, notes: form.notes } : e));
    } else {
      const entry: Expense = { id: Date.now().toString(), date: form.date, category: form.category, amount: amt, payment: form.payment, notes: form.notes };
      setExpenses((p) => [entry, ...p]);
    }
    setForm({ date: today, category: "Office Supplies", amount: "", payment: "Cash", notes: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setExpenses((p) => p.filter((e) => e.id !== id));
    setDeleteTarget(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Expenses</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => sorted.length && exportCsv(sorted)} disabled={!sorted.length}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: sorted.length ? "#475569" : "#CBD5E1", border: "1px solid #E2E8F0", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: sorted.length ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            <Download size={14} /> Export
          </button>
          <button onClick={openAddForm} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
            { label: "Today's Total", value: `₹${todayTotal.toFixed(2)}` },
            { label: "This Month", value: `₹${monthTotal.toFixed(2)}` },
            { label: "Total Entries", value: expenses.length },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 10, letterSpacing: "0.03em" }}>BY CATEGORY</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categoryBreakdown.map(([cat, amt]) => {
                const cc = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.Other;
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, background: cc.bg, borderRadius: 8, padding: "6px 12px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cc.color }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: cc.color }}>₹{amt.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 14 }}>{editId ? "Edit Expense" : "New Expense"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div><label style={lbl}>Category</label><select style={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Amount (₹) *</label><input style={inp} type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              <div><label style={lbl}>Payment Mode</label><select style={inp} value={form.payment} onChange={e => setForm(p => ({ ...p, payment: e.target.value }))}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select></div>
              <div style={{ gridColumn: "2/-1" }}><label style={lbl}>Notes</label><input style={inp} placeholder="Optional notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ flex: 1, padding: "9px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 2, padding: "9px", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{editId ? "Update Expense" : "Save Expense"}</button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes or category…"
              style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
          </div>
          <select value={categoryF} onChange={(e) => setCategoryF(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160 }}>
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Summary strip */}
        {sorted.length > 0 && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#64748B" }}>{sorted.length} expense{sorted.length !== 1 ? "s" : ""} shown</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#DC2626" }}>₹{shownTotal.toFixed(2)}</span>
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={thStyle}>
                <button style={sortHeaderBtn} onClick={() => handleSort("date")}>DATE <SortIcon col="date" /></button>
              </th>
              <th style={thStyle}>CATEGORY</th>
              <th style={thStyle}>
                <button style={sortHeaderBtn} onClick={() => handleSort("amount")}>AMOUNT <SortIcon col="amount" /></button>
              </th>
              <th style={thStyle}>PAYMENT</th>
              <th style={thStyle}>NOTES</th>
              <th style={thStyle}></th>
            </tr></thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    {search || categoryF !== "All" ? "No expenses matching filters." : 'No expenses yet. Click "+ Add Expense" to start tracking.'}
                  </td></tr>
                : sorted.map(e => {
                    const cc = CATEGORY_COLOR[e.category] ?? CATEGORY_COLOR.Other;
                    return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFC" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={td}>{e.date}</td>
                      <td style={td}><span style={{ background: cc.bg, color: cc.color, borderRadius: 5, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}>{e.category}</span></td>
                      <td style={{ ...td, fontWeight: 700, color: "#1E293B" }}>₹{e.amount.toFixed(2)}</td>
                      <td style={td}>{e.payment}</td>
                      <td style={{ ...td, color: "#94A3B8" }}>{e.notes || "—"}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => openEditForm(e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 4, marginRight: 2 }}
                          onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#F97316"; }}
                          onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 4 }}
                          onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
                          onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );})
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380, padding: "20px 22px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={16} color="#EF4444" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Delete Expense</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              Delete this ₹{deleteTarget.amount.toFixed(2)} expense ({deleteTarget.category}, {deleteTarget.date})? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "9px 0", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget.id)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 8, background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 };
const inp: React.CSSProperties = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 9px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, color: "#475569" };
const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8" };
const sortHeaderBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, fontSize: 11, cursor: "pointer" };