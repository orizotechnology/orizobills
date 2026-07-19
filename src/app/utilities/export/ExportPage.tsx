import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Download, FileSpreadsheet, CheckCircle2, Loader2,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// EXPORT PAGE — export any module to Excel or CSV
// =============================================================

type Module = "Products" | "Customers" | "Suppliers" | "Expenses" |
              "Sales" | "Purchases" | "Payments";

const MODULES: { value: Module; label: string; desc: string; endpoint: string }[] = [
  { value: "Products",  label: "Products",        desc: "Full product catalogue with pricing & stock", endpoint: "/products?pageSize=9999&filter=all" },
  { value: "Customers", label: "Customers",        desc: "Customer directory with balances",            endpoint: "/customers?pageSize=9999" },
  { value: "Suppliers", label: "Suppliers",        desc: "Supplier directory with balances",            endpoint: "/suppliers?pageSize=9999" },
  { value: "Expenses",  label: "Expenses",         desc: "All expense records",                         endpoint: "/expenses?pageSize=9999" },
  { value: "Sales",     label: "Sale Invoices",    desc: "All sale invoices",                           endpoint: "/sales?pageSize=9999" },
  { value: "Purchases", label: "Purchases",        desc: "All purchase invoices",                       endpoint: "/purchases?pageSize=9999" },
  { value: "Payments",  label: "Payments In",      desc: "All customer payments received",              endpoint: "/payments?pageSize=9999" },
];

// Column definitions per module
const HEADERS: Record<Module, string[]> = {
  Products:  ["Name", "Code", "HSN", "MRP", "Sale Price", "Purchase Price", "Tax %", "Tax Rate", "Tax Inclusive", "Unit", "Secondary Unit", "Discount Type", "Sale Discount", "Location", "Barcode", "Description"],
  Customers: ["Name", "Phone", "Email", "Address", "GSTIN", "Balance"],
  Suppliers: ["Name", "Phone", "Email", "Address", "GSTIN", "Balance"],
  Expenses:  ["Expense Number", "Category", "Description", "Amount", "Payment Method", "Expense Date", "Reference"],
  Sales:     ["Invoice Number", "Customer Name", "Invoice Date", "Payment Method", "Subtotal", "Discount Amt", "CGST", "SGST", "Total Amt", "Paid Amt", "Balance Due", "Status"],
  Purchases: ["Invoice Number", "Supplier Name", "Bill Date", "Payment Method", "Subtotal", "Discount Amt", "Tax Amt", "Total Amt", "Status"],
  Payments:  ["Payment Number", "Customer Name", "Amount", "Payment Method", "Payment Date", "Reference"],
};

// Field keys matching the API response
const FIELD_KEYS: Record<Module, string[]> = {
  Products:  ["name","code","hsn","mrp","salePrice","purchasePrice","taxPct","taxRate","taxInclusive","unit","secondaryUnit","discountType","saleDiscount","location","barcode","description"],
  Customers: ["name","phone","email","address","gstin","balance"],
  Suppliers: ["name","phone","email","address","gstin","balance"],
  Expenses:  ["expenseNumber","category","description","amount","paymentMethod","expenseDate","reference"],
  Sales:     ["invoiceNumber","customerName","invoiceDate","paymentMethod","subtotal","discountAmt","cgst","sgst","totalAmt","paidAmt","balanceDue","status"],
  Purchases: ["invoiceNumber","supplierName","billDate","paymentMethod","subtotal","discountAmt","taxAmt","totalAmt","status"],
  Payments:  ["paymentNumber","customerName","amount","paymentMethod","paymentDate","reference"],
};

