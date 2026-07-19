import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, X, Download,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// IMPORT PAGE — dedicated bulk data import
// Supports: Products, Customers, Suppliers, Expenses,
//           Sale Invoices, Purchase Invoices
// Reads multi-sheet Excel files (Item Details + Batch Details).
// =============================================================

type Module = "Products" | "Customers" | "Suppliers" | "Expenses" | "Sales" | "Purchases";
type Phase  = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

const MODULES: { value: Module; label: string; desc: string }[] = [
  { value: "Products",   label: "Products",          desc: "Items, stock levels, pricing & tax" },
  { value: "Customers",  label: "Customers",         desc: "Customer directory with balances" },
  { value: "Suppliers",  label: "Suppliers",         desc: "Vendor directory with balances" },
  { value: "Expenses",   label: "Expenses",          desc: "Expense records with categories" },
  { value: "Sales",      label: "Sale Invoices",     desc: "Bulk sales history import" },
  { value: "Purchases",  label: "Purchase Invoices", desc: "Bulk purchase history import" },
];

// ── Template column definitions ───────────────────────────────

const TEMPLATES: Record<Module, string[]> = {
  Products:  ["Item name*", "Item code", "HSN", "Default MRP", "Disc % on MRP for Sale Price", "Sale price", "Purchase price", "Discount Type", "Sale Discount", "Opening stock quantity", "Minimum stock quantity", "Item Location", "Tax Rate", "Inclusive Of Tax", "Base Unit (x)", "Secondary Unit (y)", "Conversion Rate (n) (x = ny)"],
  Customers: ["Name*", "Phone", "Email", "Address", "GSTIN", "Opening Balance"],
  Suppliers: ["Name*", "Phone", "Email", "Address", "GSTIN", "Opening Balance"],
  Expenses:  ["Category*", "Description", "Amount*", "Payment Method", "Expense Date", "Reference"],
  Sales:     ["Customer Name", "Invoice Date*", "Payment Method", "Item Name*", "Item Code", "Quantity*", "Unit Price*", "Tax %", "Discount %"],
  Purchases: ["Supplier Name", "Bill Date*", "Payment Method", "Item Name*", "Item Code", "Quantity*", "Unit Price*", "Tax %", "Discount %"],
};

// ── Alias maps — per module ──────────────────────────────────
// Each module has its own column → field mapping so there's
// no ambiguity between e.g. "Item Name" meaning `name` for
// Products vs `itemName` for Sales/Purchases.

const ALIAS_PRODUCTS: Record<string, string> = {
  "item name": "name", "item name*": "name", "product name": "name",
  "product": "name", "name*": "name", "name": "name",
  "item code": "code", "product code": "code", "sku": "code", "code": "code",
  "default mrp": "mrp", "mrp": "mrp", "maximum retail price": "mrp",
  "disc % on mrp for sale price": "discPctOnMrp", "disc % on mrp": "discPctOnMrp",
  "sale price": "salePrice", "selling price": "salePrice", "price": "salePrice",
  "purchase price": "purchasePrice", "cost": "purchasePrice", "cost price": "purchasePrice",
  "discount type": "discountType",
  "sale discount": "saleDiscount",
  "opening stock quantity": "openingStock", "opening stock": "openingStock",
  "minimum stock quantity": "lowStockAlert", "minimum stock": "lowStockAlert",
  "item location": "location", "location": "location", "store": "location",
  "tax rate": "taxRate", "tax": "taxPct", "tax%": "taxPct", "gst": "taxPct",
  "inclusive of tax": "taxInclusive", "tax inclusive": "taxInclusive",
  "base unit (x)": "unit", "base unit": "unit", "unit": "unit",
  "secondary unit (y)": "secondaryUnit", "secondary unit": "secondaryUnit",
  "conversion rate (n) (x = ny)": "conversionRate", "conversion rate": "conversionRate",
  "hsn": "hsn", "hsn code": "hsn", "description": "description",
  "barcode": "barcode",
};

const ALIAS_CUSTOMERS: Record<string, string> = {
  "name": "name", "name*": "name", "customer name": "name", "customer": "name",
  "phone": "phone", "mobile": "phone", "contact": "phone", "mobile no": "phone",
  "email": "email", "email id": "email",
  "address": "address",
  "gstin": "gstin", "gst no": "gstin", "gst number": "gstin",
  "opening balance": "balance", "balance": "balance",
};

