import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Download, FileSpreadsheet, CheckCircle2, Loader2,
  FolderOpen, AlertCircle, Package, Users, Truck,
  Receipt, ShoppingBag, CreditCard, BarChart2,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// EXPORT PAGE — per-module data fetch, save animation, open file
// =============================================================

type Module =
  | "Products" | "Customers" | "Suppliers" | "Expenses"
  | "Sales" | "Purchases" | "Payments";

interface ModuleCfg {
  value:    Module;
  label:    string;
  desc:     string;
  icon:     React.ReactNode;
  color:    string;
  headers:  string[];
  keys:     string[];
  fetch:    () => Promise<Record<string, unknown>[]>;
}

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

// ── Per-module fetch — each uses the correct endpoint + extractor ──
async function fetchModule(mod: Module): Promise<Record<string, unknown>[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = <T>(ep: string) => http.get<any>(ep) as Promise<T>;

  switch (mod) {
    case "Products": {
      // Returns { data: [...], total }
      const r = await get<{ data: { data: Record<string,unknown>[] } }>("/products?page=1&pageSize=99999&filter=all");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Customers": {
      // Returns plain array
      const r = await get<{ data: Record<string,unknown>[] }>("/customers");
      return Array.isArray(r?.data) ? r.data : [];
    }
    case "Suppliers": {
      // Returns plain array
      const r = await get<{ data: Record<string,unknown>[] }>("/suppliers");
      return Array.isArray(r?.data) ? r.data : [];
    }
    case "Expenses": {
      // Returns { data: [...], total }
      const r = await get<{ data: { data: Record<string,unknown>[] } }>("/expenses?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Sales": {
      // Returns { data: [...], total }
      const r = await get<{ data: { data: Record<string,unknown>[] } }>("/sales?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Purchases": {
      // Returns { data: [...], total }
      const r = await get<{ data: { data: Record<string,unknown>[] } }>("/purchases?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
    case "Payments": {
      // Returns { data: [...], total }
      const r = await get<{ data: { data: Record<string,unknown>[] } }>("/payments?page=1&pageSize=99999");
      return Array.isArray(r?.data?.data) ? r.data.data : [];
    }
  }
}

// ── Build one worksheet from rows ─────────────────────────────
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
  // Bold header row
  headers.forEach((_, ci) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
  });
  return ws;
}

// ── Open a saved file (Tauri or browser fallback) ─────────────
async function openFile(path: string): Promise<void> {
  try {
    const { open } = await import("@tauri-apps/plugin-opener");
    await open(path);
  } catch {
    // Not in Tauri or opener not available — nothing to do in browser
  }
}

// ── Module card metadata ──────────────────────────────────────
const MODULE_META: { value: Module; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { value: "Products",  label: "Products",      desc: "Full catalogue with pricing & stock",   icon: <Package    size={18} />, color: "#F97316" },
  { value: "Customers", label: "Customers",      desc: "Customer directory with balances",       icon: <Users      size={18} />, color: "#06B6D4" },
  { value: "Suppliers", label: "Suppliers",      desc: "Supplier directory with balances",       icon: <Truck      size={18} />, color: "#8B5CF6" },
  { value: "Expenses",  label: "Expenses",       desc: "All recorded expenses",                  icon: <Receipt    size={18} />, color: "#EF4444" },
  { value: "Sales",     label: "Sale Invoices",  desc: "All sale invoices",                      icon: <BarChart2  size={18} />, color: "#22C55E" },
  { value: "Purchases", label: "Purchases",      desc: "All purchase invoices",                  icon: <ShoppingBag size={18} />, color: "#A855F7" },
  { value: "Payments",  label: "Payments In",    desc: "All customer payments received",         icon: <CreditCard size={18} />, color: "#F59E0B" },
];

// ── Step state per module ─────────────────────────────────────
type StepStatus = "idle" | "fetching" | "writing" | "done" | "error";

interface StepState {
  status:  StepStatus;
  rows:    number;
  message: string;
}

// ── Main component ────────────────────────────────────────────
export default function ExportPage() {
  const [selected,   setSelected]   = useState<Set<Module>>(new Set());
  const [fmt,        setFmt]        = useState<"xlsx" | "csv">("xlsx");
  const [exporting,  setExporting]  = useState(false);
  const [steps,      setSteps]      = useState<Record<string, StepState>>({});
  const [savedPath,  setSavedPath]  = useState<string | null>(null);
  const [globalErr,  setGlobalErr]  = useState("");
  const { getActiveBranch } = useBranchStore();
  const activeBranch = getActiveBranch();

  const toggle = (m: Module) => {
    setSelected((p) => {
      const n = new Set(p);
      n.has(m) ? n.delete(m) : n.add(m);
      return n;
    });
    setSavedPath(null);
    setGlobalErr("");
    setSteps({});
  };

  const setStep = (mod: Module, patch: Partial<StepState>) =>
    setSteps((p) => ({ ...p, [mod]: { status: "idle", rows: 0, message: "", ...p[mod], ...patch } }));

  const allDone = Object.keys(steps).length > 0 &&
    Object.values(steps).every((s) => s.status === "done" || s.status === "error");

  const handleExport = async () => {
    if (!selected.size || exporting) return;
    setExporting(true);
    setSavedPath(null);
    setGlobalErr("");
    setSteps({});

    try {
      const mods = [...selected] as Module[];
      const wb   = XLSX.utils.book_new();

      for (const mod of mods) {
        // ── Step 1: fetching ──────────────────────────────
        setStep(mod, { status: "fetching", message: "Fetching data…" });
        let rows: Record<string, unknown>[] = [];
        try {
          rows = await fetchModule(mod);
          setStep(mod, { status: "writing", rows: rows.length, message: `Writing ${rows.length} rows…` });
        } catch (e) {
          setStep(mod, { status: "error", message: e instanceof Error ? e.message : "Fetch failed" });
          continue;
        }

        // ── Step 2: build sheet ───────────────────────────
        try {
          const ws = buildSheet(rows, mod);
          XLSX.utils.book_append_sheet(wb, ws, mod);
          setStep(mod, { status: "done", rows: rows.length, message: `${rows.length} rows exported` });
        } catch (e) {
          setStep(mod, { status: "error", message: e instanceof Error ? e.message : "Sheet build failed" });
        }
      }

      // ── Step 3: write file ────────────────────────────
      const stamp = new Date().toISOString().slice(0, 10);
      const fname = `orizo_export_${stamp}.${fmt}`;
      const isCsv = fmt === "csv" && selected.size === 1;
      XLSX.writeFile(wb, fname, isCsv ? { bookType: "csv" } : undefined);
      setSavedPath(fname);

    } catch (e) {
      setGlobalErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const hasErrors = Object.values(steps).some((s) => s.status === "error");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>

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
            {" · "}Select one or more modules, choose format, then export.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Module grid ──────────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 14 }}>
            Select Data to Export
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {MODULE_META.map(({ value, label, desc, icon, color }) => {
              const on    = selected.has(value);
              const step  = steps[value];
              return (
                <button key={value} onClick={() => !exporting && toggle(value)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: exporting ? "not-allowed" : "pointer",
                    textAlign: "left", border: `1.5px solid ${on ? color : "#E2E8F0"}`,
                    background: on ? `${color}0f` : "#fff",
                    transition: "all 0.14s", position: "relative", outline: "none",
                    opacity: exporting && !on ? 0.5 : 1,
                  }}>
                  {/* Status badge */}
                  {step && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {step.status === "fetching" || step.status === "writing"
                        ? <Loader2 size={14} color={color} style={{ animation: "spin 0.7s linear infinite" }} />
                        : step.status === "done"
                        ? <CheckCircle2 size={14} color="#22C55E" />
                        : step.status === "error"
                        ? <AlertCircle size={14} color="#EF4444" />
                        : null}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ color: on ? color : "#94A3B8" }}>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: on ? 700 : 500,
                      color: on ? color : "#1E293B" }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>{desc}</div>
                  {step?.status === "done" && (
                    <div style={{ fontSize: 11, color: "#22C55E", fontWeight: 600, marginTop: 4 }}>
                      ✓ {step.rows} rows
                    </div>
                  )}
                  {step?.status === "fetching" && (
                    <div style={{ fontSize: 11, color: color, marginTop: 4 }}>Fetching…</div>
                  )}
                  {step?.status === "writing" && (
                    <div style={{ fontSize: 11, color: color, marginTop: 4 }}>Writing {step.rows} rows…</div>
                  )}
                  {step?.status === "error" && (
                    <div style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>{step.message}</div>
                  )}
                </button>
              );
            })}
          </div>
          {selected.size > 1 && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94A3B8" }}>
              {selected.size} modules selected → exported as separate sheets in one .xlsx file.
            </p>
          )}
        </div>

        {/* ── Format selector ──────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 12, padding: "18px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>Format</div>
          <div style={{ display: "flex", gap: 10 }}>
            {(["xlsx", "csv"] as const).map((f) => (
              <button key={f} onClick={() => !exporting && setFmt(f)} style={{
                padding: "7px 22px", borderRadius: 8, cursor: exporting ? "not-allowed" : "pointer",
                border: `1.5px solid ${fmt === f ? "#F97316" : "#E2E8F0"}`,
                background: fmt === f ? "rgba(249,115,22,0.07)" : "#fff",
                color: fmt === f ? "#F97316" : "#475569",
                fontWeight: fmt === f ? 700 : 400,
                fontSize: 13, textTransform: "uppercase", fontFamily: "inherit",
              }}>.{f}</button>
            ))}
          </div>
          {fmt === "csv" && selected.size > 1 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#EAB308" }}>
              CSV only supports one sheet — select a single module or switch to .xlsx.
            </p>
          )}
        </div>

        {/* ── Progress bar strip (shown while exporting) ───── */}
        {exporting && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: 12, padding: "16px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 12 }}>
              <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite",
                display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
              Exporting…
            </div>
            {[...selected].map((mod) => {
              const step = steps[mod];
              const pct  = !step ? 0
                : step.status === "fetching" ? 33
                : step.status === "writing"  ? 66
                : step.status === "done"     ? 100
                : step.status === "error"    ? 100 : 0;
              const barColor = step?.status === "error" ? "#EF4444"
                : step?.status === "done" ? "#22C55E" : "#F97316";
              return (
                <div key={mod} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#475569" }}>{mod}</span>
                    <span style={{ color: "#94A3B8" }}>{step?.message ?? "Queued…"}</span>
                  </div>
                  <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99 }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: barColor,
                      width: `${pct}%`,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────── */}
        {globalErr && (
          <div style={{ background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
            padding: "10px 14px", fontSize: 13, color: "#EF4444",
            display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} /> {globalErr}
          </div>
        )}

        {/* ── Export button ─────────────────────────────────── */}
        <button onClick={handleExport}
          disabled={!selected.size || exporting}
          style={{
            padding: "13px 0", borderRadius: 10, border: "none",
            background: !selected.size ? "#CBD5E1" : exporting ? "#FED7AA" : "#F97316",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: !selected.size || exporting ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "inherit", transition: "background 0.15s",
          }}>
          {exporting
            ? <><Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Exporting…</>
            : allDone && !hasErrors
            ? <><CheckCircle2 size={16} /> Export Complete</>
            : <><FileSpreadsheet size={16} />
                Export {selected.size ? `${selected.size} module${selected.size > 1 ? "s" : ""}` : "— select a module"}
              </>
          }
        </button>

        {/* ── Success card with Open File ───────────────────── */}
        {savedPath && allDone && (
          <div style={{
            background: "rgba(34,197,94,0.05)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 12, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9,
                background: "rgba(34,197,94,0.12)", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle2 size={18} color="#22C55E" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  File saved successfully
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2,
                  fontFamily: "monospace" }}>{savedPath}</div>
              </div>
            </div>
            <button onClick={() => openFile(savedPath)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8,
                border: "1.5px solid #22C55E",
                background: "#fff", color: "#166534",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <FolderOpen size={14} /> Open File
            </button>
          </div>
        )}

        {/* Partial errors summary */}
        {allDone && hasErrors && (
          <div style={{ background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
            padding: "12px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>
              Some modules failed
            </div>
            {Object.entries(steps).filter(([,s]) => s.status === "error").map(([mod, s]) => (
              <div key={mod} style={{ fontSize: 12, color: "#DC2626" }}>
                <strong>{mod}:</strong> {s.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
