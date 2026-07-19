import { BarChart2, FileText, TrendingUp, ShoppingBag, Package, Users } from "lucide-react";

const REPORT_CARDS = [
  { icon: <TrendingUp size={22} color="#F97316" />, title: "Sale Summary",      desc: "Total sales, returns & net revenue by period",        to: "/app/reports/sales",    color: "#F97316" },
  { icon: <ShoppingBag size={22} color="#8B5CF6" />, title: "Purchase Summary", desc: "Total purchases, returns & net spend by period",      to: "/app/reports/purchases", color: "#8B5CF6" },
  { icon: <Package size={22} color="#22C55E" />,  title: "Stock Report",        desc: "Current stock levels, low stock & valuation",         to: "/app/reports/stock",    color: "#22C55E" },
  { icon: <Users size={22} color="#06B6D4" />,    title: "Customer Report",     desc: "Customer-wise outstanding & sales history",           to: "/app/reports/customers", color: "#06B6D4" },
  { icon: <BarChart2 size={22} color="#EF4444" />, title: "Profit & Loss",      desc: "Net profit, expenses and GST summary",                to: "/app/reports/pnl",      color: "#EF4444" },
  { icon: <FileText size={22} color="#F59E0B" />, title: "GST Reports",         desc: "GSTR-1, GSTR-3B and HSN summary",                     to: "/app/reports/gst",      color: "#F59E0B" },
];

export default function ReportsPage() {
  return (
    <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Reports</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 3 }}>
          Business insights and financial reports
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {REPORT_CARDS.map((r) => (
          <button
            key={r.title}
            style={{
              background: "#fff", border: "1px solid #E2E8F0",
              borderRadius: 12, padding: "20px 20px",
              textAlign: "left", cursor: "pointer",
              fontFamily: "inherit", outline: "none",
              display: "flex", flexDirection: "column", gap: 10,
              transition: "box-shadow 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = r.color;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: `${r.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {r.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{r.desc}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginTop: 4 }}>
              View Report →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