const ALIAS_SUPPLIERS: Record<string, string> = {
  "name": "name", "name*": "name", "supplier name": "name", "vendor name": "name", "vendor": "name",
  "phone": "phone", "mobile": "phone", "contact": "phone",
  "email": "email",
  "address": "address",
  "gstin": "gstin", "gst no": "gstin",
  "opening balance": "balance", "balance": "balance",
};

const ALIAS_EXPENSES: Record<string, string> = {
  "category": "category", "category*": "category", "expense category": "category",
  "description": "description", "details": "description",
  "amount": "amount", "amount*": "amount",
  "payment method": "paymentMethod", "payment mode": "paymentMethod", "mode": "paymentMethod",
  "expense date": "expenseDate", "date": "expenseDate",
  "reference": "reference", "ref": "reference",
  "notes": "notes",
};

const ALIAS_SALES: Record<string, string> = {
  "customer name": "customerName", "customer": "customerName",
  "invoice date": "invoiceDate", "invoice date*": "invoiceDate", "date": "invoiceDate",
  "payment method": "paymentMethod", "payment mode": "paymentMethod",
  "item name": "itemName", "item name*": "itemName", "product name": "itemName", "item": "itemName",
  "item code": "itemCode", "product code": "itemCode", "sku": "itemCode", "code": "itemCode",
  "quantity": "quantity", "quantity*": "quantity", "qty": "quantity",
  "unit price": "unitPrice", "unit price*": "unitPrice", "rate": "unitPrice", "price": "unitPrice",
  "tax %": "taxPercent", "tax": "taxPercent", "gst %": "taxPercent",
  "discount %": "discountPct", "discount": "discountPct",
};

const ALIAS_PURCHASES: Record<string, string> = {
  "supplier name": "supplierName", "supplier": "supplierName", "vendor": "supplierName", "vendor name": "supplierName",
  "bill date": "billDate", "bill date*": "billDate", "date": "billDate", "invoice date": "billDate",
  "payment method": "paymentMethod", "payment mode": "paymentMethod",
  "item name": "itemName", "item name*": "itemName", "product name": "itemName", "item": "itemName",
  "item code": "itemCode", "product code": "itemCode", "sku": "itemCode", "code": "itemCode",
  "quantity": "quantity", "quantity*": "quantity", "qty": "quantity",
  "unit price": "unitPrice", "unit price*": "unitPrice", "rate": "unitPrice", "price": "unitPrice",
  "tax %": "taxPercent", "tax": "taxPercent", "gst %": "taxPercent",
  "discount %": "discountPct", "discount": "discountPct",
};

function getAliasMap(mod: Module): Record<string, string> {
  switch (mod) {
    case "Products":  return ALIAS_PRODUCTS;
    case "Customers": return ALIAS_CUSTOMERS;
    case "Suppliers": return ALIAS_SUPPLIERS;
    case "Expenses":  return ALIAS_EXPENSES;
    case "Sales":     return ALIAS_SALES;
    case "Purchases": return ALIAS_PURCHASES;
  }
}