function buildSheet(rows: Record<string, unknown>[], module: Module): XLSX.WorkSheet {
  const headers = HEADERS[module];
  const keys    = FIELD_KEYS[module];
  const data    = rows.map((r) =>
    keys.map((k) => {
      const v = r[k];
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "Yes" : "No";
      if (typeof v === "string" && (k.endsWith("Date") || k.endsWith("At"))) {
        // Format date strings nicely
        try { return new Date(v).toLocaleDateString("en-IN"); } catch { return v; }
      }
      return v;
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  return ws;
}

export default function ExportPage() {
  const [selected, setSelected] = useState<Set<Module>>(new Set(["Products"]));
  const [fmt, setFmt]           = useState<"xlsx" | "csv">("xlsx");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");
  const { getActiveBranch }     = useBranchStore();
  const activeBranch            = getActiveBranch();

  const toggle = (m: Module) => {
    setSelected((p) => {
      const n = new Set(p);
      n.has(m) ? n.delete(m) : n.add(m);
      return n;
    });
    setDone(false);
    setError("");
  };

  const handleExport = async () => {
    if (!selected.size) return;
    setLoading(true); setDone(false); setError("");
    try {
      const wb = XLSX.utils.book_new();

      for (const mod of selected) {
        const cfg  = MODULES.find((m) => m.value === mod)!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await http.get<any>(cfg.endpoint);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rows: any[] = [];
        if (Array.isArray(json?.data))            rows = json.data;
        else if (Array.isArray(json?.data?.data)) rows = json.data.data;

        const ws = buildSheet(rows, mod);
        XLSX.utils.book_append_sheet(wb, ws, mod);
      }

      const fname = `orizo_export_${new Date().toISOString().slice(0, 10)}.${fmt}`;
      XLSX.writeFile(
        wb, fname,
        fmt === "csv" && selected.size === 1 ? { bookType: "csv" } : undefined
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Download size={20} color="#F97316" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Export Data</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Export from <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "current branch"}</strong> to Excel or CSV
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Module selection */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 24px" }}>
          <label style={lbl}>Select Data to Export</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {MODULES.map(({ value, label, desc }) => {
              const on = selected.has(value);
              return (
                <button key={value} onClick={() => toggle(value)} style={{
                  padding: "8px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${on ? "#F97316" : "#E2E8F0"}`,
                  background: on ? "rgba(249,115,22,0.07)" : "#fff",
                }}>
                  <div style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: on ? "#F97316" : "#1E293B" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{desc}</div>
                </button>
              );
            })}
          </div>
          {selected.size > 1 && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8" }}>
              Multiple modules selected → exported as separate sheets in one .xlsx file.
            </p>
          )}
        </div>

        {/* Format */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "18px 24px" }}>
          <label style={lbl}>Format</label>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {(["xlsx", "csv"] as const).map((f) => (
              <button key={f} onClick={() => setFmt(f)} style={{
                padding: "7px 20px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${fmt === f ? "#F97316" : "#E2E8F0"}`,
                background: fmt === f ? "rgba(249,115,22,0.07)" : "#fff",
                color: fmt === f ? "#F97316" : "#475569",
                fontWeight: fmt === f ? 700 : 400, fontSize: 13, textTransform: "uppercase",
              }}>
                .{f}
              </button>
            ))}
          </div>
          {fmt === "csv" && selected.size > 1 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#EAB308" }}>
              CSV only supports one sheet — select a single module or switch to .xlsx.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#EF4444" }}>
            {error}
          </div>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={!selected.size || loading}
          style={{
            padding: "13px 0", borderRadius: 10, border: "none",
            background: !selected.size ? "#CBD5E1" : "#F97316", color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: !selected.size || loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "inherit",
          }}
        >
          {loading ? (
            <><Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} /> Preparing export…</>
          ) : done ? (
            <><CheckCircle2 size={16} /> Downloaded!</>
          ) : (
            <><Download size={16} />
              Export {selected.size ? [...selected].join(", ") : "— select a module"}
            </>
          )}
        </button>

        {done && (
          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color="#22C55E" />
            File downloaded to your Downloads folder.
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#475569" };
