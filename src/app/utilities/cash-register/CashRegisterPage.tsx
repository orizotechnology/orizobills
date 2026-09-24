import { useState, useEffect, useMemo } from "react";
import { X, Plus, Pencil, Trash2, Lock, Unlock, AlertTriangle, Download, Printer, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

// =============================================================
// CASH REGISTER — localStorage cash ledger
// =============================================================

interface CashEntry { id: string; type: "in" | "out"; amount: number; description: string; date: string; time: string; }

const STORAGE_KEY = "orizo_cash_register";
const OPENING_KEY = "orizo_cash_opening";
const CLOSED_KEY_PREFIX = "orizo_cash_closed_";
const LARGE_AMOUNT_THRESHOLD = 10000; // confirm dialog above this

function load(): CashEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; } }
function save(d: CashEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

const now = new Date();
const todayStr = now.toISOString().slice(0, 10);

export default function CashRegisterPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CashEntry[]>(load);
  const [opening, setOpeningState] = useState(() => parseFloat(localStorage.getItem(OPENING_KEY) ?? "0"));
  const [openingInput, setOpeningInput] = useState(String(opening));
  const [editOpening, setEditOpening] = useState(opening === 0);

  const [inForm, setInForm]   = useState({ amount: "", desc: "", date: todayStr, time: now.toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) });
  const [outForm, setOutForm] = useState({ amount: "", desc: "", date: todayStr, time: now.toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) });

  // --- Feature: Register closed for the day ---
  const [isClosed, setIsClosed] = useState(() => localStorage.getItem(CLOSED_KEY_PREFIX + todayStr) === "true");

  // --- Feature: Edit entry ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", desc: "", date: "", time: "" });

  // --- Feature: Date filter ---
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => { save(entries); }, [entries]);

  const totalIn  = entries.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);
  const closing  = opening + totalIn - totalOut;

  // --- Add entry (with confirmation for large amounts) ---
  const addEntry = (type: "in" | "out") => {
    if (isClosed) return;
    const f = type === "in" ? inForm : outForm;
    const amt = parseFloat(f.amount);
    if (!f.amount || amt <= 0) return;

    if (amt >= LARGE_AMOUNT_THRESHOLD) {
      const ok = window.confirm(`You're about to add a ${type === "in" ? "Cash In" : "Cash Out"} entry of ₹${amt.toLocaleString("en-IN")}. Confirm this amount is correct?`);
      if (!ok) return;
    }

    const entry: CashEntry = { id: Date.now().toString(), type, amount: amt, description: f.desc, date: f.date, time: f.time };
    setEntries(p => [entry, ...p]);
    if (type === "in") setInForm(p => ({ ...p, amount: "", desc: "" }));
    else setOutForm(p => ({ ...p, amount: "", desc: "" }));
  };

  const saveOpening = () => { const v = parseFloat(openingInput) || 0; setOpeningState(v); localStorage.setItem(OPENING_KEY, String(v)); setEditOpening(false); };

  // --- Delete entry ---
  const deleteEntry = (id: string) => {
    if (isClosed) return;
    const ok = window.confirm("Delete this transaction? This cannot be undone.");
    if (!ok) return;
    setEntries(p => p.filter(e => e.id !== id));
  };

  // --- Edit entry ---
  const startEdit = (e: CashEntry) => {
    if (isClosed) return;
    setEditingId(e.id);
    setEditForm({ amount: String(e.amount), desc: e.description, date: e.date, time: e.time });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (id: string) => {
    const amt = parseFloat(editForm.amount);
    if (!editForm.amount || amt <= 0) return;
    setEntries(p => p.map(e => e.id === id ? { ...e, amount: amt, description: editForm.desc, date: editForm.date, time: editForm.time } : e));
    setEditingId(null);
  };

  // --- Close / reopen register for the day ---
  const closeRegister = () => {
    const ok = window.confirm(`Close the register for ${todayStr}? No new entries can be added until you reopen it.`);
    if (!ok) return;
    localStorage.setItem(CLOSED_KEY_PREFIX + todayStr, "true");
    setIsClosed(true);
  };
  const reopenRegister = () => {
    localStorage.removeItem(CLOSED_KEY_PREFIX + todayStr);
    setIsClosed(false);
  };

  // --- Date-filtered + balance-calculated ledger ---
  const ledgerRows = useMemo(() => {
    const chronological = entries.slice().reverse(); // oldest first
    let bal = opening;
    const withBalance = chronological.map(e => {
      bal = e.type === "in" ? bal + e.amount : bal - e.amount;
      return { ...e, balance: bal };
    });
    const filtered = withBalance.filter(e => {
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      return true;
    });
    return filtered.reverse(); // newest first for display
  }, [entries, opening, fromDate, toDate]);

  // --- Export CSV ---
  const exportCSV = () => {
    const header = ["Date", "Time", "Description", "Type", "Amount", "Balance"];
    const rows = ledgerRows.map(e => [e.date, e.time, e.description || "-", e.type === "in" ? "Cash In" : "Cash Out", e.amount, e.balance]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cash_register_${todayStr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printLedger = () => window.print();

  const CardStat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
    <div style={{ background: "#fff", border: `1px solid ${warn ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? "#DC2626" : "#0F172A" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Cash Register</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isClosed ? (
            <button onClick={reopenRegister} style={btnGhost}><Unlock size={13} /> Reopen Register</button>
          ) : (
            <button onClick={closeRegister} style={btnGhost}><Lock size={13} /> Close Register</button>
          )}
          <button onClick={exportCSV} style={btnGhost}><Download size={13} /> Export</button>
          <button onClick={printLedger} style={btnGhost}><Printer size={13} /> Print</button>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid #E2E8F0", borderRadius: 7, cursor: "pointer" }}><X size={15} color="#64748B" /></button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

        {isClosed && (
          <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
            <Lock size={14} /> Register is closed for {todayStr}. Reopen to add or edit entries.
          </div>
        )}

        {closing < 0 && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>
            <AlertTriangle size={14} /> Warning: Closing balance is negative (₹{Math.round(closing)}). Cash out exceeds available cash.
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          <CardStat label="Opening Balance" value={`₹${Math.round(opening)}`} />
          <CardStat label="Total Cash In" value={`₹${Math.round(totalIn)}`} />
          <CardStat label="Total Cash Out" value={`₹${Math.round(totalOut)}`} />
          <CardStat label="Closing Balance" value={`₹${Math.round(closing)}`} warn={closing < 0} />
        </div>

        {/* Opening balance */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editOpening ? 12 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Opening Balance</span>
            {!editOpening && !isClosed && <button onClick={() => setEditOpening(true)} style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
          </div>
          {editOpening && (
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} type="text" inputMode="decimal" value={openingInput} onChange={e => setOpeningInput(e.target.value)} placeholder="Enter opening balance" />
              <button onClick={saveOpening} style={{ padding: "7px 20px", background: "#F97316", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Set</button>
            </div>
          )}
        </div>

        {/* Two-panel entry form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18, opacity: isClosed ? 0.5 : 1, pointerEvents: isClosed ? "none" : "auto" }}>
          {/* Cash In */}
          <div style={{ background: "#fff", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#16A34A", marginBottom: 12 }}>💰 Cash In</div>
            <input style={{ ...inp, marginBottom: 8 }} type="text" inputMode="decimal" placeholder="Amount (₹)" value={inForm.amount} onChange={e => setInForm(p => ({ ...p, amount: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={inForm.desc} onChange={e => setInForm(p => ({ ...p, desc: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 12 }} type="date" value={inForm.date} onChange={e => setInForm(p => ({ ...p, date: e.target.value }))} />
            <button onClick={() => addEntry("in")} style={{ width: "100%", padding: "9px", background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Add Cash In
            </button>
          </div>
          {/* Cash Out */}
          <div style={{ background: "#fff", border: "1.5px solid #FECDD3", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", marginBottom: 12 }}>💸 Cash Out</div>
            <input style={{ ...inp, marginBottom: 8 }} type="text" inputMode="decimal" placeholder="Amount (₹)" value={outForm.amount} onChange={e => setOutForm(p => ({ ...p, amount: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={outForm.desc} onChange={e => setOutForm(p => ({ ...p, desc: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 12 }} type="date" value={outForm.date} onChange={e => setOutForm(p => ({ ...p, date: e.target.value }))} />
            <button onClick={() => addEntry("out")} style={{ width: "100%", padding: "9px", background: "#EF4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Add Cash Out
            </button>
          </div>
        </div>

        {/* Ledger */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Ledger</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={13} color="#94A3B8" />
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...inp, width: 130, padding: "5px 8px" }} />
              <span style={{ fontSize: 12, color: "#94A3B8" }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...inp, width: 130, padding: "5px 8px" }} />
              {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }} style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["DATE","TIME","DESCRIPTION","TYPE","AMOUNT","BALANCE","ACTIONS"].map(h => <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ledgerRows.length === 0
                ? <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No transactions found.</td></tr>
                : ledgerRows.map(e => editingId === e.id ? (
                    <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFC", background: "#FFFBEB" }}>
                      <td style={tdS}><input type="date" value={editForm.date} onChange={ev => setEditForm(p => ({ ...p, date: ev.target.value }))} style={{ ...inp, padding: "4px 6px" }} /></td>
                      <td style={tdS}><input value={editForm.time} onChange={ev => setEditForm(p => ({ ...p, time: ev.target.value }))} style={{ ...inp, padding: "4px 6px", width: 70 }} /></td>
                      <td style={tdS}><input value={editForm.desc} onChange={ev => setEditForm(p => ({ ...p, desc: ev.target.value }))} style={{ ...inp, padding: "4px 6px" }} /></td>
                      <td style={tdS}><span style={{ color: e.type === "in" ? "#22C55E" : "#EF4444", fontWeight: 600, fontSize: 12 }}>{e.type === "in" ? "Cash In" : "Cash Out"}</span></td>
                      <td style={tdS}><input type="text" inputMode="decimal" value={editForm.amount} onChange={ev => setEditForm(p => ({ ...p, amount: ev.target.value }))} style={{ ...inp, padding: "4px 6px", width: 90 }} /></td>
                      <td style={{ ...tdS, fontWeight: 700, color: "#0F172A" }}>₹{Math.round(e.balance)}</td>
                      <td style={tdS}>
                        <button onClick={() => saveEdit(e.id)} style={{ ...iconBtn, color: "#16A34A" }}>Save</button>
                        <button onClick={cancelEdit} style={{ ...iconBtn, color: "#64748B" }}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                      <td style={tdS}>{e.date}</td>
                      <td style={tdS}>{e.time}</td>
                      <td style={tdS}>{e.description || "—"}</td>
                      <td style={tdS}><span style={{ color: e.type === "in" ? "#22C55E" : "#EF4444", fontWeight: 600, fontSize: 12 }}>{e.type === "in" ? "Cash In" : "Cash Out"}</span></td>
                      <td style={{ ...tdS, fontWeight: 700, color: e.type === "in" ? "#22C55E" : "#EF4444" }}>{e.type === "in" ? "+" : "-"}₹{Math.round(e.amount)}</td>
                      <td style={{ ...tdS, fontWeight: 700, color: "#0F172A" }}>₹{Math.round(e.balance)}</td>
                      <td style={tdS}>
                        <button disabled={isClosed} onClick={() => startEdit(e)} style={{ ...iconBtn, color: "#F97316", opacity: isClosed ? 0.4 : 1 }}><Pencil size={13} /></button>
                        <button disabled={isClosed} onClick={() => deleteEntry(e.id)} style={{ ...iconBtn, color: "#EF4444", opacity: isClosed ? 0.4 : 1 }}><Trash2 size={13} /></button>
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

const inp: React.CSSProperties = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 9px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" };
const tdS: React.CSSProperties = { padding: "10px 14px", fontSize: 13, color: "#475569" };
const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", padding: "4px 6px", fontSize: 12, fontWeight: 600, fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: "inherit" };