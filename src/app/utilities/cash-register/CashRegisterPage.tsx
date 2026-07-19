import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

// =============================================================
// CASH REGISTER — localStorage cash ledger
// =============================================================

interface CashEntry { id: string; type: "in" | "out"; amount: number; description: string; date: string; time: string; }
const STORAGE_KEY = "orizo_cash_register";
const OPENING_KEY = "orizo_cash_opening";

function load(): CashEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; } }
function save(d: CashEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

const now = new Date();

export default function CashRegisterPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CashEntry[]>(load);
  const [opening, setOpeningState] = useState(() => parseFloat(localStorage.getItem(OPENING_KEY) ?? "0"));
  const [openingInput, setOpeningInput] = useState(String(opening));
  const [editOpening, setEditOpening] = useState(opening === 0);
  const [inForm, setInForm]   = useState({ amount: "", desc: "", date: now.toISOString().slice(0,10), time: now.toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) });
  const [outForm, setOutForm] = useState({ amount: "", desc: "", date: now.toISOString().slice(0,10), time: now.toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) });

  useEffect(() => { save(entries); }, [entries]);

  const totalIn  = entries.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);
  const closing  = opening + totalIn - totalOut;

  const addEntry = (type: "in" | "out") => {
    const f = type === "in" ? inForm : outForm;
    if (!f.amount || parseFloat(f.amount) <= 0) return;
    const entry: CashEntry = { id: Date.now().toString(), type, amount: parseFloat(f.amount), description: f.desc, date: f.date, time: f.time };
    setEntries(p => [entry, ...p]);
    if (type === "in") setInForm(p => ({ ...p, amount: "", desc: "" }));
    else setOutForm(p => ({ ...p, amount: "", desc: "" }));
  };

  const saveOpening = () => { const v = parseFloat(openingInput) || 0; setOpeningState(v); localStorage.setItem(OPENING_KEY, String(v)); setEditOpening(false); };

  const CardStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Cash Register</span>
        <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid #E2E8F0", borderRadius: 7, cursor: "pointer" }}><X size={15} color="#64748B" /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          <CardStat label="Opening Balance" value={`₹${opening.toFixed(2)}`} color="#64748B" />
          <CardStat label="Total Cash In" value={`₹${totalIn.toFixed(2)}`} color="#22C55E" />
          <CardStat label="Total Cash Out" value={`₹${totalOut.toFixed(2)}`} color="#EF4444" />
          <CardStat label="Closing Balance" value={`₹${closing.toFixed(2)}`} color="#F97316" />
        </div>

        {/* Opening balance */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editOpening ? 12 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Opening Balance</span>
            {!editOpening && <button onClick={() => setEditOpening(true)} style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>}
          </div>
          {editOpening && (
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} type="number" min={0} step="0.01" value={openingInput} onChange={e => setOpeningInput(e.target.value)} placeholder="Enter opening balance" />
              <button onClick={saveOpening} style={{ padding: "7px 20px", background: "#F97316", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Set</button>
            </div>
          )}
        </div>

        {/* Two-panel entry form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
          {/* Cash In */}
          <div style={{ background: "#fff", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#16A34A", marginBottom: 12 }}>💰 Cash In</div>
            <input style={{ ...inp, marginBottom: 8 }} type="number" min={0} step="0.01" placeholder="Amount (₹)" value={inForm.amount} onChange={e => setInForm(p => ({ ...p, amount: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={inForm.desc} onChange={e => setInForm(p => ({ ...p, desc: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 12 }} type="date" value={inForm.date} onChange={e => setInForm(p => ({ ...p, date: e.target.value }))} />
            <button onClick={() => addEntry("in")} style={{ width: "100%", padding: "9px", background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Add Cash In
            </button>
          </div>
          {/* Cash Out */}
          <div style={{ background: "#fff", border: "1.5px solid #FECDD3", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", marginBottom: 12 }}>💸 Cash Out</div>
            <input style={{ ...inp, marginBottom: 8 }} type="number" min={0} step="0.01" placeholder="Amount (₹)" value={outForm.amount} onChange={e => setOutForm(p => ({ ...p, amount: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={outForm.desc} onChange={e => setOutForm(p => ({ ...p, desc: e.target.value }))} />
            <input style={{ ...inp, marginBottom: 12 }} type="date" value={outForm.date} onChange={e => setOutForm(p => ({ ...p, date: e.target.value }))} />
            <button onClick={() => addEntry("out")} style={{ width: "100%", padding: "9px", background: "#EF4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Add Cash Out
            </button>
          </div>
        </div>

        {/* Ledger table */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9" }}><span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Ledger</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["DATE","TIME","DESCRIPTION","TYPE","AMOUNT","BALANCE"].map(h => <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {entries.length === 0
                ? <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No transactions yet.</td></tr>
                : (() => {
                    let bal = opening;
                    return entries.slice().reverse().map(e => {
                      bal = e.type === "in" ? bal + e.amount : bal - e.amount;
                      return (
                        <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                          <td style={tdS}>{e.date}</td>
                          <td style={tdS}>{e.time}</td>
                          <td style={tdS}>{e.description || "—"}</td>
                          <td style={tdS}><span style={{ color: e.type === "in" ? "#22C55E" : "#EF4444", fontWeight: 600, fontSize: 12 }}>{e.type === "in" ? "Cash In" : "Cash Out"}</span></td>
                          <td style={{ ...tdS, fontWeight: 700, color: e.type === "in" ? "#22C55E" : "#EF4444" }}>{e.type === "in" ? "+" : "-"}₹{e.amount.toFixed(2)}</td>
                          <td style={{ ...tdS, fontWeight: 700, color: "#0F172A" }}>₹{bal.toFixed(2)}</td>
                        </tr>
                      );
                    });
                  })()
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
