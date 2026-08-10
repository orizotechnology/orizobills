import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, X, Download, Wifi, WifiOff, Building2,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";
import { useBackendStatus } from "@/hooks/useBackendStatus";

// =============================================================
// IMPORT PAGE
// Attach any Excel/CSV → pick module → preview → confirm → saved
// into the ACTIVE BRANCH database via X-Branch-Id header.
// =============================================================

type Module = "Products" | "Customers" | "Suppliers" | "Expenses" | "Sales" | "Purchases";
type Phase  = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

const MODULES: { value: Module; label: string; desc: string }[] = [
  { value: "Products",   label: "Products",          desc: "Items, stock, pricing & tax" },
  { value: "Customers",  label: "Customers",         desc: "Customer directory with balances" },
  { value: "Suppliers",  label: "Suppliers",         desc: "Vendor directory with balances" },
  { value: "Expenses",   label: "Expenses",          desc: "Expense records with categories" },
  { value: "Sales",      label: "Sale Invoices",     desc: "Bulk sales history import" },
  { value: "Purchases",  label: "Purchase Invoices", desc: "Bulk purchase history import" },
];

// ── Templates ─────────────────────────────────────────────────
const TEMPLATES: Record<Module, string[]> = {
  Products:  ["Item name*","Item code","HSN","Default MRP","Disc % on MRP for Sale Price","Sale price","Purchase price","Discount Type","Sale Discount","Opening stock quantity","Minimum stock quantity","Item Location","Tax Rate","Inclusive Of Tax","Base Unit (x)","Secondary Unit (y)","Conversion Rate (n) (x = ny)"],
  Customers: ["Name*","Phone","Email","Address","GSTIN","Opening Balance"],
  Suppliers: ["Name*","Phone","Email","Address","GSTIN","Opening Balance"],
  Expenses:  ["Category*","Description","Amount*","Payment Method","Expense Date","Reference"],
  Sales:     ["Customer Name","Invoice Date*","Payment Method","Item Name*","Item Code","Quantity*","Unit Price*","Tax %","Discount %"],
  Purchases: ["Supplier Name","Bill Date*","Payment Method","Item Name*","Item Code","Quantity*","Unit Price*","Tax %","Discount %"],
};