function normalise(raw: string, mod: Module): string {
  const lower = raw.trim().toLowerCase();
  const aliasMap = getAliasMap(mod);
  if (aliasMap[lower]) return aliasMap[lower];
  // camelCase fallback for unrecognised columns
  const words = lower.replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return lower;
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

const NUMERIC = ["mrp","salePrice","purchasePrice","taxPct","discPctOnMrp","saleDiscount","openingStock","lowStockAlert","conversionRate","balance","amount","quantity","unitPrice","taxPercent","discountPct"];

function parseSheet(aoa: unknown[][], mod: Module): { rows: Record<string,unknown>[]; origHeaders: string[]; normHeaders: string[] } {
  if (aoa.length < 2) return { rows: [], origHeaders: [], normHeaders: [] };
  const origHeaders = (aoa[0] as string[]).map((h) => String(h ?? "").trim()).filter(Boolean);
  if (!origHeaders.length) return { rows: [], origHeaders: [], normHeaders: [] };
  const normHeaders = origHeaders.map((h) => normalise(h, mod));
  const rows: Record<string,unknown>[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const arr = aoa[r] as unknown[];
    if (arr.every((c) => c === "" || c == null)) continue;
    const obj: Record<string,unknown> = {};
    origHeaders.forEach((_, i) => {
      const key = normHeaders[i];
      const val = arr[i];
      if (val === "" || val == null) return;
      if (val instanceof Date) { obj[key] = val.toISOString().slice(0, 10); return; }
      const s = String(val).trim();
      if (NUMERIC.includes(key)) {
        const n = parseFloat(s.replace(/[^\d.-]/g, ""));
        obj[key] = isNaN(n) ? 0 : Math.abs(n);
      } else { obj[key] = s; }
    });
    rows.push(obj);
  }
  return { rows, origHeaders, normHeaders };
}

interface ParseResult {
  rows: Record<string,unknown>[];
  batches?: Record<string,unknown>[];
  origHeaders: string[];
  normHeaders: string[];
  total: number;
}

function parseFile(file: File, module: Module): Promise<ParseResult | { error: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array", cellDates: true });
        const ws1 = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: "" }) as unknown[][];
        if (aoa.length < 2) { resolve({ error: "File has no data rows." }); return; }
        const { rows, origHeaders, normHeaders } = parseSheet(aoa, module);
        if (!origHeaders.length) { resolve({ error: "First row has no headers." }); return; }
        if (!rows.length) { resolve({ error: "No data rows found after skipping blank lines." }); return; }

        let batches: Record<string,unknown>[] | undefined;
        if (module === "Products" && wb.SheetNames.length > 1) {
          const ws2  = wb.Sheets[wb.SheetNames[1]];
          const aoa2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: "" }) as unknown[][];
          const r2   = parseSheet(aoa2, module);
          if (r2.rows.length) batches = r2.rows;
        }
        resolve({ rows, batches, origHeaders, normHeaders, total: rows.length });
      } catch (err) { resolve({ error: `Could not read file: ${(err as Error).message}` }); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function downloadTemplate(module: Module) {
  const headers = TEMPLATES[module];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  if (module === "Products") {
    const batchSheet = XLSX.utils.aoa_to_sheet([["Item name*", "Size", "Opening stock quantity"]]);
    batchSheet["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Details");
    XLSX.utils.book_append_sheet(wb, batchSheet, "Batch Details");
    XLSX.writeFile(wb, `${module}_template.xlsx`);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, module);
    XLSX.writeFile(wb, `${module}_template.xlsx`);
  }
}

// =============================================================
// MAIN PAGE
// =============================================================

