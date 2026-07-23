import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertCircle, Loader2, X,
} from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// TYPES
// =============================================================

type Module = "Products" | "Customers" | "Suppliers" | "Expenses";
type Phase  = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

const MODULES: Module[] = ["Products", "Customers", "Suppliers", "Expenses"];

// =============================================================
// KEY NORMALISER
// Converts any header string to a camelCase DB key.
// e.g. "Sale Price" → "salePrice"
//      "GSTIN No."  → "gstin"
//      "tax %"      → "taxPct"
// =============================================================

const ALIAS_MAP: Record<string, string> = {
  // ── Products (Item Details sheet) ─────────────────────────
  "product name": "name", "product": "name", "item name": "name", "item": "name", "title": "name",
  "product code": "code", "sku": "code", "item code": "code", "part no": "code", "part number": "code",
  "code": "code", "product id": "code", "prod code": "code", "material code": "code",
  "ean": "barcode", "upc": "barcode", "ean13": "barcode", "scan code": "barcode", "barcode": "barcode",
  // MRP
  "maximum retail price": "mrp", "max price": "mrp", "listed price": "mrp", "list price": "mrp",
  "mrp": "mrp", "default mrp": "mrp",
  // Disc % on MRP
  "disc % on mrp for sale price": "discPctOnMrp", "disc % on mrp": "discPctOnMrp",
  "disc%": "discPctOnMrp", "mrp discount": "discPctOnMrp",
  // Sale price
  "sale price": "salePrice", "selling price": "salePrice", "price": "salePrice", "rate": "salePrice",
  "sp": "salePrice", "retail price": "salePrice", "sales price": "salePrice",
  // Purchase price
  "purchase price": "purchasePrice", "cost": "purchasePrice", "cost price": "purchasePrice",
  "pp": "purchasePrice", "buy price": "purchasePrice", "buying price": "purchasePrice",
  "landed cost": "purchasePrice",
  // Discount type & sale discount
  "discount type": "discountType",
  "sale discount": "saleDiscount", "discount": "saleDiscount",
  // HSN
  "hsn": "hsn", "hsn code": "hsn", "hsn/sac": "hsn", "sac": "hsn",
  // Opening & minimum stock
  "opening stock quantity": "openingStock", "opening stock": "openingStock", "opening qty": "openingStock",
  "minimum stock quantity": "lowStockAlert", "minimum stock": "lowStockAlert", "min stock": "lowStockAlert",
  "reorder level": "lowStockAlert",
  // Location
  "item location": "location", "location": "location", "store": "location", "warehouse": "location",
  "tax rate": "taxRate", "tax": "taxPct", "tax%": "taxPct", "gst": "taxPct", "gst%": "taxPct",
  "tax percent": "taxPct", "tax pct": "taxPct", "vat": "taxPct", "vat%": "taxPct",
  // Inclusive / exclusive
  "inclusive of tax": "taxInclusive", "tax inclusive": "taxInclusive",
  "inclusive": "taxInclusive", "exclusive": "taxInclusive",
  // Units
  "unit of measure": "unit", "uom": "unit", "unit": "unit", "base unit (x)": "unit", "base unit": "unit",
  "secondary unit (y)": "secondaryUnit", "secondary unit": "secondaryUnit", "alt unit": "secondaryUnit",
  "conversion rate (n) (x = ny)": "conversionRate", "conversion rate": "conversionRate",
  "conv rate": "conversionRate",
  // Misc
  "desc": "description", "description": "description", "details": "description",
  "product description": "description", "item description": "description",
  // ── Batch Details sheet ────────────────────────────────────
  "size": "size", "batch": "batchName", "batch name": "batchName",
  // ── Customers / Suppliers ──────────────────────────────────
  "customer name": "name", "client": "name", "party": "name",
  "vendor name": "name", "vendor": "name", "supplier name": "name", "supplier": "name",
  "company": "name", "company name": "name", "firm name": "name",
  "mobile": "phone", "contact": "phone", "phone no": "phone", "mobile no": "phone",
  "telephone": "phone", "phone": "phone", "cell": "phone", "cell no": "phone",
  "contact no": "phone", "whatsapp": "phone",
  "email id": "email", "mail": "email", "e-mail": "email", "email": "email",
  "email address": "email",
  "addr": "address", "address": "address", "city": "address",
  "billing address": "address", "shipping address": "address",
  "gst no": "gstin", "gstin no": "gstin", "tax id": "gstin", "vat no": "gstin",
  "gstin": "gstin", "gst number": "gstin",
  "outstanding": "balance", "due": "balance", "amount due": "balance",
  "opening balance": "balance", "balance": "balance", "pending": "balance",
  "credit": "balance", "debit": "balance",
  // ── Expenses ──────────────────────────────────────────────
  "expense type": "category", "type": "category", "head": "category",
  "expense head": "category", "category": "category", "account": "category",
  "expense category": "category", "ledger": "category",
  "narration": "description", "particulars": "description", "remarks": "description",
  "total": "amount", "value": "amount", "expense amount": "amount",
  "sum": "amount", "amount": "amount", "net amount": "amount",
  "payment method": "paymentMethod", "mode": "paymentMethod",
  "payment mode": "paymentMethod", "paid via": "paymentMethod",
  "pay mode": "paymentMethod", "payment type": "paymentMethod",
  "expense date": "expenseDate", "transaction date": "expenseDate",
  "voucher date": "expenseDate", "entry date": "expenseDate",
  "date": "expenseDate", "bill date": "expenseDate",
  "ref": "reference", "voucher no": "reference", "bill no": "reference",
  "invoice no": "reference", "receipt no": "reference", "reference": "reference",
  "reference no": "reference", "doc no": "reference",
};

