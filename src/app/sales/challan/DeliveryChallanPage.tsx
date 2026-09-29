import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Truck, RefreshCw, Plus, Search, Download,
  ArrowUpDown, ArrowUp, ArrowDown, X, CheckCircle, XCircle,
  Loader2, Package, Link2, Calendar, StickyNote, Printer, Trash2,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// TYPES
// =============================================================

interface Challan {
  id: string;
  challanNumber: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string;
  challanDate: string;
  vehicleNo: string | null;
  status: string;
  itemCount: number;
}

interface ChallanItem {
  id: string;
  itemName: string;
  itemCode: string;
  productId: string | null;
  quantity: number;
  unit: string;
}

interface ChallanDetail extends Challan {
  notes: string | null;
  items: ChallanItem[];
}

interface ApiResponse<T> { success: boolean; data: T; }

interface NewChallanItem {
  itemName: string;
  itemCode: string;
  quantity: string;
  unit: string;
}

// =============================================================
// CONSTANTS
// =============================================================

const ORANGE = "#F97316";
const COMPANY_NAME = "Orizo Bills";
const BRANCH_NAME = "Main Branch";

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  DELIVERED: { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const STATUS_FILTERS = ["All", "PENDING", "DELIVERED", "CANCELLED"];
type SortKey = "challanDate" | "status" | null;
type SortDir = "asc" | "desc";

// =============================================================
// HELPERS
// =============================================================

function toStr(d: Date) { return d.toISOString().slice(0, 10); }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function exportCsv(challans: Challan[]) {
  const header = ["Challan No", "Order Ref", "Party", "Date", "Vehicle No", "Items", "Status"];
  const rows = challans.map(c => [
    c.challanNumber, c.orderNumber ?? "", c.customerName,
    c.challanDate, c.vehicleNo ?? "", String(c.itemCount), c.status,
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `challans-${toStr(new Date())}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =============================================================
// PRINT TEMPLATE
// =============================================================

function buildChallanPrintHtml(c: ChallanDetail): string {
  const totalQty = c.items.reduce((s, i) => s + i.quantity, 0);

  const rows = c.items.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(item.itemName)}</td>
      <td>${escapeHtml(item.itemCode || "-")}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${escapeHtml(item.unit)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Delivery Challan - ${escapeHtml(c.challanNumber)}</title>
<style>
  :root{ --ink:#1a1a1a; --muted:#6b7280; --line:#d9dde3; --accent:#e8641c; --accent-soft:#fdf1e8; }
  *{ box-sizing:border-box; }
  body{ margin:0; padding:16mm 14mm; font-family:'Segoe UI', Arial, sans-serif; color:var(--ink); }
  .head{ display:flex; justify-content:space-between; align-items:flex-start;
    border-bottom:2px solid var(--ink); padding-bottom:16px; margin-bottom:16px; }
  .brand{ display:flex; gap:12px; align-items:center; }
  .logo{ width:42px; height:42px; border-radius:10px; background:var(--accent); color:#fff;
    font-weight:800; font-size:19px; display:flex; align-items:center; justify-content:center; }
  .brand-name{ font-size:19px; font-weight:800; margin:0; }
  .brand-sub{ font-size:12px; color:var(--muted); margin:2px 0 0; }
  .doc-title{ text-align:right; }
  .doc-title h1{ margin:0; font-size:21px; letter-spacing:1px; color:var(--accent); }
  .doc-title .no{ font-size:13px; color:var(--muted); margin-top:4px; }
  .meta{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
  .meta .box{ border:1px solid var(--line); border-radius:8px; padding:12px 15px; background:#fafbfc; }
  .meta .box h3{ margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.6px;
    color:var(--muted); font-weight:700; }
  .meta .row{ display:flex; justify-content:space-between; font-size:13px; padding:3px 0; }
  .meta .row span:first-child{ color:var(--muted); }
  .meta .row span:last-child{ font-weight:600; text-align:right; }
  .vehicle-strip{ display:flex; gap:24px; flex-wrap:wrap; background:var(--accent-soft);
    border:1px solid #f3d5bb; border-radius:8px; padding:11px 15px; margin-bottom:20px; font-size:13px; }
  .vehicle-strip div span{ display:block; color:var(--muted); font-size:11px;
    text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
  .vehicle-strip div b{ font-size:14px; }
  table.items{ width:100%; border-collapse:collapse; margin-bottom:6px; }
  table.items thead th{ background:var(--ink); color:#fff; font-size:11px; text-transform:uppercase;
    letter-spacing:.4px; padding:9px 10px; text-align:left; }
  table.items thead th.num, table.items td.num{ text-align:right; }
  table.items tbody td{ padding:9px 10px; border-bottom:1px solid var(--line); font-size:13px; }
  table.items tbody tr:nth-child(even){ background:#fafbfc; }
  table.items tfoot td{ padding:9px 10px; font-size:13px; font-weight:700; border-top:2px solid var(--ink); }
  .notes{ margin:16px 0 28px; font-size:12px; color:var(--muted); border-left:3px solid var(--accent);
    padding:8px 12px; background:#fafbfc; }
  .sign-row{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:36px; }
  .sign-box{ text-align:center; font-size:12px; color:var(--muted); }
  .sign-line{ border-top:1px solid var(--ink); margin-bottom:8px; height:44px; }
  .foot-note{ text-align:center; font-size:11px; color:var(--muted); margin-top:24px;
    border-top:1px dashed var(--line); padding-top:10px; }
  @media print{ @page{ size:A4; margin:8mm; } }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">
      <div class="logo">${escapeHtml(COMPANY_NAME.charAt(0))}</div>
      <div>
        <p class="brand-name">${escapeHtml(COMPANY_NAME)}</p>
        <p class="brand-sub">${escapeHtml(BRANCH_NAME)}</p>
      </div>
    </div>
    <div class="doc-title">
      <h1>DELIVERY CHALLAN</h1>
      <div class="no">No: ${escapeHtml(c.challanNumber)}</div>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <h3>Deliver To</h3>
      <div class="row"><span>Party</span><span>${escapeHtml(c.customerName)}</span></div>
      ${c.orderNumber ? `<div class="row"><span>Order Ref</span><span>${escapeHtml(c.orderNumber)}</span></div>` : ""}
    </div>
    <div class="box">
      <h3>Challan Details</h3>
      <div class="row"><span>Date</span><span>${escapeHtml(fmtDate(c.challanDate))}</span></div>
      <div class="row"><span>Status</span><span>${escapeHtml(c.status)}</span></div>
    </div>
  </div>

  ${c.vehicleNo ? `
  <div class="vehicle-strip">
    <div><span>Vehicle No.</span><b>${escapeHtml(c.vehicleNo)}</b></div>
  </div>` : ""}

  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th>Code</th><th class="num">Qty</th><th class="num">Unit</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3">Total</td><td class="num">${totalQty}</td><td class="num">Units</td></tr>
    </tfoot>
  </table>

  ${c.notes ? `<div class="notes">Note: ${escapeHtml(c.notes)}</div>` : ""}

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line"></div>Prepared By</div>
    <div class="sign-box"><div class="sign-line"></div>Driver Signature</div>
    <div class="sign-box"><div class="sign-line"></div>Receiver Signature &amp; Seal</div>
  </div>

  <div class="foot-note">${escapeHtml(COMPANY_NAME)} · This is a system-generated delivery challan</div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}

function printChallan(c: ChallanDetail) {
  const html = buildChallanPrintHtml(c);
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

// =============================================================
// CREATE CHALLAN MODAL
// =============================================================

function emptyItem(): NewChallanItem {
  return { itemName: "", itemCode: "", quantity: "", unit: "Nos" };
}

function CreateChallanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState("");
  const [challanDate,  setChallanDate]  = useState(toStr(new Date()));
  const [vehicleNo,    setVehicleNo]    = useState("");
  const [notes,        setNotes]        = useState("");
  const [items,        setItems]        = useState<NewChallanItem[]>([emptyItem()]);
  const [error,        setError]        = useState<string | null>(null);

  const updateItem = (idx: number, patch: Partial<NewChallanItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem    = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const createMut = useMutation({
    mutationFn: async () => {
      const cleanItems = items
        .filter(it => it.itemName.trim() && Number(it.quantity) > 0)
        .map(it => ({
          itemName: it.itemName.trim(),
          itemCode: it.itemCode.trim(),
          quantity: Number(it.quantity),
          unit: it.unit.trim() || "Nos",
        }));
      if (cleanItems.length === 0) throw new Error("Add at least one item with a valid quantity");

      const payload = {
        customerName: customerName.trim() || "Walk-in Customer",
        challanDate,
        vehicleNo: vehicleNo.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cleanItems,
      };
      const res = await http.post<ApiResponse<ChallanDetail>>("/sales/challans", payload);
      if (!res.success) throw new Error("Failed to create challan");
      return res.data;
    },
    onSuccess: () => onCreated(),
    onError: (err: any) => setError(err?.message ?? "Something went wrong"),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, maxHeight: "88vh", background: "#fff", borderRadius: 14,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>New Delivery Challan</div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E2E8F0",
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} color="#64748B" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#DC2626",
              display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Basic fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Party / Customer Name">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer" style={inputStyle} />
            </Field>
            <Field label="Challan Date">
              <input type="date" value={challanDate} onChange={e => setChallanDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Vehicle No.">
              <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)}
                placeholder="TN 38 BZ 4521" style={inputStyle} />
            </Field>
            <Field label="Notes">
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional" style={inputStyle} />
            </Field>
          </div>

          {/* Items */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", marginBottom: 8 }}>
            ITEMS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.9fr auto",
                gap: 8, alignItems: "center" }}>
                <input value={item.itemName} onChange={e => updateItem(idx, { itemName: e.target.value })}
                  placeholder="Item name" style={inputStyle} />
                <input value={item.itemCode} onChange={e => updateItem(idx, { itemCode: e.target.value })}
                  placeholder="Code" style={inputStyle} />
                <input type="number" min="0" value={item.quantity}
                  onChange={e => updateItem(idx, { quantity: e.target.value })}
                  placeholder="Qty" style={inputStyle} />
                <input value={item.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                  placeholder="Unit" style={inputStyle} />
                <button onClick={() => removeItem(idx)} disabled={items.length === 1}
                  style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #E2E8F0",
                    background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: items.length === 1 ? "not-allowed" : "pointer" }}>
                  <Trash2 size={13} color={items.length === 1 ? "#CBD5E1" : "#EF4444"} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addItem}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "1px dashed #CBD5E1", borderRadius: 8, padding: "7px 12px",
              fontSize: 12, fontWeight: 600, color: ORANGE, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={13} /> Add Item
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #F1F5F9",
          display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
              background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={() => { setError(null); createMut.mutate(); }} disabled={createMut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8,
              border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: createMut.isPending ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: createMut.isPending ? 0.7 : 1 }}>
            {createMut.isPending
              ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
              : <CheckCircle size={14} />}
            Create Challan
          </button>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
  padding: "8px 10px", fontSize: 13, color: "#1E293B",
  background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
};

// =============================================================
// DETAIL PANEL
// =============================================================

function DetailPanel({ challanId, onClose, onAction }: {
  challanId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["challan-detail", challanId],
    queryFn: async () => {
      const res = await http.get<ApiResponse<ChallanDetail>>(`/sales/challans/${challanId}`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 10_000,
  });

  const doStatus = async (status: "DELIVERED" | "CANCELLED") => {
    setBusy(status);
    try {
      await http.patch(`/sales/challans/${challanId}/status`, { status });
      await qc.invalidateQueries({ queryKey: ["challans"] });
      await qc.invalidateQueries({ queryKey: ["challan-detail", challanId] });
      await qc.invalidateQueries({ queryKey: ["sale-orders"] });
      onAction();
    } finally { setBusy(null); }
  };

  const deleteMut = useMutation({
    mutationFn: () => http.delete(`/sales/challans/${challanId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challans"] });
      onClose();
    },
  });

  const c = data;
  const sc = c ? STATUS_COLOR[c.status] ?? STATUS_COLOR.PENDING : null;

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        width: 360, flexShrink: 0, background: "#fff",
        borderLeft: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "13px 16px", borderBottom: "1px solid #F1F5F9",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          {isLoading ? "Loading…" : c?.challanNumber ?? "Challan"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => c && printChallan(c)}
            disabled={!c}
            title="Print Challan"
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0",
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: c ? "pointer" : "not-allowed" }}>
            <Printer size={13} color={c ? "#475569" : "#CBD5E1"} />
          </button>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0",
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={13} color="#64748B" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={22} color={ORANGE} style={{ animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : c ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

          {/* Status badge */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 11px",
              background: sc!.bg, color: sc!.color }}>{c.status}</span>
            {c.orderNumber && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                fontWeight: 600, color: "#1D4ED8", background: "rgba(59,130,246,0.08)",
                borderRadius: 20, padding: "3px 11px" }}>
                <Link2 size={10} /> {c.orderNumber}
              </span>
            )}
          </div>

          {/* Customer + meta */}
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{c.customerName}</div>
            <MetaRow icon={<Calendar size={11} />} label="Date"       value={fmtDate(c.challanDate)} />
            {c.vehicleNo && <MetaRow icon={<Truck size={11} />} label="Vehicle" value={c.vehicleNo} />}
            {c.notes     && <MetaRow icon={<StickyNote size={11} />} label="Notes" value={c.notes} />}
            {c.orderNumber && (
              <MetaRow icon={<Link2 size={11} />} label="Linked Order" value={
                <span style={{ fontWeight: 700, color: "#1D4ED8" }}>{c.orderNumber}</span>
              } />
            )}
          </div>

          {/* Items */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", marginBottom: 8 }}>
            ITEMS ({c.items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {c.items.map(item => (
              <div key={item.id} style={{ background: "#F8FAFC", borderRadius: 8, padding: "9px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.itemName}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {item.itemCode && <span>{item.itemCode} · </span>}
                    {item.unit}
                  </div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                    {item.quantity}
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>qty</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary strip */}
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 8, padding: "9px 13px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Total Items</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>
              {c.items.reduce((s, i) => s + i.quantity, 0)} units
            </span>
          </div>

          {/* Print button (always available) */}
          <button onClick={() => printChallan(c)}
            style={{ ...actionBtn("#475569", "#F1F5F9"), marginBottom: 10 }}>
            <Printer size={13} /> Print Challan
          </button>

          {/* Actions */}
          {c.status === "PENDING" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", marginBottom: 2 }}>ACTIONS</div>

              <button onClick={() => doStatus("DELIVERED")} disabled={busy === "DELIVERED"}
                style={actionBtn("#16A34A", "rgba(34,197,94,0.1)")}>
                {busy === "DELIVERED"
                  ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
                  : <CheckCircle size={13} />}
                Mark as Delivered
              </button>

              <button onClick={() => doStatus("CANCELLED")} disabled={busy === "CANCELLED"}
                style={actionBtn("#EF4444", "rgba(239,68,68,0.08)")}>
                {busy === "CANCELLED"
                  ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
                  : <XCircle size={13} />}
                Cancel Challan
              </button>
            </div>
          )}

          {/* Delete */}
          {c.status === "CANCELLED" && (
            <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
              style={{ ...actionBtn("#EF4444", "rgba(239,68,68,0.06)"), marginTop: 8 }}>
              {deleteMut.isPending ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <XCircle size={13} />}
              Delete Challan
            </button>
          )}
        </div>
      ) : null}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}>
      <span style={{ color: "#94A3B8", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#94A3B8", minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function actionBtn(color: string, bg: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 7, padding: "9px 13px",
    borderRadius: 8, border: `1.5px solid ${color}22`, background: bg,
    color, fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", width: "100%",
  };
}

// =============================================================
// SUMMARY CARD
// =============================================================
function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================

export default function DeliveryChallanPage() {
  const qc = useQueryClient();
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [statusF,  setStatusF]  = useState("All");
  const [sortKey,  setSortKey]  = useState<SortKey>(null);
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["challans", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: Challan[]; total: number }>>(
        `/sales/challans?page=${page}&pageSize=20`
      );
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: prev => prev,
  });

  const allChallans = data?.data ?? [];

  const filtered = allChallans.filter(c => {
    const matchSearch = !search ||
      c.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (c.orderNumber ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusF === "All" || c.status === statusF;
    return matchSearch && matchStatus;
  });

  const challans = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "challanDate") cmp = new Date(a.challanDate).getTime() - new Date(b.challanDate).getTime();
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // Summary counts
  const countPending   = allChallans.filter(c => c.status === "PENDING").length;
  const countDelivered = allChallans.filter(c => c.status === "DELIVERED").length;
  const countLinked    = allChallans.filter(c => c.orderId !== null).length;
  const totalUnits     = allChallans.reduce((s, c) => s + c.itemCount, 0);

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

      {/* ── MAIN COLUMN ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "20px 20px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Delivery Challans</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
              {total} challan{total !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => challans.length && exportCsv(challans)} style={iconBtn} title="Export CSV" disabled={!challans.length}>
              <Download size={15} color={challans.length ? "#64748B" : "#CBD5E1"} />
            </button>
            <button onClick={() => void refetch()} style={iconBtn} title="Refresh">
              <RefreshCw size={15} color="#64748B"
                style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
            </button>
            <button style={primaryBtn} onClick={() => setShowCreate(true)}><Plus size={15} /> New Challan</button>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <StatCard label="PENDING"   value={countPending}   color="#A16207" sub="Awaiting dispatch" />
          <StatCard label="DELIVERED" value={countDelivered} color="#16A34A" sub="Successfully delivered" />
          <StatCard label="FROM ORDERS" value={countLinked}  color="#1D4ED8" sub="Linked to sale orders" />
          <StatCard label="TOTAL UNITS" value={totalUnits}   color={ORANGE}  sub="Across all challans" />
        </div>

        {/* Toolbar */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
          padding: "10px 12px", marginBottom: 12, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 140 }}>
            <Search size={12} style={{ position: "absolute", left: 9, top: "50%",
              transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Challan, customer, order…"
              style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7,
                padding: "6px 10px 6px 26px", fontSize: 12, color: "#475569",
                background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
              onFocus={e => { e.currentTarget.style.borderColor = ORANGE; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
          </div>
          <div style={{ width: 1, height: 22, background: "#E2E8F0", flexShrink: 0 }} />
          {/* Status chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>STATUS</span>
            {STATUS_FILTERS.map(s => {
              const active = statusF === s; const sc = STATUS_COLOR[s];
              return (
                <button key={s} onClick={() => setStatusF(s)}
                  style={{ padding: "4px 11px", borderRadius: 6, fontSize: 11, fontWeight: active ? 700 : 500,
                    border: active ? "none" : "1px solid #E2E8F0",
                    background: active ? (sc?.bg ?? "rgba(249,115,22,0.1)") : "#fff",
                    color: active ? (sc?.color ?? ORANGE) : "#64748B",
                    cursor: "pointer", fontFamily: "inherit" }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary strip */}
        {challans.length > 0 && (
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 8, padding: "8px 16px", marginBottom: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              {challans.length} challan{challans.length !== 1 ? "s" : ""} shown
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>
              {challans.reduce((s, c) => s + c.itemCount, 0)} total items
            </span>
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0 }}>
                  <th style={thStyle}>Challan No</th>
                  <th style={thStyle}>Party</th>
                  <th style={thStyle}>Order Ref</th>
                  <th style={thStyle}>
                    <button style={sortHdrBtn} onClick={() => handleSort("challanDate")}>
                      Date <SortIcon col="challanDate" />
                    </button>
                  </th>
                  <th style={thStyle}>Vehicle</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Items</th>
                  <th style={thStyle}>
                    <button style={sortHdrBtn} onClick={() => handleSort("status")}>
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 13, borderRadius: 4, background: "#F1F5F9",
                          animation: "pulse 1.4s ease-in-out infinite",
                          width: j === 1 ? "65%" : "55%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {isError && (
                  <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <AlertTriangle size={16} /> Backend not connected
                    </div>
                  </td></tr>
                )}
                {!isLoading && !isError && challans.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "60px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <Truck size={32} color="#CBD5E1" strokeWidth={1.2} />
                      <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                        {search ? `No challans matching "${search}"` : "No delivery challans yet"}
                      </div>
                      {statusF !== "All" && (
                        <button onClick={() => setStatusF("All")}
                          style={{ fontSize: 12, color: ORANGE, background: "none", border: "none",
                            cursor: "pointer", textDecoration: "underline" }}>
                          Clear filter
                        </button>
                      )}
                    </div>
                  </td></tr>
                )}
                <AnimatePresence initial={false}>
                  {challans.map((c, idx) => {
                    const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.PENDING;
                    const isSelected = selected === c.id;
                    return (
                      <motion.tr key={c.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelected(s => s === c.id ? null : c.id)}
                        style={{ borderBottom: idx < challans.length - 1 ? "1px solid #F1F5F9" : "none",
                          cursor: "pointer", background: isSelected ? "#FFF7ED" : undefined }}>
                        <td style={tdStyle}><code style={chip}>{c.challanNumber}</code></td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{c.customerName}</td>
                        <td style={tdStyle}>
                          {c.orderNumber ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                              fontWeight: 600, color: "#1D4ED8" }}>
                              <Link2 size={10} /> {c.orderNumber}
                            </span>
                          ) : (
                            <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>
                          {fmtDate(c.challanDate)}
                        </td>
                        <td style={{ ...tdStyle, color: "#94A3B8" }}>{c.vehicleNo ?? "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 12, color: "#475569", fontWeight: 500 }}>
                            <Package size={11} color="#94A3B8" /> {c.itemCount}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20,
                            padding: "3px 10px", background: sc.bg, color: sc.color }}>
                            {c.status}
                          </span>
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
              <span style={{ fontSize: 12, color: "#64748B" }}>
                Page <strong>{page}</strong> of {totalPages} · {total} total
              </span>
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
            challanId={selected}
            onClose={() => setSelected(null)}
            onAction={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* ── CREATE MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <CreateChallanModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              qc.invalidateQueries({ queryKey: ["challans"] });
            }}
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

// ── Styles ────────────────────────────────────────────────────
const primaryBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn:       React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle:       React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.04em", whiteSpace: "nowrap", background: "#F8FAFC" };
const sortHdrBtn:    React.CSSProperties = { display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", cursor: "pointer" };
const tdStyle:       React.CSSProperties = { padding: "11px 12px", fontSize: 12 };
const chip:          React.CSSProperties = { fontSize: 11, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #F1F5F9", flexShrink: 0 };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 12, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });