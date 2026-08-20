import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, FileText, TrendingUp, ShoppingBag, Package, Users,
  ArrowLeft, Download, Printer, ArrowUpRight, ArrowDownRight, Inbox, FileSpreadsheet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { http } from "@/lib/axios";

// =============================================================
// REPORTS PAGE — date-filtered real data views
// =============================================================

type ReportKey = "sales" | "purchases" | "stock" | "customers" | "pnl" | "gst" | null;
type DateFilter = "all" | "today" | "week" | "month" | "custom";

interface ApiResp<T> { success: boolean; data: T }
interface DateRange { start: string; end: string }
interface Customer {
  name: string;
  phone?: string;
  balance: number;
  createdAt: string;
}

const CARDS = [
  { key: "sales"     as ReportKey, icon: TrendingUp,  color: "#F97316", title: "Sale Summary",     desc: "Total sales, returns & net revenue" },
  { key: "purchases" as ReportKey, icon: ShoppingBag, color: "#8B5CF6", title: "Purchase Summary", desc: "Total purchases & net spend" },
  { key: "stock"     as ReportKey, icon: Package,     color: "#22C55E", title: "Stock Report",      desc: "Current stock levels & valuation" },
  { key: "customers" as ReportKey, icon: Users,       color: "#06B6D4", title: "Customer Report",   desc: "Customer-wise outstanding & sales" },
  { key: "pnl"       as ReportKey, icon: BarChart2,   color: "#EF4444", title: "Profit & Loss",     desc: "Net profit, expenses & GST summary" },
  { key: "gst"       as ReportKey, icon: FileText,    color: "#F59E0B", title: "GST Reports",       desc: "GSTR-1, GSTR-3B and HSN summary" },
];

// All first, then date presets, custom last
const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all",    label: "All" },
  { key: "today",  label: "Today" },
  { key: "week",   label: "This Week" },
  { key: "month",  label: "This Month" },
  { key: "custom", label: "Custom" },
];

// ── Helpers ───────────────────────────────────────────────────
function toStr(d: Date) { return d.toISOString().slice(0, 10); }

function getPreset(f: DateFilter): DateRange {
  const now   = new Date();
  const today = toStr(now);
  if (f === "today") return { start: today, end: today };
  if (f === "week") {
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    return { start: toStr(mon), end: today };
  }
  if (f === "month") {
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      end: today,
    };
  }
  return { start: "", end: "" };
}

// Immediately-preceding period of the same length — used for trend/comparison badges
function getPrevRange(dr: DateRange): DateRange {
  if (!dr.start || !dr.end) return { start: "", end: "" };
  const start = new Date(dr.start);
  const end   = new Date(dr.end);
  const days  = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return { start: toStr(prevStart), end: toStr(prevEnd) };
}

// Returns query params object — undefined when no date filter (avoids appending "?" to URL)
function dp(dr: DateRange): Record<string, string | number | boolean> | undefined {
  return dr.start && dr.end ? { startDate: dr.start, endDate: dr.end } : undefined;
}

