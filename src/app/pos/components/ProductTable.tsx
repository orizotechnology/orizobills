import { Trash2 } from "lucide-react";

// =============================================================
// PRODUCT TABLE ROW TYPE
// =============================================================
export interface ProductRow {
  id: string;
  product: string;
  code: string;
  productId?: string;   // DB product id — used for inventory deduction on save
  qty: number;
  mrp: number;
  price: number;
  discPct: number;
  discAmt: number;
  taxPct: number;
  taxAmt: number;
  total: number;
}

interface ProductTableProps {
  rows: ProductRow[];
  onRemoveRow: (id: string) => void;
  onUpdateRow: (id: string, field: keyof ProductRow, value: number | string) => void;
}

const COL_HEADERS = [
  { label: "#",          width: 36  },
  { label: "PRODUCT",    width: 140 },
  { label: "CODE",       width: 90  },
  { label: "QTY",        width: 60  },
  { label: "MRP (₹)",    width: 80  },
  { label: "PRICE (₹)",  width: 80  },
  { label: "DISC %",     width: 64  },
  { label: "DISC AMT (₹)", width: 80 },
  { label: "TAX %",      width: 60  },
  { label: "TAX AMT (₹)", width: 80 },
  { label: "TOTAL (₹)",  width: 90  },
  { label: "ACTION",     width: 60  },
];

// Drop .00 suffix — show 12 not 12.00, but keep 12.50
function fmtNum(n: number): string {
  const s = n.toFixed(2);
  return s.endsWith(".00") ? String(Math.round(n)) : s;
}

function EditableCell({
  value, onChange,
}: { value: string | number; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", border: "none", background: "transparent",
        fontSize: 12, color: "#1E293B", outline: "none",
        fontFamily: "inherit", padding: "2px 0", textAlign: "right",
      }}
      onFocus={(e) => { e.currentTarget.style.background = "#FFF7ED"; e.currentTarget.style.borderRadius = "4px"; }}
      onBlur={(e) => { e.currentTarget.style.background = "transparent"; }}
    />
  );
}

export function ProductTable({ rows, onRemoveRow, onUpdateRow }: ProductTableProps) {
  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        {/* Header */}
        <thead>
          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            {COL_HEADERS.map(({ label, width }) => (
              <th key={label} style={{
                padding: "8px 10px", textAlign: label === "#" ? "center" : "right",
                fontSize: 11, fontWeight: 700, color: "#64748B",
                whiteSpace: "nowrap", width,
                borderRight: "1px solid #F1F5F9",
                position: "sticky", top: 0, background: "#F8FAFC",
                ...(label === "PRODUCT" ? { textAlign: "left" } : {}),
                ...(label === "ACTION" ? { textAlign: "center" } : {}),
              }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.length === 0 ? (
            // Empty state
            <tr>
              <td colSpan={12} style={{ padding: "60px 0", textAlign: "center" }}>
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>
                    No items added.
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Search a product above or scan a barcode.
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={row.id}
                style={{ borderBottom: "1px solid #F1F5F9" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
              >
                <td style={{ padding: "6px 10px", textAlign: "center", color: "#94A3B8" }}>{idx + 1}</td>
                <td style={{ padding: "6px 10px", color: "#1E293B", fontWeight: 500, textAlign: "left" }}>
                  {row.product || "—"}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{row.code}</td>
                <td style={{ padding: "6px 10px" }}>
                  <EditableCell value={row.qty} onChange={(v) => onUpdateRow(row.id, "qty", parseFloat(v) || 0)} />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <EditableCell value={fmtNum(row.mrp)} onChange={(v) => onUpdateRow(row.id, "mrp", parseFloat(v) || 0)} />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <EditableCell value={fmtNum(row.price)} onChange={(v) => onUpdateRow(row.id, "price", parseFloat(v) || 0)} />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <EditableCell value={fmtNum(row.discPct)} onChange={(v) => onUpdateRow(row.id, "discPct", parseFloat(v) || 0)} />
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtNum(row.discAmt)}</td>
                <td style={{ padding: "6px 10px" }}>
                  <EditableCell value={fmtNum(row.taxPct)} onChange={(v) => onUpdateRow(row.id, "taxPct", parseFloat(v) || 0)} />
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#64748B" }}>{fmtNum(row.taxAmt)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#1E293B" }}>{fmtNum(row.total)}</td>
                <td style={{ padding: "6px 10px", textAlign: "center" }}>
                  <button
                    onClick={() => onRemoveRow(row.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#EF4444", padding: 4, borderRadius: 6, outline: "none",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