export default function ImportPage() {
  const [module, setModule]   = useState<Module>("Products");
  const [phase,  setPhase]    = useState<Phase>("idle");
  const [fileName, setFN]     = useState("");
  const [parsed, setParsed]   = useState<ParseResult | null>(null);
  const [result, setResult]   = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [errMsg, setErrMsg]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { getActiveBranch }   = useBranchStore();
  const activeBranch          = getActiveBranch();

  const reset = () => {
    setPhase("idle"); setFN(""); setParsed(null); setResult(null); setErrMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const changeModule = (m: Module) => { setModule(m); reset(); };

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv","xlsx","xls"].includes(ext)) { setErrMsg("Only .xlsx, .xls and .csv files are supported."); setPhase("error"); return; }
    setFN(file.name);
    setPhase("parsing");
    const r = await parseFile(file, module);
    if ("error" in r) { setErrMsg(r.error); setPhase("error"); return; }
    setParsed(r);
    setPhase("ready");
  };

  const onDrop  = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };

  const confirmImport = async () => {
    if (!parsed) return;
    setPhase("importing");
    try {
      const payload: Record<string, unknown> = { rows: parsed.rows };
      if (parsed.batches?.length) payload.batches = parsed.batches;

      const res = await http.post<{ success: boolean; data: { inserted: number; skipped: number; errors: string[] }; error?: { message: string } }>(
        `/import/${module.toLowerCase()}`, payload
      );
      if (res.success) { setResult(res.data); setPhase("done"); }
      else { setErrMsg(res.error?.message ?? "Import failed."); setPhase("error"); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed.";
      setErrMsg(msg.toLowerCase().includes("failed to fetch") ? "Cannot reach the server. Make sure the backend is running." : msg);
      setPhase("error");
    }
  };

  const moduleInfo = MODULES.find((m) => m.value === module)!;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileSpreadsheet size={20} color="#F97316" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Import Data</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Bulk import into <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "current branch"}</strong> — columns detected automatically
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>

        {/* Module selector */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 22px" }}>
          <label style={lbl}>Select Data Type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {MODULES.map(({ value, label, desc }) => {
              const active = module === value;
              return (
                <button key={value} onClick={() => changeModule(value)} style={{
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1.5px solid ${active ? "#F97316" : "#E2E8F0"}`,
                  background: active ? "rgba(249,115,22,0.07)" : "#fff",
                  textAlign: "left",
                }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#F97316" : "#1E293B" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{desc}</div>
                </button>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8" }}>
            Drop any Excel/CSV — column names are matched automatically. No mapping needed.
          </p>
        </div>

        {/* Drop zone */}
        {(phase === "idle" || phase === "error") && (
          <>
            <div
              onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ background: "#fff", border: `2px dashed ${phase === "error" ? "#FCA5A5" : "#CBD5E1"}`, borderRadius: 12, padding: "44px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#F97316"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = phase === "error" ? "#FCA5A5" : "#CBD5E1"; }}
            >
              <Upload size={32} color={phase === "error" ? "#EF4444" : "#94A3B8"} />
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
                  Drop your file here or <span style={{ color: "#F97316" }}>browse</span>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
                  .xlsx · .xls · .csv — columns matched from first row
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onInput} style={{ display: "none" }} />
            </div>
            {errMsg && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={15} color="#EF4444" />
                <span style={{ fontSize: 13, color: "#EF4444" }}>{errMsg}</span>
              </div>
            )}
          </>
        )}

        {/* Parsing */}
        {phase === "parsing" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "22px", display: "flex", alignItems: "center", gap: 12 }}>
            <Loader2 size={20} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 14, color: "#64748B" }}>Reading <strong>{fileName}</strong>…</span>
          </div>
        )}

        {/* Ready preview */}
        {phase === "ready" && parsed && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{fileName}</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                  <strong style={{ color: "#F97316" }}>{parsed.total}</strong> rows ·{" "}
                  <strong style={{ color: "#F97316" }}>{parsed.origHeaders.length}</strong> columns detected
                  {parsed.batches?.length ? <> · <strong style={{ color: "#F97316" }}>{parsed.batches.length}</strong> batch rows (Sheet 2)</> : null}
                </div>
              </div>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
            </div>

            {/* Column mapping preview */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Columns detected</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {parsed.origHeaders.map((h, i) => (
                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 5, padding: "3px 8px" }}>
                    <span style={{ fontSize: 11, color: "#475569" }}>{h}</span>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>→</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#F97316" }}>{parsed.normHeaders[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row preview */}
            <div style={{ overflowX: "auto", maxHeight: 200 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={th}>#</th>
                    {parsed.normHeaders.map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #F8FAFC" }}>
                      <td style={{ ...td, color: "#94A3B8" }}>{idx + 1}</td>
                      {parsed.normHeaders.map((h) => (
                        <td key={h} style={td}>{row[h] !== undefined ? String(row[h]) : <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.total > 5 && <div style={{ padding: "6px 14px", fontSize: 11, color: "#94A3B8", background: "#F8FAFC", textAlign: "center" }}>…and {parsed.total - 5} more rows</div>}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={reset} style={{ ...btn, background: "#fff", border: "1.5px solid #E2E8F0", color: "#475569" }}>Cancel</button>
              <button onClick={confirmImport} style={{ ...btn, background: "#F97316", border: "none", color: "#fff" }}>
                Import {parsed.total} rows into {moduleInfo.label}
              </button>
            </div>
          </div>
        )}

        {/* Importing */}
        {phase === "importing" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Loader2 size={32} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
                Saving {parsed?.total} rows to <strong>{activeBranch?.name ?? "database"}</strong>…
                {parsed?.batches?.length ? ` (+ ${parsed.batches.length} batch rows)` : ""}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Please wait</div>
            </div>
          </div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle2 size={22} color="#22C55E" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>Import Complete</span>
            </div>
            <div style={{ display: "flex", gap: 32, marginBottom: result.errors.length > 0 ? 16 : 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#22C55E" }}>{result.inserted}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Inserted</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#EAB308" }}>{result.skipped}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 8, padding: "10px 14px", maxHeight: 130, overflowY: "auto", marginBottom: 12 }}>
                {result.errors.slice(0, 8).map((e, i) => <div key={i} style={{ fontSize: 12, color: "#EF4444", marginBottom: 2 }}>{e}</div>)}
                {result.errors.length > 8 && <div style={{ fontSize: 12, color: "#94A3B8" }}>…and {result.errors.length - 8} more</div>}
              </div>
            )}
            <button onClick={reset} style={{ ...btn, background: "#F97316", color: "#fff", border: "none", marginTop: 4 }}>Import Another File</button>
          </div>
        )}

        {/* Template download */}
        <div style={{ background: "#FFFBF5", border: "1px solid #FED7AA", borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#92400E" }}>
            Need a starting point? Download the <strong>{moduleInfo.label}</strong> template.
          </span>
          <button onClick={() => downloadTemplate(module)} style={{ ...btn, background: "#F97316", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> Template
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569" };
const btn: React.CSSProperties = { padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const th:  React.CSSProperties = { padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" };
const td:  React.CSSProperties = { padding: "6px 10px", fontSize: 11, color: "#1E293B", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