// ── Per-module alias maps ──────────────────────────────────────
const ALIAS_PRODUCTS: Record<string, string> = {
  "item name":"name","item name*":"name","product name":"name","product":"name","name*":"name","name":"name",
  "item code":"code","product code":"code","sku":"code","code":"code","part no":"code","part number":"code",
  "default mrp":"mrp","mrp":"mrp","maximum retail price":"mrp","list price":"mrp","listed price":"mrp",
  "disc % on mrp for sale price":"discPctOnMrp","disc % on mrp":"discPctOnMrp","disc%":"discPctOnMrp",
  "sale price":"salePrice","selling price":"salePrice","price":"salePrice","rate":"salePrice","sp":"salePrice","retail price":"salePrice",
  "purchase price":"purchasePrice","cost":"purchasePrice","cost price":"purchasePrice","pp":"purchasePrice","buy price":"purchasePrice","landed cost":"purchasePrice",
  "discount type":"discountType","sale discount":"saleDiscount","discount":"saleDiscount",
  "opening stock quantity":"openingStock","opening stock":"openingStock","opening qty":"openingStock",
  "minimum stock quantity":"lowStockAlert","minimum stock":"lowStockAlert","min stock":"lowStockAlert","reorder level":"lowStockAlert",
  "item location":"location","location":"location","store":"location","warehouse":"location",
  "tax rate":"taxRate","tax":"taxPct","tax%":"taxPct","gst":"taxPct","gst%":"taxPct","vat":"taxPct","vat%":"taxPct",
  "inclusive of tax":"taxInclusive","tax inclusive":"taxInclusive","inclusive":"taxInclusive",
  "base unit (x)":"unit","base unit":"unit","unit":"unit","uom":"unit","unit of measure":"unit",
  "secondary unit (y)":"secondaryUnit","secondary unit":"secondaryUnit","alt unit":"secondaryUnit",
  "conversion rate (n) (x = ny)":"conversionRate","conversion rate":"conversionRate","conv rate":"conversionRate",
  "hsn":"hsn","hsn code":"hsn","hsn/sac":"hsn","sac":"hsn",
  "description":"description","desc":"description","details":"description",
  "barcode":"barcode","ean":"barcode","upc":"barcode","scan code":"barcode",
};
const ALIAS_CUSTOMERS: Record<string, string> = {
  "name":"name","name*":"name","customer name":"name","customer":"name","company":"name","firm name":"name",
  "phone":"phone","mobile":"phone","contact":"phone","mobile no":"phone","telephone":"phone","cell":"phone","whatsapp":"phone",
  "email":"email","email id":"email","e-mail":"email","mail":"email",
  "address":"address","addr":"address","billing address":"address",
  "gstin":"gstin","gst no":"gstin","gst number":"gstin","tax id":"gstin",
  "opening balance":"balance","balance":"balance","outstanding":"balance","due":"balance","amount due":"balance",
};
const ALIAS_SUPPLIERS: Record<string, string> = {
  "name":"name","name*":"name","supplier name":"name","vendor name":"name","vendor":"name","company":"name",
  "phone":"phone","mobile":"phone","contact":"phone","mobile no":"phone",
  "email":"email","email id":"email",
  "address":"address",
  "gstin":"gstin","gst no":"gstin","gst number":"gstin",
  "opening balance":"balance","balance":"balance","outstanding":"balance",
};
const ALIAS_EXPENSES: Record<string, string> = {
  "category":"category","category*":"category","expense category":"category","head":"category","expense head":"category","type":"category",
  "description":"description","details":"description","narration":"description","particulars":"description","remarks":"description",
  "amount":"amount","amount*":"amount","total":"amount","value":"amount","net amount":"amount",
  "payment method":"paymentMethod","payment mode":"paymentMethod","mode":"paymentMethod","paid via":"paymentMethod","pay mode":"paymentMethod",
  "expense date":"expenseDate","date":"expenseDate","transaction date":"expenseDate","voucher date":"expenseDate","bill date":"expenseDate",
  "reference":"reference","ref":"reference","voucher no":"reference","bill no":"reference","doc no":"reference",
  "notes":"notes",
};
const ALIAS_SALES: Record<string, string> = {
  "customer name":"customerName","customer":"customerName","party":"customerName",
  "invoice date":"invoiceDate","invoice date*":"invoiceDate","date":"invoiceDate",
  "payment method":"paymentMethod","payment mode":"paymentMethod","mode":"paymentMethod",
  "item name":"itemName","item name*":"itemName","product name":"itemName","item":"itemName",
  "item code":"itemCode","product code":"itemCode","sku":"itemCode","code":"itemCode",
  "quantity":"quantity","quantity*":"quantity","qty":"quantity",
  "unit price":"unitPrice","unit price*":"unitPrice","rate":"unitPrice","price":"unitPrice",
  "tax %":"taxPercent","tax":"taxPercent","gst %":"taxPercent","gst":"taxPercent",
  "discount %":"discountPct","discount":"discountPct",
};
const ALIAS_PURCHASES: Record<string, string> = {
  "supplier name":"supplierName","supplier":"supplierName","vendor":"supplierName","vendor name":"supplierName","party":"supplierName",
  "bill date":"billDate","bill date*":"billDate","date":"billDate","invoice date":"billDate",
  "payment method":"paymentMethod","payment mode":"paymentMethod","mode":"paymentMethod",
  "item name":"itemName","item name*":"itemName","product name":"itemName","item":"itemName",
  "item code":"itemCode","product code":"itemCode","sku":"itemCode","code":"itemCode",
  "quantity":"quantity","quantity*":"quantity","qty":"quantity",
  "unit price":"unitPrice","unit price*":"unitPrice","rate":"unitPrice","price":"unitPrice",
  "tax %":"taxPercent","tax":"taxPercent","gst %":"taxPercent",
  "discount %":"discountPct","discount":"discountPct",
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

// Normalise a raw header to a camelCase field name using per-module alias map
function normalise(raw: string, mod: Module): string {
  const lower = raw.trim().toLowerCase();
  const map   = getAliasMap(mod);
  if (map[lower]) return map[lower];
  const words = lower.replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return lower;
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

const NUMERIC_KEYS = [
  "mrp","salePrice","purchasePrice","taxPct","discPctOnMrp","saleDiscount",
  "openingStock","lowStockAlert","conversionRate",
  "balance","amount","quantity","unitPrice","taxPercent","discountPct",
];

// ── Parse one sheet (aoa = array-of-arrays from XLSX) ─────────
function parseSheet(
  aoa: unknown[][], mod: Module
): { rows: Record<string, unknown>[]; origHeaders: string[]; normHeaders: string[] } {
  if (aoa.length < 2) return { rows: [], origHeaders: [], normHeaders: [] };
  const origHeaders = (aoa[0] as string[]).map((h) => String(h ?? "").trim()).filter(Boolean);
  if (!origHeaders.length) return { rows: [], origHeaders: [], normHeaders: [] };
  const normHeaders = origHeaders.map((h) => normalise(h, mod));
  const rows: Record<string, unknown>[] = [];

  for (let r = 1; r < aoa.length; r++) {
    const arr = aoa[r] as unknown[];
    if (arr.every((c) => c === "" || c == null)) continue;
    const obj: Record<string, unknown> = {};
    origHeaders.forEach((_, i) => {
      const key = normHeaders[i];
      const val = arr[i];
      if (val === "" || val == null) return;
      if (val instanceof Date) { obj[key] = val.toISOString().slice(0, 10); return; }
      const s = String(val).trim();
      if (NUMERIC_KEYS.includes(key)) {
        const n = parseFloat(s.replace(/[^\d.-]/g, ""));
        // Never store NaN or Infinity — they serialize to null and break the backend
        obj[key] = (isNaN(n) || !isFinite(n)) ? 0 : Math.abs(n);
      } else {
        obj[key] = s;
      }
    });
    rows.push(obj);
  }
  return { rows, origHeaders, normHeaders };
}

// ── ParseResult ────────────────────────────────────────────────
interface ParseResult {
  rows:         Record<string, unknown>[];
  batches?:     Record<string, unknown>[];
  origHeaders:  string[];
  normHeaders:  string[];
  total:        number;
}

// ── Parse the file (handles xlsx, xls, csv) ───────────────────
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
        if (!rows.length)        { resolve({ error: "No data rows found after skipping blank lines." }); return; }

        // Sheet 2 → batch details (Products only)
        let batches: Record<string, unknown>[] | undefined;
        if (module === "Products" && wb.SheetNames.length > 1) {
          const ws2  = wb.Sheets[wb.SheetNames[1]];
          const aoa2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: "" }) as unknown[][];
          const r2   = parseSheet(aoa2, module);
          if (r2.rows.length) batches = r2.rows;
        }
        resolve({ rows, batches, origHeaders, normHeaders, total: rows.length });
      } catch (err) {
        resolve({ error: `Could not read file: ${(err as Error).message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Template download ─────────────────────────────────────────
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
// CIRCULAR PROGRESS RING
// SVG-based ring that fills as rows are processed.
// =============================================================
function CircularProgress({ done, total, inserted }: { done: number; total: number; inserted: number }) {
  const size   = 140;
  const stroke = 10;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = total > 0 ? done / total : 0;
  const dash   = circ * pct;
  const gap    = circ - dash;
  const pctInt = total > 0 ? Math.floor((done / total) * 100) : 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#F1F5F9" strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#F97316"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: "stroke-dasharray 0.15s linear" }}
        />
      </svg>
      {/* Centre text */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
          {pctInt}%
        </span>
        <span style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
          {done}/{total}
        </span>
        <span style={{ fontSize: 11, color: "#22C55E", marginTop: 1, fontWeight: 600 }}>
          {inserted} saved
        </span>
      </div>
    </div>
  );
}

// =============================================================
// MAIN PAGE COMPONENT
// =============================================================
export default function ImportPage() {
  const [module,   setModule]  = useState<Module>("Products");
  const [phase,    setPhase]   = useState<Phase>("idle");
  const [fileName, setFN]      = useState("");
  const [parsed,   setParsed]  = useState<ParseResult | null>(null);
  const [result,   setResult]  = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [errMsg,   setErrMsg]  = useState("");
  // Progress tracking during chunked import
  const [progress, setProgress] = useState<{ done: number; total: number; inserted: number }>({ done: 0, total: 0, inserted: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const { getActiveBranch, branches } = useBranchStore();
  const activeBranch        = getActiveBranch();
  const backendStatus       = useBackendStatus();

  const reset = () => {
    setPhase("idle"); setFN(""); setParsed(null); setResult(null); setErrMsg("");
    setProgress({ done: 0, total: 0, inserted: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const changeModule = (m: Module) => { setModule(m); reset(); };

  // ── File selected or dropped ──────────────────────────────
  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv","xlsx","xls"].includes(ext)) {
      setErrMsg("Only .xlsx, .xls and .csv files are supported.");
      setPhase("error"); return;
    }
    setFN(file.name);
    setPhase("parsing");
    const r = await parseFile(file, module);
    if ("error" in r) { setErrMsg(r.error); setPhase("error"); return; }
    setParsed(r);
    setPhase("ready");
  };

  const onDrop  = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };

  // ── Confirm & send to backend ─────────────────────────────
  const confirmImport = async () => {
    if (!parsed) return;

    // Only block if there are MULTIPLE branches and none is selected.
    if (!activeBranch && branches.length > 1) {
      setErrMsg("Multiple branches exist — please select one from the top bar first.");
      setPhase("error"); return;
    }

    // Pre-send validation: check that rows actually contain the key field
    const REQUIRED_FIELD: Record<Module, string> = {
      Products:  "name",
      Customers: "name",
      Suppliers: "name",
      Expenses:  "amount",
      Sales:     "itemName",
      Purchases: "itemName",
    };
    const reqField = REQUIRED_FIELD[module];
    const validRows = parsed.rows.filter((r) => r[reqField] != null && String(r[reqField]).trim() !== "");
    if (validRows.length === 0) {
      setErrMsg(
        `None of the ${parsed.total} rows have a "${reqField}" column that matches ${moduleInfo.label}.\n\n` +
        `Detected columns: ${parsed.origHeaders.join(", ")}\n\n` +
        `Make sure you selected the correct data type above, or download the template.`
      );
      setPhase("error"); return;
    }

    // Sanitize all values — strip undefined/null/empty, NaN → 0
    const sanitize = (rows: Record<string, unknown>[]) =>
      rows.map((row) => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v === undefined || v === null) continue;
          if (typeof v === "number") { clean[k] = isFinite(v) ? v : 0; continue; }
          if (typeof v === "boolean") { clean[k] = v; continue; }
          const s = String(v).trim();
          if (s !== "") clean[k] = s;
        }
        return clean;
      }).filter((row) => Object.keys(row).length > 0);

    const cleanRows    = sanitize(validRows);
    const cleanBatches = parsed.batches?.length ? sanitize(parsed.batches) : undefined;

    if (cleanRows.length === 0) {
      setErrMsg("No valid rows found after cleaning. Please check the file content.");
      setPhase("error"); return;
    }

    // ── Row-by-row import with live progress ──────────────
    // Send each row individually so the progress ring increments
    // one step at a time and the percentage never jumps.
    const totalRows = cleanRows.length;
    setProgress({ done: 0, total: totalRows, inserted: 0 });
    setPhase("importing");

    let totalInserted = 0;
    let totalSkipped  = 0;
    const allErrors:  string[] = [];

    try {
      for (let i = 0; i < cleanRows.length; i++) {
        const payload: Record<string, unknown> = { rows: [cleanRows[i]] };
        // Send batches only with the first row
        if (i === 0 && cleanBatches?.length) payload.batches = cleanBatches;

        const res = await http.post<{
          success: boolean;
          data:    { inserted: number; skipped: number; errors: string[] };
          error?:  { message: string };
        }>(`/import/${module.toLowerCase()}`, payload);

        if (!res.success) {
          setErrMsg(res.error?.message ?? "Import failed — check backend logs.");
          setPhase("error"); return;
        }

        totalInserted += res.data.inserted;
        totalSkipped  += res.data.skipped;
        allErrors.push(...res.data.errors);

        // Update progress after every single row
        setProgress({ done: i + 1, total: totalRows, inserted: totalInserted });
      }

      setResult({ inserted: totalInserted, skipped: totalSkipped, errors: allErrors });
      setPhase("done");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      const lower = msg.toLowerCase();
      const isNet = lower.includes("failed to fetch") || lower.includes("networkerror") ||
                    lower.includes("load failed") || lower.includes("network request failed");
      const isTooLarge = lower.includes("413") || lower.includes("request entity too large");
      setErrMsg(
        isTooLarge ? `Chunk too large — contact support.` :
        isNet      ? `Network error — could not reach the backend.\n\nCheck the status pill above.` :
        msg
      );
      setPhase("error");
    }
  };

  const moduleInfo = MODULES.find((m) => m.value === module)!

  return (
    <div style={{ padding: "28px 32px", maxWidth: 920, margin: "0 auto" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileSpreadsheet size={20} color="#F97316" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Import Data</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Saving into{" "}
            <Building2 size={12} style={{ verticalAlign: "middle", marginRight: 3 }} />
            <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "Main Branch"}</strong>
            {" "}— columns are detected automatically
          </p>
        </div>
        {/* Backend status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
          background: backendStatus === "online" ? "rgba(34,197,94,0.1)" : backendStatus === "checking" ? "rgba(249,115,22,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${backendStatus === "online" ? "rgba(34,197,94,0.3)" : backendStatus === "checking" ? "rgba(249,115,22,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          {backendStatus === "online"
            ? <><Wifi size={13} color="#16A34A" /><span style={{ fontSize: 12, fontWeight: 600, color: "#16A34A" }}>Server Online</span></>
            : backendStatus === "checking"
            ? <><Loader2 size={13} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 12, fontWeight: 600, color: "#F97316" }}>Connecting…</span></>
            : <><WifiOff size={13} color="#DC2626" /><span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>Server Offline</span></>
          }
        </div>
      </div>

      {/* No branch warning — only shown when multiple branches exist and none selected */}
      {!activeBranch && branches.length > 1 && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} color="#EF4444" />
          <span style={{ fontSize: 13, color: "#EF4444" }}>Select a branch from the top bar first. Data will be saved to the selected branch's database.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>

        {/* ── Module selector ───────────────────────────────── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 22px" }}>
          <label style={lbl}>Select what you are importing</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {MODULES.map(({ value, label, desc }) => {
              const active = module === value;
              return (
                <button key={value} onClick={() => changeModule(value)} style={{
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${active ? "#F97316" : "#E2E8F0"}`,
                  background: active ? "rgba(249,115,22,0.07)" : "#fff",
                }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#F97316" : "#1E293B" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{desc}</div>
                </button>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8" }}>
            Column names are matched automatically — use any header names in your file.
          </p>
        </div>

        {/* ── Drop zone ─────────────────────────────────────── */}
        {(phase === "idle" || phase === "error") && (
          <>
            <div
              onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ background: "#fff", border: `2px dashed ${phase === "error" ? "#FCA5A5" : "#CBD5E1"}`, borderRadius: 12, padding: "44px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer", transition: "border-color 0.15s" }}
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
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, marginBottom: 4 }}>Import Error</div>
                  <div style={{ fontSize: 12, color: "#EF4444", lineHeight: 1.6, whiteSpace: "pre-line" }}>{errMsg}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Parsing spinner ───────────────────────────────── */}
        {phase === "parsing" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "22px", display: "flex", alignItems: "center", gap: 12 }}>
            <Loader2 size={20} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 14, color: "#64748B" }}>Reading <strong>{fileName}</strong>…</span>
          </div>
        )}

        {/* ── Ready — preview ───────────────────────────────── */}
        {phase === "ready" && parsed && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            {/* Summary bar */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{fileName}</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                  <strong style={{ color: "#F97316" }}>{parsed.total}</strong> rows ·{" "}
                  <strong style={{ color: "#F97316" }}>{parsed.origHeaders.length}</strong> columns detected
                  {parsed.batches?.length ? <> · <strong style={{ color: "#F97316" }}>{parsed.batches.length}</strong> batch rows (Sheet 2)</> : null}
                  {" "}→ will save to <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "Main Branch"}</strong> as <strong style={{ color: "#F97316" }}>{moduleInfo.label}</strong>
                </div>
              </div>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={16} /></button>
            </div>

            {/* Column mapping */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Columns detected in your file</p>
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

            {/* Data preview — first 5 rows */}
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
                        <td key={h} style={td}>
                          {row[h] !== undefined ? String(row[h]) : <span style={{ color: "#CBD5E1" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.total > 5 && (
                <div style={{ padding: "6px 14px", fontSize: 11, color: "#94A3B8", background: "#F8FAFC", textAlign: "center" }}>
                  …and {parsed.total - 5} more rows not shown
                </div>
              )}
            </div>

            {/* Confirm */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={reset} style={{ ...btn, background: "#fff", border: "1.5px solid #E2E8F0", color: "#475569" }}>Cancel</button>
              <button
                onClick={confirmImport}
                disabled={(!activeBranch && branches.length > 1) || backendStatus === "offline"}
                style={{ ...btn, background: ((!activeBranch && branches.length > 1) || backendStatus === "offline") ? "#CBD5E1" : "#F97316", border: "none", color: "#fff", cursor: ((!activeBranch && branches.length > 1) || backendStatus === "offline") ? "not-allowed" : "pointer" }}
              >
                Save {parsed.total} {moduleInfo.label} → {activeBranch?.name ?? "Main Branch"}
              </button>
            </div>
          </div>
        )}

        {/* ── Importing — circular progress ring ───────────── */}
        {phase === "importing" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <CircularProgress
              done={progress.done}
              total={progress.total}
              inserted={progress.inserted}
            />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                Importing {moduleInfo.label} into{" "}
                <span style={{ color: "#F97316" }}>{activeBranch?.name ?? "Main Branch"}</span>
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                Row {progress.done} of {progress.total} · {progress.inserted} saved
              </div>
            </div>
          </div>
        )}

        {/* ── Done ─────────────────────────────────────────── */}
        {phase === "done" && result && (
          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle2 size={22} color="#22C55E" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>
                Import Complete — {moduleInfo.label} saved to <span style={{ color: "#F97316" }}>{activeBranch?.name ?? "Main Branch"}</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 36, marginBottom: result.errors.length > 0 ? 16 : 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#22C55E" }}>{result.inserted}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Saved</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#EAB308" }}>{result.skipped}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 8, padding: "10px 14px", maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Row errors ({result.errors.length})</div>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#EF4444", marginBottom: 3, lineHeight: 1.5 }}>{e}</div>)}
              </div>
            )}
            <button onClick={reset} style={{ ...btn, background: "#F97316", color: "#fff", border: "none", marginTop: 4 }}>
              Import Another File
            </button>
          </div>
        )}

        {/* ── Template hint ─────────────────────────────────── */}
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

// ── Shared styles ─────────────────────────────────────────────
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569" };
const btn: React.CSSProperties = { padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const th:  React.CSSProperties = { padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" };
const td:  React.CSSProperties = { padding: "6px 10px", fontSize: 11, color: "#1E293B", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