function periodLabel(dr: DateRange): string {
  if (!dr.start || !dr.end) return "All time";
  const f = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${f(dr.start)} – ${f(dr.end)}`;
}

// ── Real Excel (.xlsx) export via SheetJS ───────────────────────
function exportExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Auto column widths based on header/content length
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // sheet name max 31 chars
  XLSX.writeFile(wb, filename);
}

// ── Real branded PDF export via jsPDF + autoTable ───────────────
function exportPDF(opts: {
  filename: string; title: string; subtitle: string;
  headers: string[]; rows: (string | number)[][];
}) {
  const { filename, title, subtitle, headers, rows } = opts;
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Orizo Bills", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text(title, 14, 25);
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(subtitle, 14, 31);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, doc.internal.pageSize.width - 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    theme: "striped",
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // Footer — page numbers + generated timestamp on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated ${new Date().toLocaleDateString("en-IN")} · Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10,
    );
  }

  doc.save(filename);
}

// ── Export button (Excel .xlsx + PDF + Print) ────────────────────
function ExportButton({
  onExportExcel, onExportPDF, disabled,
}: {
  onExportExcel: () => void; onExportPDF: () => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12.5,
          fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
          background: "#fff", color: disabled ? "#CBD5E1" : "#475569",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <Download size={14} /> Export
      </button>
      {open && !disabled && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20,
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)", minWidth: 190, overflow: "hidden",
          }}>
            <button onClick={() => { onExportExcel(); setOpen(false); }} style={menuItemStyle}>
              <FileSpreadsheet size={14} color="#22C55E" /> Download Excel (.xlsx)
            </button>
            <button onClick={() => { onExportPDF(); setOpen(false); }} style={{ ...menuItemStyle, borderTop: "1px solid #F1F5F9" }}>
              <FileText size={14} color="#F97316" /> Download PDF
            </button>
            <button onClick={() => { setOpen(false); window.print(); }} style={{ ...menuItemStyle, borderTop: "1px solid #F1F5F9" }}>
              <Printer size={14} color="#64748B" /> Print
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
  padding: "10px 14px", fontSize: 13, fontWeight: 500, color: "#334155",
  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
};

// ── Empty state ──────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "48px 20px", color: "#94A3B8",
    }}>
      <Inbox size={28} strokeWidth={1.5} />
      <div style={{ fontSize: 13, fontWeight: 500 }}>{text}</div>
    </div>
  );
}

// ── Trend badge (week-over-week / period-over-period) ─────────
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null; // avoid infinite % when no baseline
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 3, marginTop: 6,
      fontSize: 11.5, fontWeight: 700, color: up ? "#16A34A" : "#DC2626",
    }}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct).toFixed(1)}% vs previous period
    </div>
  );
}

// ── Skeleton loaders ─────────────────────────────────────────
function SkeletonCards({ count, cols }: { count: number; cols: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
          <div className="rpt-skeleton" style={{ width: "55%", height: 11, borderRadius: 4, marginBottom: 12 }} />
          <div className="rpt-skeleton" style={{ width: "75%", height: 22, borderRadius: 5 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 16, padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="rpt-skeleton" style={{ flex: 1, height: 10, borderRadius: 4 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 16, padding: "14px", borderBottom: r < rows - 1 ? "1px solid #F1F5F9" : "none" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="rpt-skeleton" style={{ flex: 1, height: 12, borderRadius: 4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", maxWidth: 480 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < rows - 1 ? "1px solid #F1F5F9" : "none" }}>
          <div className="rpt-skeleton" style={{ width: "45%", height: 12, borderRadius: 4 }} />
          <div className="rpt-skeleton" style={{ width: "20%", height: 12, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

// ── Date filter bar ───────────────────────────────────────────
function DateFilterBar({
  value, onChange, fromDate, toDate, onFromDate, onToDate,
}: {
  value: DateFilter; onChange: (v: DateFilter) => void;
  fromDate: string; toDate: string;
  onFromDate: (v: string) => void; onToDate: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff",
        border: "1px solid #E2E8F0", borderRadius: 10, padding: 4, flexShrink: 0 }}>
        {DATE_FILTERS.map((f) => {
          const active = value === f.key;
          return (
            <button key={f.key} onClick={() => onChange(f.key)}
              style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                fontWeight: 600, padding: "7px 14px", borderRadius: 7, whiteSpace: "nowrap",
                background: active ? "#F97316" : "transparent",
                color: active ? "#fff" : "#64748B",
                transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              {f.label}
            </button>
          );
        })}
      </div>
      {value === "custom" && (
        <>
          <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500, whiteSpace: "nowrap" }}>From</span>
            <input type="date" value={fromDate} onChange={(e) => onFromDate(e.target.value)} style={dateInp} />
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>To</span>
            <input type="date" value={toDate} onChange={(e) => onToDate(e.target.value)} style={dateInp} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Sale Summary ──────────────────────────────────────────────
function SalesSummaryReport({ dateRange, prevDateRange, isAllTime }: { dateRange: DateRange; prevDateRange: DateRange; isAllTime: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-sales-stats", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ totalSales: number; totalPurchases: number; totalProfit: number; outstanding: number }>>(
      "/sales/stats", { params: dp(dateRange) },
    ),
    staleTime: 30_000,
  });
  const prev = useQuery({
    queryKey: ["report-sales-stats-prev", prevDateRange.start, prevDateRange.end],
    queryFn: () => http.get<ApiResp<{ totalSales: number; totalPurchases: number; totalProfit: number; outstanding: number }>>(
      "/sales/stats", { params: dp(prevDateRange) },
    ),
    enabled: !isAllTime && !!prevDateRange.start,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonCards count={4} cols={2} />
      </div>
    );
  }

  const s   = data?.data;
  const p   = prev.data?.data;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const noData = !isAllTime && (s?.totalSales ?? 0) === 0 && (s?.totalPurchases ?? 0) === 0 && (s?.totalProfit ?? 0) === 0;

  const headers = ["Metric", "Value"];
  const dataRows: (string | number)[][] = [
    ["Total Revenue", s?.totalSales ?? 0],
    ["Total Purchases", s?.totalPurchases ?? 0],
    ["Net Profit", s?.totalProfit ?? 0],
    ["Outstanding Due", s?.outstanding ?? 0],
  ];

  const handleExportExcel = () => exportExcel("sale-summary.xlsx", "Sale Summary", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "sale-summary.pdf", title: "Sale Summary",
    subtitle: `Total sales, returns & net revenue · ${periodLabel(dateRange)}`,
    headers, rows: dataRows,
  });

  const rows: { label: string; value: number; formatted: string; color: string; trend?: boolean }[] = [
    { label: "Total Revenue",   value: s?.totalSales ?? 0,    formatted: fmt(s?.totalSales ?? 0),    color: "#F97316", trend: true },
    { label: "Total Purchases", value: s?.totalPurchases ?? 0, formatted: fmt(s?.totalPurchases ?? 0), color: "#8B5CF6" },
    { label: "Net Profit",      value: s?.totalProfit ?? 0,    formatted: fmt(s?.totalProfit ?? 0),    color: "#22C55E", trend: true },
    { label: "Outstanding Due", value: s?.outstanding ?? 0,    formatted: fmt(s?.outstanding ?? 0),    color: "#EF4444" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={!s} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>{r.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: r.color }}>{r.formatted}</div>
            {r.trend && p && <TrendBadge current={r.value} previous={r.label === "Total Revenue" ? p.totalSales : p.totalProfit} />}
          </div>
        ))}
      </div>
      {noData && <EmptyState text="No sales recorded in this period." />}
    </div>
  );
}

// ── Purchase Summary ──────────────────────────────────────────
function PurchaseSummaryReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-purchase-stats", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: Array<{ totalAmt: number; taxAmt: number; discountAmt: number }>; total: number }>>(
      "/purchases", { params: { page: 1, pageSize: 10000, ...dp(dateRange) } },
    ),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonCards count={5} cols={3} />
      </div>
    );
  }

  const rows     = data?.data?.data ?? [];
  const total    = rows.reduce((s, r) => s + r.totalAmt, 0);
  const tax      = rows.reduce((s, r) => s + r.taxAmt, 0);
  const discount = rows.reduce((s, r) => s + r.discountAmt, 0);
  const avg      = rows.length ? total / rows.length : 0;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const headers = ["Metric", "Value"];
  const dataRows: (string | number)[][] = [
    ["Total Bills", rows.length],
    ["Total Amount", total],
    ["Total Tax Paid", tax],
    ["Total Discount", discount],
    ["Avg Bill Value", avg],
  ];

  const handleExportExcel = () => exportExcel("purchase-summary.xlsx", "Purchase Summary", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "purchase-summary.pdf", title: "Purchase Summary",
    subtitle: `Total purchases & net spend · ${periodLabel(dateRange)}`,
    headers, rows: dataRows,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={rows.length === 0} />
      </div>
      {rows.length === 0 ? (
        <EmptyState text="No purchases recorded in this period." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { label: "Total Bills",    value: String(rows.length), color: "#8B5CF6" },
            { label: "Total Amount",   value: fmt(total),          color: "#0F172A" },
            { label: "Total Tax Paid", value: fmt(tax),            color: "#F97316" },
            { label: "Total Discount", value: fmt(discount),       color: "#22C55E" },
            { label: "Avg Bill Value", value: fmt(avg),            color: "#06B6D4" },
          ].map((r) => (
            <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>{r.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: r.color }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stock Report (point-in-time, no date filter) ──────────────
function StockReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory"],
    queryFn: () => http.get<ApiResp<{
      items: Array<{ productName: string; productCode: string; currentStock: number; stockValue: number; status: string; unit: string }>;
      summary: { total: number; inStock: number; lowStock: number; outOfStock: number; totalValue: number };
    }>>("/inventory"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}><SkeletonCards count={4} cols={4} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  const items   = data?.data?.items   ?? [];
  const summary = data?.data?.summary;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const headers = ["Product", "Code", "Unit", "Stock", "Value", "Status"];
  const dataRows: (string | number)[][] = items.map((item) => [
    item.productName, item.productCode, item.unit, item.currentStock, item.stockValue.toFixed(2), item.status.replace("_", " "),
  ]);

  const handleExportExcel = () => exportExcel("stock-report.xlsx", "Stock Report", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "stock-report.pdf", title: "Stock Report",
    subtitle: `Current stock levels & valuation · as of ${new Date().toLocaleDateString("en-IN")}`,
    headers, rows: dataRows,
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Products", value: String(summary?.total    ?? 0), color: "#F97316" },
          { label: "In Stock",       value: String(summary?.inStock  ?? 0), color: "#22C55E" },
          { label: "Low Stock",      value: String(summary?.lowStock ?? 0), color: "#EAB308" },
          { label: "Stock Value",    value: fmt(summary?.totalValue  ?? 0), color: "#8B5CF6" },
        ].map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={items.length === 0} />
      </div>
      {items.length === 0 ? (
        <EmptyState text="No products found in inventory." />
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {headers.map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.slice(0, 50).map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.productName}</td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}>
                    <code style={{ background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}>{item.productCode}</code>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748B" }}>{item.unit}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: item.currentStock <= 0 ? "#EF4444" : item.status === "LOW_STOCK" ? "#EAB308" : "#0F172A" }}>{item.currentStock}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>₹{item.stockValue.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px",
                      background: item.status === "IN_STOCK" ? "rgba(34,197,94,0.1)" : item.status === "LOW_STOCK" ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)",
                      color:      item.status === "IN_STOCK" ? "#16A34A"             : item.status === "LOW_STOCK" ? "#A16207"              : "#DC2626" }}>
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customer Report (point-in-time, no date filter) ───────────
function CustomerReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-customers"],
    queryFn: () => http.get<ApiResp<Customer[] | { data: Customer[]; total: number }>>("/customers"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}><SkeletonCards count={3} cols={3} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonTable rows={8} cols={4} />
      </div>
    );
  }

  const raw = data?.data;
  const customers = (Array.isArray(raw) ? raw : raw?.data ?? []).slice().sort((a, b) => b.balance - a.balance);
  const totalOutstanding = customers.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0);

  const headers = ["Customer", "Phone", "Balance", "Type", "Since"];
  const dataRows: (string | number)[][] = customers.map((c) => [
    c.name, c.phone ?? "", Math.abs(c.balance).toFixed(2), c.balance > 0 ? "DR" : c.balance < 0 ? "CR" : "",
    new Date(c.createdAt).toLocaleDateString("en-IN"),
  ]);

  const handleExportExcel = () => exportExcel("customer-report.xlsx", "Customer Report", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "customer-report.pdf", title: "Customer Report",
    subtitle: `Customer-wise outstanding & sales · as of ${new Date().toLocaleDateString("en-IN")}`,
    headers, rows: dataRows,
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Customers",   value: String(customers.length),                              color: "#06B6D4" },
          { label: "With Outstanding",  value: String(customers.filter((c) => c.balance > 0).length), color: "#EF4444" },
          { label: "Total Outstanding", value: `₹${totalOutstanding.toFixed(2)}`,                      color: "#F97316" },
        ].map((r) => (
          <div key={r.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={customers.length === 0} />
      </div>
      {customers.length === 0 ? (
        <EmptyState text="No customers found." />
      ) : (
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
      )}
    </div>
  );
}

// ── P&L Report ────────────────────────────────────────────────
function PnLReport({ dateRange }: { dateRange: DateRange }) {
  const stats = useQuery({
    queryKey: ["report-pnl-stats", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ totalSales: number; totalPurchases: number; totalProfit: number; outstanding: number }>>(
      "/sales/stats", { params: dp(dateRange) },
    ),
    staleTime: 30_000,
  });
  const expenses = useQuery({
    queryKey: ["report-pnl-expenses", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: Array<{ amount: number; category: string }>; total: number }>>(
      "/expenses", { params: { page: 1, pageSize: 10000, ...dp(dateRange) } },
    ),
    staleTime: 30_000,
  });

  if (stats.isLoading || expenses.isLoading) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  const s         = stats.data?.data;
  const expRows   = expenses.data?.data?.data ?? [];
  const totalExp  = expRows.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = (s?.totalSales ?? 0) - (s?.totalPurchases ?? 0) - totalExp;
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const rows = [
    { label: "Total Revenue",       value: fmt(s?.totalSales ?? 0),            color: "#22C55E", bold: false },
    { label: "Cost of Purchases",   value: `(${fmt(s?.totalPurchases ?? 0)})`, color: "#EF4444", bold: false },
    { label: "Total Expenses",      value: `(${fmt(totalExp)})`,               color: "#EF4444", bold: false },
    { label: "Net Profit / (Loss)", value: fmt(Math.abs(netProfit)),           color: netProfit >= 0 ? "#16A34A" : "#EF4444", bold: true },
  ];

  const headers = ["Line Item", "Amount"];
  const dataRows: (string | number)[][] = [
    ["Total Revenue", s?.totalSales ?? 0],
    ["Cost of Purchases", -(s?.totalPurchases ?? 0)],
    ["Total Expenses", -totalExp],
    ["Net Profit / (Loss)", netProfit],
  ];

  const handleExportExcel = () => exportExcel("profit-and-loss.xlsx", "Profit & Loss", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "profit-and-loss.pdf", title: "Profit & Loss",
    subtitle: `Net profit, expenses & GST summary · ${periodLabel(dateRange)}`,
    headers, rows: dataRows,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={!s} />
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", maxWidth: 480 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px",
            borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
            background: r.bold ? "#F8FAFC" : "#fff" }}>
            <span style={{ fontSize: 13, fontWeight: r.bold ? 700 : 500, color: "#475569" }}>{r.label}</span>
            <span style={{ fontSize: 14, fontWeight: r.bold ? 800 : 600, color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GST Report ────────────────────────────────────────────────
function GstReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-gst", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: Array<{ cgst: number; sgst: number; totalAmt: number; invoiceDate: string }>; total: number }>>(
      "/sales", { params: { page: 1, pageSize: 10000, ...dp(dateRange) } },
    ),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <div className="rpt-skeleton" style={{ width: 90, height: 32, borderRadius: 8 }} />
        </div>
        <SkeletonCards count={3} cols={3} />
      </div>
    );
  }

  const rows      = data?.data?.data ?? [];
  const totalCgst = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = rows.reduce((s, r) => s + r.sgst, 0);
  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const headers = ["Invoice Date", "CGST", "SGST", "Total Amount"];
  const dataRows: (string | number)[][] = rows.map((r) => [
    new Date(r.invoiceDate).toLocaleDateString("en-IN"), r.cgst.toFixed(2), r.sgst.toFixed(2), r.totalAmt.toFixed(2),
  ]);

  const handleExportExcel = () => exportExcel("gst-report.xlsx", "GST Report", headers, dataRows);
  const handleExportPDF = () => exportPDF({
    filename: "gst-report.pdf", title: "GST Report",
    subtitle: `GSTR-1, GSTR-3B and HSN summary · ${periodLabel(dateRange)}`,
    headers, rows: dataRows,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ExportButton onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} disabled={rows.length === 0} />
      </div>
      {rows.length === 0 ? (
        <EmptyState text="No GST invoices found in this period." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total CGST", value: fmt(totalCgst),             color: "#F59E0B" },
              { label: "Total SGST", value: fmt(totalSgst),             color: "#F97316" },
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
        </>
      )}
    </div>
  );
}

// ── Route to correct report component ────────────────────────
function ReportContent({ reportKey, dateRange, prevDateRange, isAllTime }: {
  reportKey: NonNullable<ReportKey>; dateRange: DateRange; prevDateRange: DateRange; isAllTime: boolean;
}) {
  switch (reportKey) {
    case "sales":     return <SalesSummaryReport dateRange={dateRange} prevDateRange={prevDateRange} isAllTime={isAllTime} />;
    case "purchases": return <PurchaseSummaryReport dateRange={dateRange} />;
    case "stock":     return <StockReport />;
    case "customers": return <CustomerReport />;
    case "pnl":       return <PnLReport dateRange={dateRange} />;
    case "gst":       return <GstReport dateRange={dateRange} />;
  }
}

// ── Main page ─────────────────────────────────────────────────
export default function ReportsPage() {
  const today = toStr(new Date());
  const [active,     setActive]     = useState<ReportKey>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [fromDate,   setFromDate]   = useState(today);
  const [toDate,     setToDate]     = useState(today);

  const dateRange = useMemo<DateRange>(() => {
    if (dateFilter === "all")    return { start: "", end: "" };
    if (dateFilter === "custom") return { start: fromDate, end: toDate };
    return getPreset(dateFilter);
  }, [dateFilter, fromDate, toDate]);

  const prevDateRange = useMemo<DateRange>(() => getPrevRange(dateRange), [dateRange]);

  // ── Detail view ───────────────────────────────────────────
  if (active) {
    const card = CARDS.find((c) => c.key === active)!;
    const Icon = card.icon;
    return (
      <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100%" }}>
        <button onClick={() => setActive(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            cursor: "pointer", color: "#64748B", fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", marginBottom: 20 }}>
          <ArrowLeft size={15} /> Back to Reports
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{card.title}</div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>
                {card.desc} · {periodLabel(dateRange)}
              </div>
            </div>
          </div>

          <DateFilterBar
            value={dateFilter}
            onChange={setDateFilter}
            fromDate={fromDate}
            toDate={toDate}
            onFromDate={setFromDate}
            onToDate={setToDate}
          />
        </div>

        <ReportContent
          reportKey={active}
          dateRange={dateRange}
          prevDateRange={prevDateRange}
          isAllTime={dateFilter === "all"}
        />
        <style>{`
          .rpt-skeleton {
            background: linear-gradient(90deg, #E2E8F0 25%, #EEF2F6 37%, #E2E8F0 63%);
            background-size: 400% 100%;
            animation: rpt-shimmer 1.4s ease infinite;
          }
          @keyframes rpt-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
          @media print {
            nav, aside, button { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  // ── Report card grid ──────────────────────────────────────
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
            <button key={r.key} onClick={() => setActive(r.key)}
              style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px",
                textAlign: "left", cursor: "pointer", fontFamily: "inherit", outline: "none",
                display: "flex", flexDirection: "column", gap: 10,
                transition: "box-shadow 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = r.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${r.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
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

// ── Styles ────────────────────────────────────────────────────
const dateInp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px",
  fontSize: 13, color: "#1E293B", background: "#fff",
  outline: "none", fontFamily: "inherit", cursor: "pointer",
};