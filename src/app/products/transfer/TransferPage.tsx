import { useState } from "react";
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Building2, Package } from "lucide-react";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// TRANSFER PAGE
// 3-tab layout:
//   Tab 1: New Transfer form
//   Tab 2: Products Transferred (sent OUT)
//   Tab 3: Products Received (received IN)
// UI only — no live data fetching.
// =============================================================

type Tab = "transfer" | "sent" | "received";

// ── Mock data for UI preview ──────────────────────────────────
const MOCK_SENT = [
  { id: "1", date: "08 Aug 2026", product: "Wireless Mouse",  code: "WM-001", qty: 10,  unit: "Nos",  toBranch: "Branch - Coimbatore", notes: "Monthly restock",  status: "COMPLETED" },
  { id: "2", date: "07 Aug 2026", product: "USB Hub",         code: "UH-003", qty: 5,   unit: "Nos",  toBranch: "Branch - Coimbatore", notes: "",                 status: "COMPLETED" },
  { id: "3", date: "06 Aug 2026", product: "HDMI Cable 2m",   code: "HC-002", qty: 20,  unit: "Nos",  toBranch: "Branch - Chennai",    notes: "Urgent request",   status: "COMPLETED" },
  { id: "4", date: "05 Aug 2026", product: "Keyboard K200",   code: "KK-005", qty: 8,   unit: "Nos",  toBranch: "Branch - Chennai",    notes: "",                 status: "COMPLETED" },
];

const MOCK_RECEIVED = [
  { id: "1", date: "07 Aug 2026", product: "Monitor Stand",   code: "MS-010", qty: 4,   unit: "Nos",  fromBranch: "Branch - Mumbai",   notes: "Excess from sale", status: "COMPLETED" },
  { id: "2", date: "06 Aug 2026", product: "Laptop Sleeve",   code: "LS-007", qty: 12,  unit: "Nos",  fromBranch: "Branch - Mumbai",   notes: "",                 status: "COMPLETED" },
  { id: "3", date: "05 Aug 2026", product: "Power Bank 20K",  code: "PB-012", qty: 6,   unit: "Nos",  fromBranch: "Branch - Delhi",    notes: "New stock",        status: "COMPLETED" },
];

// Group mock data by branch
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  arr.forEach((item) => {
    const k = String(item[key]);
    (map[k] ??= []).push(item);
  });
  return map;
}

