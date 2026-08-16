import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Download, FileSpreadsheet, CheckCircle2, Loader2,
  FolderOpen, AlertCircle, Package, Users, Truck,
  Receipt, ShoppingBag, CreditCard, BarChart2,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";
import FlashToast from "@/components/FlashToast";

// =============================================================
// EXPORT PAGE — single module, animated save, top-right toast
// =============================================================

type Module =
  | "Products" | "Customers" | "Suppliers" | "Expenses"
  | "Sales" | "Purchases" | "Payments";

// ── Column maps ───────────────────────────────────────────────
const HEADERS: Record<Module, string[]> = {
  Products:  ["Name","Code","HSN","MRP","Sale Price","Purchase Price","Tax %","Tax Rate","Tax Inclusive","Unit","Secondary Unit","Discount Type","Sale Discount","Location","Barcode","Description"],
  Customers: ["Name","Phone","Email","Address","GSTIN","Balance"],
  Suppliers: ["Name","Phone","Email","Address","GSTIN","Balance"],
  Expenses:  ["Expense Number","Category","Description","Amount","Payment Method","Expense Date","Reference"],
  Sales:     ["Invoice #","Customer","Invoice Date","Payment","Subtotal","Discount","CGST","SGST","Total","Paid","Balance Due","Status"],
  Purchases: ["Invoice #","Supplier","Bill Date","Payment","Subtotal","Discount","Tax Amt","Total","Status"],
  Payments:  ["Payment #","Customer","Amount","Payment Method","Payment Date","Reference"],
};

const KEYS: Record<Module, string[]> = {
  Products:  ["name","code","hsn","mrp","salePrice","purchasePrice","taxPct","taxRate","taxInclusive","unit","secondaryUnit","discountType","saleDiscount","location","barcode","description"],
  Customers: ["name","phone","email","address","gstin","balance"],
  Suppliers: ["name","phone","email","address","gstin","balance"],
  Expenses:  ["expenseNumber","category","description","amount","paymentMethod","expenseDate","reference"],
  Sales:     ["invoiceNumber","customerName","invoiceDate","paymentMethod","subtotal","discountAmt","cgst","sgst","totalAmt","paidAmt","balanceDue","status"],
  Purchases: ["invoiceNumber","supplierName","billDate","paymentMethod","subtotal","discountAmt","taxAmt","totalAmt","status"],
  Payments:  ["paymentNumber","customerName","amount","paymentMethod","paymentDate","reference"],
};

const MODULE_META: {
  value: Module; label: string; desc: string;
  icon: React.ReactNode; color: string;
}[] = [
  { value: "Products",  label: "Products",      desc: "Full catalogue with pricing & stock",  icon: <Package     size={20} />, color: "#F97316" },
  { value: "Customers", label: "Customers",      desc: "Customer directory with balances",      icon: <Users       size={20} />, color: "#06B6D4" },
  { value: "Suppliers", label: "Suppliers",      desc: "Supplier directory with balances",      icon: <Truck       size={20} />, color: "#8B5CF6" },
  { value: "Expenses",  label: "Expenses",       desc: "All recorded expenses",                 icon: <Receipt     size={20} />, color: "#EF4444" },
  { value: "Sales",     label: "Sale Invoices",  desc: "All sale invoices",                     icon: <BarChart2   size={20} />, color: "#22C55E" },
  { value: "Purchases", label: "Purchases",      desc: "All purchase invoices",                 icon: <ShoppingBag size={20} />, color: "#A855F7" },
  { value: "Payments",  label: "Payments In",    desc: "All customer payments received",        icon: <CreditCard  size={20} />, color: "#F59E0B" },
];

