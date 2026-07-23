import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, FileText, TrendingUp, ShoppingBag, Package, Users, ArrowLeft } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// REPORTS PAGE — real data views
// =============================================================

type ReportKey = "sales" | "purchases" | "stock" | "customers" | "pnl" | "gst" | null;

interface ApiResp<T> { success: boolean; data: T }

const CARDS = [
  { key: "sales"     as ReportKey, icon: TrendingUp,  color: "#F97316", title: "Sale Summary",      desc: "Total sales, returns & net revenue" },
  { key: "purchases" as ReportKey, icon: ShoppingBag, color: "#8B5CF6", title: "Purchase Summary",  desc: "Total purchases & net spend" },
  { key: "stock"     as ReportKey, icon: Package,     color: "#22C55E", title: "Stock Report",       desc: "Current stock levels & valuation" },
  { key: "customers" as ReportKey, icon: Users,       color: "#06B6D4", title: "Customer Report",    desc: "Customer-wise outstanding & sales" },
  { key: "pnl"       as ReportKey, icon: BarChart2,   color: "#EF4444", title: "Profit & Loss",      desc: "Net profit, expenses & GST summary" },
  { key: "gst"       as ReportKey, icon: FileText,    color: "#F59E0B", title: "GST Reports",        desc: "GSTR-1, GSTR-3B and HSN summary" },
];

// ── Individual report components ─────────────────────────────

function SalesSummaryReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-sales-stats"],
    queryFn: () => http.get<ApiResp<{ totalSales: number; totalPurchases: number; totalProfit: number; outstanding: number }>>("/sales/stats"),
    staleTime: 60_000,
  });
  const s = data?.data;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  if (isLoading) return <LoadingState />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
      {[
        { label: "Total Revenue",   value: fmt(s?.totalSales ?? 0),     color: "#F97316" },
        { label: "Total Purchases", value: fmt(s?.totalPurchases ?? 0),  color: "#8B5CF6" },
        { label: "Net Profit",      value: fmt(s?.totalProfit ?? 0),     color: "#22C55E" },
        { label: "Outstanding Due", value: fmt(s?.outstanding ?? 0),     color: "#EF4444" },
      ].map((r) => (
        <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>{r.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: r.color }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function PurchaseSummaryReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-purchase-stats"],
    queryFn: () => http.get<ApiResp<{ data: Array<{ totalAmt: number; taxAmt: number; discountAmt: number }>; total: number }>>("/purchases?page=1&pageSize=1000"),
    staleTime: 60_000,
  });
  if (isLoading) return <LoadingState />;
  const rows = data?.data?.data ?? [];
  const total    = rows.reduce((s, r) => s + r.totalAmt, 0);
  const tax      = rows.reduce((s, r) => s + r.taxAmt, 0);
  const discount = rows.reduce((s, r) => s + r.discountAmt, 0);
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
      {[
        { label: "Total Bills",       value: String(rows.length),  color: "#8B5CF6" },
        { label: "Total Amount",      value: fmt(total),            color: "#0F172A" },
        { label: "Total Tax Paid",    value: fmt(tax),              color: "#F97316" },
        { label: "Total Discount",    value: fmt(discount),         color: "#22C55E" },
        { label: "Avg Bill Value",    value: fmt(rows.length ? total / rows.length : 0), color: "#06B6D4" },
      ].map((r) => (
        <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>{r.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: r.color }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function StockReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory"],
    queryFn: () => http.get<ApiResp<{ items: Array<{ productName: string; productCode: string; currentStock: number; stockValue: number; status: string; unit: string }>; summary: { total: number; inStock: number; lowStock: number; outOfStock: number; totalValue: number } }>>("/inventory"),
    staleTime: 60_000,
  });
  if (isLoading) return <LoadingState />;
  const items   = data?.data?.items ?? [];
  const summary = data?.data?.summary;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Products", value: String(summary?.total ?? 0),      color: "#F97316" },
          { label: "In Stock",       value: String(summary?.inStock ?? 0),    color: "#22C55E" },
          { label: "Low Stock",      value: String(summary?.lowStock ?? 0),   color: "#EAB308" },
          { label: "Stock Value",    value: fmt(summary?.totalValue ?? 0),    color: "#8B5CF6" },
        ].map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            {["Product","Code","Unit","Stock","Value","Status"].map((h) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.slice(0, 50).map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.productName}</td>
                <td style={{ padding: "10px 14px", color: "#64748B" }}><code style={{ background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}>{item.productCode}</code></td>
                <td style={{ padding: "10px 14px", color: "#64748B" }}>{item.unit}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: item.currentStock <= 0 ? "#EF4444" : item.status === "LOW_STOCK" ? "#EAB308" : "#0F172A" }}>{item.currentStock}</td>
                <td style={{ padding: "10px 14px", color: "#475569" }}>₹{item.stockValue.toFixed(2)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px", background: item.status === "IN_STOCK" ? "rgba(34,197,94,0.1)" : item.status === "LOW_STOCK" ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", color: item.status === "IN_STOCK" ? "#16A34A" : item.status === "LOW_STOCK" ? "#A16207" : "#DC2626" }}>{item.status.replace("_"," ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-customers"],
    queryFn: () => http.get<ApiResp<Array<{ id: string; name: string; phone: string | null; balance: number; createdAt: string }>>>("/customers"),
    staleTime: 60_000,
  });
  if (isLoading) return <LoadingState />;
  const customers = (data?.data ?? []).sort((a, b) => b.balance - a.balance);
  const totalOutstanding = customers.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Customers",   value: String(customers.length), color: "#06B6D4" },
          { label: "With Outstanding",  value: String(customers.filter((c) => c.balance > 0).length), color: "#EF4444" },
          { label: "Total Outstanding", value: `₹${totalOutstanding.toFixed(2)}`, color: "#F97316" },
        ].map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            {["Customer","Phone","Balance","Since"].map((h) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {customers.slice(0, 50).map((c, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: "10px 14px", color: "#64748B" }}>{c.phone ?? "—"}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: c.balance > 0 ? "#EF4444" : "#94A3B8" }}>
                  {c.balance !== 0 ? `₹${Math.abs(c.balance).toFixed(2)} ${c.balance > 0 ? "DR" : "CR"}` : "—"}
                </td>
                <td style={{ padding: "10px 14px", color: "#94A3B8", fontSize: 12 }}>
                  {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PnLReport() {
  const stats = useQuery({ queryKey: ["report-pnl-stats"], queryFn: () => http.get<ApiResp<{ totalSales: number; totalPurchases: number; totalProfit: number; outstanding: number }>>("/sales/stats"), staleTime: 60_000 });
  const expenses = useQuery({ queryKey: ["report-pnl-expenses"], queryFn: () => http.get<ApiResp<{ data: Array<{ amount: number; category: string }>; total: number }>>("/expenses?page=1&pageSize=1000"), staleTime: 60_000 });
  if (stats.isLoading || expenses.isLoading) return <LoadingState />;
  const s = stats.data?.data;
  const expRows  = expenses.data?.data?.data ?? [];
  const totalExp = expRows.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = (s?.totalSales ?? 0) - (s?.totalPurchases ?? 0) - totalExp;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const rows = [
    { label: "Total Revenue",       value: fmt(s?.totalSales ?? 0),     color: "#22C55E", positive: true },
    { label: "Cost of Purchases",   value: `(${fmt(s?.totalPurchases ?? 0)})`, color: "#EF4444", positive: false },
    { label: "Total Expenses",      value: `(${fmt(totalExp)})`,        color: "#EF4444", positive: false },
    { label: "Net Profit / (Loss)", value: fmt(Math.abs(netProfit)),    color: netProfit >= 0 ? "#16A34A" : "#EF4444", positive: netProfit >= 0, bold: true },
  ];
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", maxWidth: 480 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none", background: r.bold ? "#F8FAFC" : "#fff" }}>
          <span style={{ fontSize: 13, fontWeight: r.bold ? 700 : 500, color: "#475569" }}>{r.label}</span>
          <span style={{ fontSize: 14, fontWeight: r.bold ? 800 : 600, color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function GstReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-gst"],
    queryFn: () => http.get<ApiResp<{ data: Array<{ cgst: number; sgst: number; totalAmt: number; invoiceDate: string }>; total: number }>>("/sales?page=1&pageSize=1000"),
    staleTime: 60_000,
  });
  if (isLoading) return <LoadingState />;
  const rows = data?.data?.data ?? [];
  const totalCgst = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = rows.reduce((s, r) => s + r.sgst, 0);
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total CGST", value: fmt(totalCgst), color: "#F59E0B" },
          { label: "Total SGST", value: fmt(totalSgst), color: "#F97316" },
          { label: "Total GST",  value: fmt(totalCgst + totalSgst), color: "#EF4444" },
        ].map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#64748B" }}>
        Based on {rows.length} sale invoice{rows.length !== 1 ? "s" : ""}. GSTR-3B export coming soon.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ width: 18, height: 18, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      Loading report data…
    </div>
  );
}

// ── Report content map ───────────────────────────────────────

const REPORT_CONTENT: Record<NonNullable<ReportKey>, React.ReactNode> = {
  sales:     <SalesSummaryReport />,
  purchases: <PurchaseSummaryReport />,
  stock:     <StockReport />,
  customers: <CustomerReport />,
  pnl:       <PnLReport />,
  gst:       <GstReport />,
};

// ── Main page ────────────────────────────────────────────────

export default function ReportsPage() {
  const [active, setActive] = useState<ReportKey>(null);

  // Show detail view when a report is selected
  if (active) {
    const card = CARDS.find((c) => c.key === active)!;
    const Icon = card.icon;
    return (
      <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100%" }}>
        <button
          onClick={() => setActive(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginBottom: 20 }}
        >
          <ArrowLeft size={15} /> Back to Reports
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={20} color={card.color} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{card.title}</div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>{card.desc}</div>
          </div>
        </div>
        {REPORT_CONTENT[active]}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Grid of report cards
  return (
    <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Reports</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 3 }}>Business insights and financial reports</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {CARDS.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              onClick={() => setActive(r.key)}
              style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", outline: "none", display: "flex", flexDirection: "column", gap: 10, transition: "box-shadow 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = r.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${r.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={22} color={r.color} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{r.desc}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginTop: 4 }}>View Report →</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