function normaliseKey(raw: string): string {
  // 1. trim, lowercase
  const lower = raw.trim().toLowerCase();
  // 2. check alias map first
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  // 3. strip non-alphanumeric, split into words, camelCase
  const words = lower.replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return lower;
  return words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

// =============================================================
// PARSE EXCEL — reads any file, normalises column keys
// For Products: also reads the "Batch Details" sheet (Sheet 2)
// =============================================================

interface ParseResult {
  rows: Record<string, unknown>[];
  batches?: Record<string, unknown>[];  // from Batch Details sheet (products only)
  originalHeaders: string[];
  normalisedHeaders: string[];
  totalDataRows: number;
}

function sheetToRows(
  aoa: unknown[][],
  numericFields: string[]
): { rows: Record<string, unknown>[]; original: string[]; normalised: string[] } {
  if (aoa.length < 2) return { rows: [], original: [], normalised: [] };

  const rawHeaders  = (aoa[0] as string[]).map((h) => String(h ?? "").trim()).filter(Boolean);
  if (!rawHeaders.length) return { rows: [], original: [], normalised: [] };

  const normHeaders = rawHeaders.map(normaliseKey);
  const rows: Record<string, unknown>[] = [];

  for (let r = 1; r < aoa.length; r++) {
    const rowArr = aoa[r] as unknown[];
    if (rowArr.every((c) => c === "" || c == null)) continue;

    const obj: Record<string, unknown> = {};
    rawHeaders.forEach((_, i) => {
      const key = normHeaders[i];
      const val = rowArr[i];
      if (val === "" || val == null) return;
      if (val instanceof Date) {
        obj[key] = val.toISOString().slice(0, 10);
      } else {
        const s = String(val).trim();
        if (numericFields.includes(key)) {
          const cleaned = s.replace(/[^\d.-]/g, "");
          const n = parseFloat(cleaned);
          obj[key] = isNaN(n) ? 0 : Math.abs(n);
        } else {
          obj[key] = s;
        }
      }
    });
    rows.push(obj);
  }

  return { rows, original: rawHeaders, normalised: normHeaders };
}

const NUMERIC_FIELDS = [
  "mrp", "salePrice", "purchasePrice", "taxPct", "discPctOnMrp", "saleDiscount",
  "openingStock", "lowStockAlert", "conversionRate",
  "balance", "amount", "quantity", "qty",
];

function parseExcel(file: File, module: Module): Promise<ParseResult | { error: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array", cellDates: true });

        // Sheet 1 — main data (Item Details or any single-sheet file)
        const ws1  = wb.Sheets[wb.SheetNames[0]];
        const aoa1: unknown[][] = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: "" });

        if (aoa1.length < 2) { resolve({ error: "File has no data rows." }); return; }

        const { rows, original, normalised } = sheetToRows(aoa1, NUMERIC_FIELDS);

        if (!original.length) { resolve({ error: "First row has no headers." }); return; }
        if (rows.length === 0) { resolve({ error: "No data rows found in the file." }); return; }

        // Sheet 2 — Batch Details (only relevant for Products)
        let batches: Record<string, unknown>[] | undefined;
        if (module === "Products" && wb.SheetNames.length > 1) {
          const ws2  = wb.Sheets[wb.SheetNames[1]];
          const aoa2: unknown[][] = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: "" });
          const result2 = sheetToRows(aoa2, ["openingStock", "quantity"]);
          if (result2.rows.length > 0) batches = result2.rows;
        }

        resolve({
          rows,
          batches,
          originalHeaders:   original,
          normalisedHeaders: normalised,
          totalDataRows:     rows.length,
        });
      } catch (err) {
        resolve({ error: `Could not read file: ${(err as Error).message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// =============================================================
// TEMPLATE DOWNLOAD
// =============================================================

const TEMPLATES: Record<Module, string[]> = {
  Products: [
    "Item name", "Item code", "HSN", "Default MRP",
    "Disc % on MRP for Sale Price", "Sale price", "Purchase price",
    "Discount Type", "Sale Discount",
    "Opening stock quantity", "Minimum stock quantity",
    "Item Location", "Tax Rate", "Inclusive Of Tax",
    "Base Unit (x)", "Secondary Unit (y)", "Conversion Rate (n) (x = ny)",
  ],
  Customers: ["Name", "Phone", "Email", "Address", "GSTIN", "Balance"],
  Suppliers: ["Name", "Phone", "Email", "Address", "GSTIN", "Balance"],
  Expenses:  ["Category", "Description", "Amount", "Payment Method", "Expense Date", "Reference"],
};

function downloadTemplate(module: Module) {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATES[module]]);
  ws["!cols"] = TEMPLATES[module].map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, module);
  XLSX.writeFile(wb, `${module}_template.xlsx`);
}

// =============================================================
// MAIN PAGE
// =============================================================

export default function ImportExportPage() {
  const [tab, setTab] = useState<"import" | "export">("import");
  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileSpreadsheet size={20} color="#F97316" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Import &amp; Export</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Attach any Excel or CSV — columns are detected automatically, no mapping needed</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {(["import", "export"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 24px", borderRadius: 8, border: "none",
            background: tab === t ? "#fff" : "transparent",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            color: tab === t ? "#F97316" : "#64748B",
            fontWeight: tab === t ? 600 : 400, fontSize: 14, cursor: "pointer",
          }}>{t === "import" ? "Import" : "Export"}</button>
        ))}
      </div>

      {tab === "import" ? <ImportPanel /> : <ExportPanel />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// =============================================================
// IMPORT PANEL
// =============================================================

function ImportPanel() {
  const [module, setModule]   = useState<Module>("Products");
  const [phase,  setPhase]    = useState<Phase>("idle");
  const [fileName, setFN]     = useState("");
  const [parsed,  setParsed]  = useState<ParseResult | null>(null);
  const [result,  setResult]  = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [errMsg,  setErrMsg]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase("idle"); setFN(""); setParsed(null);
    setResult(null); setErrMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // When module changes, reset so user picks a new file
  const changeModule = (m: Module) => { setModule(m); reset(); };

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv","xlsx","xls"].includes(ext)) {
      setErrMsg("Only .xlsx, .xls and .csv files are supported."); setPhase("error"); return;
    }
    setFN(file.name);
    setPhase("parsing");
    const r = await parseExcel(file, module);
    if ("error" in r) { setErrMsg(r.error); setPhase("error"); return; }
    if (r.totalDataRows === 0) { setErrMsg("No data rows found in the file."); setPhase("error"); return; }
    setParsed(r);
    setPhase("ready");
  };

  const onDrop  = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };

  const confirmImport = async () => {
    if (!parsed) return;
    setPhase("importing");
    try {
      const payload: { rows: Record<string, unknown>[]; batches?: Record<string, unknown>[] } = {
        rows: parsed.rows,
      };
      if (parsed.batches?.length) payload.batches = parsed.batches;

      const res = await http.post<{ success: boolean; data: { inserted: number; skipped: number; errors: string[] }; error?: { message: string } }>(
        `/import/${module.toLowerCase()}`, payload
      );
      if (res.success) { setResult(res.data); setPhase("done"); }
      else { setErrMsg(res.error?.message ?? "Import failed — check backend logs."); setPhase("error"); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      const isNetworkErr = msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror");
      setErrMsg(
        isNetworkErr
          ? "The backend request could not be completed right now. The server may still be starting — please wait a few seconds and retry."
          : msg
      );
      setPhase("error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Module select */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 22px" }}>
        <label style={lblSt}>Select Module</label>
        <div style={{ position: "relative", width: 220, marginTop: 8 }}>
          <select value={module} onChange={(e) => changeModule(e.target.value as Module)}
            style={{ width: "100%", appearance: "none", padding: "9px 32px 9px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 14, color: "#0F172A", background: "#F8FAFC", cursor: "pointer", outline: "none" }}>
            {MODULES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8" }}>
          Attach your file — any column names are accepted and matched automatically.
        </p>
      </div>

      {/* Drop zone — only when idle or error */}
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
                .xlsx · .xls · .csv — columns are identified from the first row
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

      {/* Parsing spinner */}
      {phase === "parsing" && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "22px", display: "flex", alignItems: "center", gap: 12 }}>
          <Loader2 size={20} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
          <span style={{ fontSize: 14, color: "#64748B" }}>Reading <strong>{fileName}</strong>…</span>
        </div>
      )}

      {/* Ready — show detected columns + row count, single confirm button */}
      {phase === "ready" && parsed && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          {/* Summary bar */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{fileName}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                <strong style={{ color: "#F97316" }}>{parsed.totalDataRows}</strong> rows detected
                &nbsp;·&nbsp;
                <strong style={{ color: "#F97316" }}>{parsed.originalHeaders.length}</strong> columns identified
                {parsed.batches?.length ? (
                  <>&nbsp;·&nbsp;<strong style={{ color: "#F97316" }}>{parsed.batches.length}</strong> batch rows (Sheet 2)</>
                ) : null}
              </div>
            </div>
            <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
              <X size={16} />
            </button>
          </div>

          {/* Detected columns → normalised keys */}
          <div style={{ padding: "14px 22px", borderBottom: "1px solid #F1F5F9" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Columns found in your file
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {parsed.originalHeaders.map((h, i) => (
                <div key={h} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 10px" }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>{h}</span>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>→</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#F97316" }}>{parsed.normalisedHeaders[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview — first 5 rows */}
          <div style={{ overflowX: "auto", maxHeight: 220 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <th style={thSt}>#</th>
                  {parsed.normalisedHeaders.map((h) => <th key={h} style={thSt}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    <td style={{ ...tdSt, color: "#94A3B8" }}>{idx + 1}</td>
                    {parsed.normalisedHeaders.map((h) => (
                      <td key={h} style={tdSt}>{row[h] !== undefined ? String(row[h]) : <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.totalDataRows > 5 && (
              <div style={{ padding: "8px 14px", fontSize: 12, color: "#94A3B8", background: "#F8FAFC", textAlign: "center" }}>
                …and {parsed.totalDataRows - 5} more rows not shown
              </div>
            )}
          </div>

          {/* Confirm */}
          <div style={{ padding: "14px 22px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={reset} style={{ ...btnSt, background: "#fff", border: "1.5px solid #E2E8F0", color: "#475569" }}>Cancel</button>
            <button onClick={confirmImport} style={{ ...btnSt, background: "#F97316", border: "none", color: "#fff" }}>
              Confirm Import &mdash; {parsed.totalDataRows} rows
            </button>
          </div>
        </div>
      )}

      {/* Importing spinner */}
      {phase === "importing" && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Loader2 size={32} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
              Saving {parsed?.totalDataRows} rows to database…
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
            <StatChip label="Inserted" value={result.inserted} color="#22C55E" />
            <StatChip label="Skipped"  value={result.skipped}  color="#EAB308" />
          </div>
          {result.errors.length > 0 && (
            <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 8, padding: "10px 14px", maxHeight: 130, overflowY: "auto", marginBottom: 12 }}>
              {result.errors.slice(0, 8).map((e, i) => <div key={i} style={{ fontSize: 12, color: "#EF4444", marginBottom: 2 }}>{e}</div>)}
              {result.errors.length > 8 && <div style={{ fontSize: 12, color: "#94A3B8" }}>…and {result.errors.length - 8} more</div>}
            </div>
          )}
          <button onClick={reset} style={{ ...btnSt, background: "#F97316", color: "#fff", border: "none", marginTop: 4 }}>Import Another File</button>
        </div>
      )}

      {/* Template hint */}
      <div style={{ background: "#FFFBF5", border: "1px solid #FED7AA", borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#92400E" }}>
          Need a starting point? Download a sample template for <strong>{module}</strong>.
        </span>
        <button onClick={() => downloadTemplate(module)} style={{ ...btnSt, background: "#F97316", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={14} /> Template
        </button>
      </div>
    </div>
  );
}

// =============================================================
// EXPORT PANEL
// =============================================================

function ExportPanel() {
  const [selected, setSelected] = useState<Set<Module>>(new Set(["Products"]));
  const [fmt,      setFmt]      = useState<"xlsx" | "csv">("xlsx");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const toggle = (m: Module) => {
    setSelected((p) => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });
    setDone(false);
  };

  const handleExport = async () => {
    if (!selected.size) return;
    setLoading(true); setDone(false);
    try {
      const wb = XLSX.utils.book_new();
      for (const mod of selected) {
        // Build the correct endpoint per module
        let ep: string;
        if (mod === "Products") {
          ep = "/products?pageSize=9999&filter=all";
        } else if (mod === "Customers") {
          ep = "/customers?pageSize=9999";
        } else if (mod === "Suppliers") {
          ep = "/suppliers?pageSize=9999";
        } else {
          ep = "/expenses?pageSize=9999";
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await http.get<any>(ep);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rows: any[] = [];
        if (Array.isArray(json?.data))            rows = json.data;
        else if (Array.isArray(json?.data?.data)) rows = json.data.data;

        const headers = TEMPLATES[mod];
        const normH   = headers.map(normaliseKey);
        const data    = rows.map((r) => normH.map((k) => r[k] !== undefined && r[k] !== null ? r[k] : ""));

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        ws["!cols"] = headers.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws, mod);
      }
      const fname = `orizo_export_${new Date().toISOString().slice(0, 10)}.${fmt}`;
      XLSX.writeFile(wb, fname, fmt === "csv" && selected.size === 1 ? { bookType: "csv" } : undefined);
      setDone(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 24px" }}>
        <label style={lblSt}>Select Data to Export</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {MODULES.map((m) => {
            const on = selected.has(m);
            return (
              <button key={m} onClick={() => toggle(m)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${on ? "#F97316" : "#E2E8F0"}`, background: on ? "rgba(249,115,22,0.08)" : "#fff", color: on ? "#F97316" : "#475569", fontWeight: on ? 600 : 400, fontSize: 13, cursor: "pointer" }}>
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 24px" }}>
        <label style={lblSt}>Format</label>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          {(["xlsx", "csv"] as const).map((f) => (
            <button key={f} onClick={() => setFmt(f)} style={{ padding: "7px 18px", borderRadius: 8, border: `1.5px solid ${fmt === f ? "#F97316" : "#E2E8F0"}`, background: fmt === f ? "rgba(249,115,22,0.08)" : "#fff", color: fmt === f ? "#F97316" : "#475569", fontWeight: fmt === f ? 600 : 400, fontSize: 13, cursor: "pointer", textTransform: "uppercase" }}>
              .{f}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleExport} disabled={!selected.size || loading}
        style={{ ...btnSt, background: !selected.size ? "#CBD5E1" : "#F97316", border: "none", color: "#fff", fontSize: 14, padding: "12px 0", borderRadius: 10, cursor: !selected.size || loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Preparing…</>
         : done   ? <><CheckCircle2 size={16} /> Downloaded!</>
         : <><Download size={16} /> Export {selected.size ? [...selected].join(", ") : "— select a module"}</>}
      </button>
    </div>
  );
}

// =============================================================
// TINY HELPERS
// =============================================================

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748B" }}>{label}</div>
    </div>
  );
}

const lblSt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569" };
const btnSt: React.CSSProperties = { padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const thSt:  React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdSt:  React.CSSProperties = { padding: "7px 12px", fontSize: 12, color: "#1E293B", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
