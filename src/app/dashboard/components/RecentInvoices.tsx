import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/axios";

// =============================================================
// RecentInvoices — last 5 sale invoices from the backend
// =============================================================

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  totalAmt: number;
  status: string;
  paymentMethod: string;
}

interface ApiResp { success: boolean; data: { data: SaleInvoice[]; total: number } }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PAID:      { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  PARTIAL:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  UNPAID:    { bg: "rgba(239,68,68,0.1)",    color: "#DC2626" },
  DRAFT:     { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

const COLS = ["Invoice No.", "Customer", "Date", "Amount", "Status", "Payment"];

function SkeletonRow() {
  const widths = [72, 80, 58, 52, 60, 48];
  return (
    <tr style={{ borderBottom: "1px solid #F8FAFC" }}>
      {widths.map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div style={{ height: 11, borderRadius: 6, background: "#F1F5F9", width: `${w}%`, animation: "pulse 1.8s ease-in-out infinite" }} />
        </td>
      ))}
    </tr>
  );
}

export function RecentInvoices() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["recent-invoices"],
    queryFn: () => http.get<ApiResp>("/sales?page=1&pageSize=5"),
    staleTime: 30_000,
  });

  const invoices = data?.data?.data ?? [];

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Recent Invoices</span>
        {!isLoading && invoices.length > 0 && (
          <span style={{ fontSize: 12, color: "#94A3B8" }}>Latest {invoices.length} sale{invoices.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
              {COLS.map((col) => (
                <th key={col} style={{ padding: "0 16px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && [0,1,2,3,4].map((i) => <SkeletonRow key={i} />)}

            {!isLoading && invoices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  No invoices yet — create one from the POS or Sales section.
                </td>
              </tr>
            )}

            {!isLoading && invoices.map((inv, idx) => {
              const sc = STATUS_STYLE[inv.status] ?? STATUS_STYLE.DRAFT;
              return (
                <tr
                  key={inv.id}
                  style={{ borderBottom: idx < invoices.length - 1 ? "1px solid #F8FAFC" : "none", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  onClick={() => navigate("/app/sales/invoices")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <code style={{ fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" }}>{inv.invoiceNumber}</code>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{inv.customerName}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748B" }}>
                    {new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                    ₹{inv.totalAmt.toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", background: sc.bg, color: sc.color }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748B" }}>{inv.paymentMethod}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #F1F5F9", textAlign: "center" }}>
        <button
          onClick={() => navigate("/app/sales/invoices")}
          style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#F97316", cursor: "pointer", fontFamily: "inherit" }}
        >
          View All Invoices →
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>
    </div>
  );
}