// ── Per-module fetch ──────────────────────────────────────────
async function fetchModule(mod: Module): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = <T,>(ep: string) => http.get<any>(ep) as Promise<T>;

  switch (mod) {
    case "Products": {
      const r = await get<{ data: { data: Record<string, unknown>[] } }>("/products?page=1&pageSize=99999&filter=all");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Customers": {
      const r = await get<{ data: Record<string, unknown>[] }>("/customers");
      return Array.isArray(r?.data) ? r.data : [];
    }
    case "Suppliers": {
      const r = await get<{ data: Record<string, unknown>[] }>("/suppliers");
      return Array.isArray(r?.data) ? r.data : [];
    }
    case "Expenses": {
      const r = await get<{ data: { data: Record<string, unknown>[] } }>("/expenses?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Sales": {
      const r = await get<{ data: { data: Record<string, unknown>[] } }>("/sales?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Purchases": {
      const r = await get<{ data: { data: Record<string, unknown>[] } }>("/purchases?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Payments": {
      const r = await get<{ data: { data: Record<string, unknown>[] } }>("/payments?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
  }
}

// ── Build worksheet ───────────────────────────────────────────
function buildSheet(rows: Record<string, unknown>[], mod: Module): XLSX.WorkSheet {
  const headers = HEADERS[mod];
  const keys    = KEYS[mod];
  const data = rows.map((r) =>
    keys.map((k) => {
      const v = r[k];
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (typeof v === "string" && (k.endsWith("Date") || k.endsWith("At"))) {
        try { return new Date(v).toLocaleDateString("en-IN"); } catch { return v; }
      }
      return v;
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  return ws;
}

// ── Open saved file via Tauri (silently fails in browser) ─────
async function openFile(path: string): Promise<void> {
  try {
    const mod = "@tauri-apps/api/opener";
    const { openPath } = await import(/* @vite-ignore */ mod) as { openPath: (p: string) => Promise<void> };
    await openPath(path);
  } catch { /* browser / API not available */ }
}

// ── Step state ────────────────────────────────────────────────
type StepStatus = "idle" | "fetching" | "writing" | "done" | "error";
interface StepState { status: StepStatus; rows: number; message: string }

// ── Main component ────────────────────────────────────────────
export default function ExportPage() {
  const [selected,  setSelected]  = useState<Module | null>(null);
  const [fmt,       setFmt]       = useState<"xlsx" | "csv">("xlsx");
  const [exporting, setExporting] = useState(false);
  const [step,      setStep]      = useState<StepState | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [error,     setError]     = useState("");
  const { getActiveBranch } = useBranchStore();
  const activeBranch = getActiveBranch();

  const handleSelect = (mod: Module) => {
    if (exporting) return;
    setSelected(mod);
    setSavedPath(null);
    setStep(null);
    setError("");
  };

  const handleExport = async () => {
    if (!selected || exporting) return;
    setExporting(true);
    setSavedPath(null);
    setShowToast(false);
    setError("");

    // ── Step 1: fetch ─────────────────────────────────────────
    setStep({ status: "fetching", rows: 0, message: "Fetching data from server…" });
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await fetchModule(selected);
    } catch (e) {
      setStep({ status: "error", rows: 0, message: e instanceof Error ? e.message : "Fetch failed" });
      setError(e instanceof Error ? e.message : "Fetch failed");
      setExporting(false);
      return;
    }

    // ── Step 2: build & write ─────────────────────────────────
    setStep({ status: "writing", rows: rows.length, message: `Building sheet with ${rows.length} rows…` });
    try {
      await new Promise((r) => setTimeout(r, 120)); // let UI paint
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, buildSheet(rows, selected), selected);
      const stamp = new Date().toISOString().slice(0, 10);
      const fname = `orizo_${selected.toLowerCase()}_${stamp}.${fmt}`;
      XLSX.writeFile(wb, fname, fmt === "csv" ? { bookType: "csv" } : undefined);
      setStep({ status: "done", rows: rows.length, message: `${rows.length} rows saved` });
      setSavedPath(fname);
      setShowToast(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Write failed";
      setStep({ status: "error", rows: 0, message: msg });
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  const meta = MODULE_META.find((m) => m.value === selected);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── Top-right toast notification ────────────────────── */}
      {showToast && savedPath && (
        <FlashToast
          type="saved"
          message={`${selected} exported — ${savedPath}`}
          duration={3500}
          onDone={() => setShowToast(false)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10,
          background: "rgba(249,115,22,0.1)", display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <Download size={20} color="#F97316" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Export Data</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Branch: <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "current"}</strong>
            {" · "}Select one module to export.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Module grid (single-select radio style) ──────── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 14 }}>
            Select Module to Export
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
            {MODULE_META.map(({ value, label, desc, icon, color }) => {
              const on = selected === value;
              return (
                <button key={value}
                  onClick={() => handleSelect(value)}
                  style={{
                    padding: "14px 14px", borderRadius: 10,
                    cursor: exporting ? "not-allowed" : "pointer",
                    textAlign: "left",
                    border: `2px solid ${on ? color : "#E2E8F0"}`,
                    background: on ? `${color}10` : "#fff",
                    transition: "all 0.14s", outline: "none",
                    opacity: exporting && !on ? 0.45 : 1,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!on && !exporting) { (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}60`; (e.currentTarget as HTMLButtonElement).style.background = `${color}06`; } }}
                  onMouseLeave={(e) => { if (!on) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; } }}
                >
                  {/* Radio dot */}
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    width: 16, height: 16, borderRadius: "50%",
                    border: `2px solid ${on ? color : "#CBD5E1"}`,
                    background: on ? color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.14s",
                  }}>
                    {on && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: on ? color : "#94A3B8", transition: "color 0.14s" }}>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: on ? 700 : 500,
                      color: on ? color : "#1E293B", transition: "color 0.14s" }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5, paddingRight: 18 }}>
                    {desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Format selector ──────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 12, padding: "16px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>Format</div>
          <div style={{ display: "flex", gap: 10 }}>
            {(["xlsx", "csv"] as const).map((f) => (
              <button key={f} onClick={() => !exporting && setFmt(f)} style={{
                padding: "7px 22px", borderRadius: 8,
                cursor: exporting ? "not-allowed" : "pointer",
                border: `1.5px solid ${fmt === f ? "#F97316" : "#E2E8F0"}`,
                background: fmt === f ? "rgba(249,115,22,0.07)" : "#fff",
                color: fmt === f ? "#F97316" : "#475569",
                fontWeight: fmt === f ? 700 : 400,
                fontSize: 13, textTransform: "uppercase", fontFamily: "inherit",
              }}>.{f}</button>
            ))}
          </div>
        </div>

        {/* ── Progress panel (shown while exporting) ───────── */}
        {(exporting || (step && step.status !== "idle")) && step && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: 12, padding: "16px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {step.status === "fetching" || step.status === "writing"
                ? <Loader2 size={15} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
                : step.status === "done"
                ? <CheckCircle2 size={15} color="#22C55E" />
                : <AlertCircle size={15} color="#EF4444" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                {step.status === "fetching" ? "Fetching data…"
                  : step.status === "writing" ? "Building file…"
                  : step.status === "done"    ? "Export complete"
                  : "Export failed"}
              </span>
              <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: "auto" }}>{step.message}</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99 }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: step.status === "error" ? "#EF4444"
                  : step.status === "done" ? "#22C55E" : "#F97316",
                width: step.status === "fetching" ? "35%"
                  : step.status === "writing" ? "70%"
                  : step.status === "done"    ? "100%" : "100%",
                transition: "width 0.4s ease, background 0.3s",
              }} />
            </div>
            {step.status === "done" && step.rows > 0 && (
              <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 600, marginTop: 8 }}>
                ✓ {step.rows.toLocaleString()} rows exported
              </div>
            )}
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────── */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
            padding: "10px 14px", fontSize: 13, color: "#EF4444",
            display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* ── Export button ─────────────────────────────────── */}
        <button onClick={handleExport}
          disabled={!selected || exporting}
          style={{
            padding: "13px 0", borderRadius: 10, border: "none",
            background: !selected ? "#CBD5E1" : exporting ? "#FED7AA" : "#F97316",
            color: !selected ? "#94A3B8" : "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: !selected || exporting ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "inherit", transition: "background 0.15s",
          }}>
          {exporting
            ? <><Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Exporting {selected}…</>
            : step?.status === "done"
            ? <><CheckCircle2 size={16} /> Export Again</>
            : <><FileSpreadsheet size={16} />
                {selected ? `Export ${meta?.label}` : "Select a module above"}
              </>
          }
        </button>

        {/* ── Success card with Open File ───────────────────── */}
        {savedPath && step?.status === "done" && (
          <div style={{
            background: "rgba(34,197,94,0.05)",
            border: "1.5px solid rgba(34,197,94,0.3)",
            borderRadius: 12, padding: "16px 20px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: "rgba(34,197,94,0.12)", display: "flex",
                alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={18} color="#22C55E" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  File saved successfully
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2,
                  fontFamily: "monospace", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {savedPath}
                </div>
              </div>
            </div>
            <button onClick={() => openFile(savedPath)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px", borderRadius: 8,
                border: "1.5px solid #22C55E",
                background: "#fff", color: "#166534",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap",
                transition: "background 0.13s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <FolderOpen size={14} /> Open File
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