export default function TransferPage() {
  const { getActiveBranch } = useBranchStore();
  const activeBranch = getActiveBranch();

  const [tab,        setTab]        = useState<Tab>("transfer");
  const [toBranch,   setToBranch]   = useState("");
  const [product,    setProduct]    = useState("");
  const [qty,        setQty]        = useState("");
  const [notes,      setNotes]      = useState("");

  // Mock branch options
  const branches = ["Branch - Coimbatore", "Branch - Chennai", "Branch - Mumbai", "Branch - Delhi"];
  const products = [
    { label: "Wireless Mouse (WM-001) — Stock: 45 Nos",  value: "WM-001" },
    { label: "USB Hub (UH-003) — Stock: 12 Nos",          value: "UH-003" },
    { label: "HDMI Cable 2m (HC-002) — Stock: 80 Nos",   value: "HC-002" },
    { label: "Keyboard K200 (KK-005) — Stock: 30 Nos",   value: "KK-005" },
  ];

  const sentGroups     = groupBy(MOCK_SENT,     "toBranch");
  const receivedGroups = groupBy(MOCK_RECEIVED, "fromBranch");

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "transfer", label: "New Transfer",        icon: <ArrowRightLeft size={14} /> },
    { key: "sent",     label: "Products Transferred", icon: <ArrowUpRight   size={14} /> },
    { key: "received", label: "Products Received",    icon: <ArrowDownLeft  size={14} /> },
  ];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Product Transfer</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
          Inter-branch stock movement for{" "}
          <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "this branch"}</strong>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #E2E8F0",
        borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 18px", borderRadius: 7, border: "none",
              background: tab === key ? "#F97316" : "transparent",
              color:      tab === key ? "#fff"    : "#64748B",
              fontWeight: tab === key ? 700       : 500,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit", outline: "none",
              transition: "all 0.15s",
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — New Transfer
      ══════════════════════════════════════════════════════ */}
      {tab === "transfer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Form */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 18,
              display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowRightLeft size={15} color="#F97316" />
              </div>
              New Transfer
            </div>

            {/* To Branch */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>
                <Building2 size={12} style={{ display: "inline", marginRight: 4 }} />
                Transfer To Branch
              </label>
              <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={inp}>
                <option value="">Select destination branch…</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Product */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>
                <Package size={12} style={{ display: "inline", marginRight: 4 }} />
                Product
              </label>
              <select value={product} onChange={(e) => setProduct(e.target.value)} style={inp}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Quantity</label>
              <input type="number" min={1} step={1} value={qty}
                onChange={(e) => setQty(e.target.value)} placeholder="0" style={inp}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason or reference…" rows={2}
                style={{ ...inp, resize: "none" }} />
            </div>

            {/* Preview */}
            {toBranch && product && qty && (
              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px",
                marginBottom: 16, border: "1px solid #E2E8F0", fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: "#475569", marginBottom: 8, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.04em" }}>Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#FFF7ED", color: "#F97316", fontSize: 12,
                    borderRadius: 5, padding: "3px 10px", fontWeight: 600 }}>
                    {activeBranch?.name ?? "This Branch"}
                  </span>
                  <ArrowRightLeft size={14} color="#94A3B8" />
                  <span style={{ background: "#EFF6FF", color: "#1D4ED8", fontSize: 12,
                    borderRadius: 5, padding: "3px 10px", fontWeight: 600 }}>
                    {toBranch}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                  <strong>{products.find(p => p.value === product)?.label.split(" (")[0] ?? product}</strong>
                  {" · "}{qty} units
                </div>
              </div>
            )}

            <button
              style={{
                width: "100%", padding: "11px 0", border: "none", borderRadius: 8,
                background: toBranch && product && qty ? "#F97316" : "#E2E8F0",
                color: toBranch && product && qty ? "#fff" : "#94A3B8",
                fontSize: 13, fontWeight: 700,
                cursor: toBranch && product && qty ? "pointer" : "not-allowed",
                fontFamily: "inherit", outline: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              <ArrowRightLeft size={14} /> Confirm Transfer
            </button>
          </div>

          {/* Stock overview */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Current Stock</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Click a product to select it</div>
            </div>
            {[
              { name: "Wireless Mouse",  code: "WM-001", stock: 45, unit: "Nos",  color: "#16A34A" },
              { name: "USB Hub",         code: "UH-003", stock: 12, unit: "Nos",  color: "#16A34A" },
              { name: "HDMI Cable 2m",   code: "HC-002", stock: 80, unit: "Nos",  color: "#16A34A" },
              { name: "Keyboard K200",   code: "KK-005", stock: 30, unit: "Nos",  color: "#16A34A" },
              { name: "Monitor Stand",   code: "MS-010", stock: 3,  unit: "Nos",  color: "#EAB308" },
              { name: "Power Bank 20K",  code: "PB-012", stock: 0,  unit: "Nos",  color: "#EF4444" },
            ].map((p) => {
              const isSelected = product === p.code;
              return (
                <div key={p.code} onClick={() => setProduct(p.code)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 18px", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                    background: isSelected ? "rgba(249,115,22,0.05)" : "transparent",
                    borderLeft: isSelected ? "3px solid #F97316" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.code} · {p.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: p.color }}>{p.stock}</div>
                    {isSelected && <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700 }}>SELECTED</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — Products Transferred (sent)
      ══════════════════════════════════════════════════════ */}
      {tab === "sent" && (
        <div>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Transfers",   value: String(MOCK_SENT.length), color: "#F97316" },
              { label: "Branches Supplied", value: String(Object.keys(sentGroups).length), color: "#8B5CF6" },
              { label: "Total Units Sent",  value: String(MOCK_SENT.reduce((s, t) => s + t.qty, 0)), color: "#EF4444" },
            ].map((c) => (
              <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0",
                borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8",
                  textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Grouped by destination branch */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(sentGroups).map(([branchName, items]) => (
              <div key={branchName} style={{ background: "#fff", borderRadius: 12,
                border: "1px solid #E2E8F0", overflow: "hidden" }}>
                {/* Branch header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowUpRight size={15} color="#F97316" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>To: {branchName}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} transfer{items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>
                    {items.reduce((s, t) => s + t.qty, 0)} units sent
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      {["Date", "Product", "Code", "Qty", "Notes", "Status"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>{t.date}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{t.product}</td>
                        <td style={tdStyle}><code style={chip}>{t.code}</code></td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#EF4444" }}>−{t.qty}</td>
                        <td style={{ ...tdStyle, color: "#94A3B8" }}>{t.notes || "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                            background: "rgba(34,197,94,0.1)", color: "#16A34A" }}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — Products Received
      ══════════════════════════════════════════════════════ */}
      {tab === "received" && (
        <div>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Received",      value: String(MOCK_RECEIVED.length), color: "#22C55E" },
              { label: "Source Branches",      value: String(Object.keys(receivedGroups).length), color: "#8B5CF6" },
              { label: "Total Units Received", value: String(MOCK_RECEIVED.reduce((s, t) => s + t.qty, 0)), color: "#F97316" },
            ].map((c) => (
              <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0",
                borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8",
                  textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Grouped by source branch */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(receivedGroups).map(([branchName, items]) => (
              <div key={branchName} style={{ background: "#fff", borderRadius: 12,
                border: "1px solid #E2E8F0", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowDownLeft size={15} color="#16A34A" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>From: {branchName}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} transfer{items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>
                    +{items.reduce((s, t) => s + t.qty, 0)} units received
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      {["Date", "Product", "Code", "Qty", "Notes", "Status"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>{t.date}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{t.product}</td>
                        <td style={tdStyle}><code style={chip}>{t.code}</code></td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: "#22C55E" }}>+{t.qty}</td>
                        <td style={{ ...tdStyle, color: "#94A3B8" }}>{t.notes || "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                            background: "rgba(34,197,94,0.1)", color: "#16A34A" }}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const lbl:    React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp:    React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const, transition: "border-color 0.15s" };
const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };
const chip:    React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
