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

const ORANGE = {
  base:   "#F97316",
  dark:   "#EA580C",
  darker: "#C2410C",
  light:  "#FB923C",
  pale:   "#FDBA74",
  amber:  "#D97706",
};

const CARDS = [
  { key: "sales"     as ReportKey, icon: TrendingUp,  color: ORANGE.base,   title: "Sale Summary",     desc: "Total sales, returns & net revenue" },
  { key: "purchases" as ReportKey, icon: ShoppingBag, color: ORANGE.dark,   title: "Purchase Summary", desc: "Total purchases & net spend" },
  { key: "stock"     as ReportKey, icon: Package,     color: ORANGE.light,  title: "Stock Report",      desc: "Current stock levels & valuation" },
  { key: "customers" as ReportKey, icon: Users,       color: ORANGE.darker, title: "Customer Report",   desc: "Customer-wise outstanding & sales" },
  { key: "pnl"       as ReportKey, icon: BarChart2,   color: ORANGE.amber,  title: "Profit & Loss",     desc: "Net profit, expenses & GST summary" },
  { key: "gst"       as ReportKey, icon: FileText,    color: ORANGE.pale,   title: "GST Reports",       desc: "GSTR-1, GSTR-3B and HSN summary" },
];

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all",    label: "All" },
  { key: "today",  label: "Today" },
  { key: "week",   label: "This Week" },
  { key: "month",  label: "This Month" },
  { key: "custom", label: "Custom" },
];

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

function dp(dr: DateRange): Record<string, string | number | boolean> | undefined {
  return dr.start && dr.end ? { startDate: dr.start, endDate: dr.end } : undefined;
}

function periodLabel(dr: DateRange): string {
  if (!dr.start || !dr.end) return "All time";
  const f = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${f(dr.start)} – ${f(dr.end)}`;
}

function exportExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  extraSheets?: { sheetName: string; headers: string[]; rows: (string | number)[][] }[],
) {
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, hdrs: string[], rws: (string | number)[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rws]);
    ws["!cols"] = hdrs.map((h, i) => {
      const maxLen = Math.max(h.length, ...rws.map((r) => String(r[i] ?? "").length));
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  addSheet(sheetName, headers, rows);
  extraSheets?.forEach((s) => addSheet(s.sheetName, s.headers, s.rows));
  XLSX.writeFile(wb, filename);
}

// ── Rich PDF builder ──────────────────────────────────────────
// Generates a professional multi-section PDF:
//   Page 1 — cover: report title, period, generated date, summary key-values
//   Pages 2+ — detail tables (one per section)
interface PdfSection {
  heading: string;
  subheading?: string;
  headers: string[];
  rows: (string | number)[][];
  /** Column alignments: "left" | "right" | "center" — defaults all "left" */
  alignments?: ("left" | "right" | "center")[];
  /** Totals row appended after the last data row */
  totalsRow?: (string | number)[];
}

interface PdfSummaryItem { label: string; value: string }

function buildPDF(opts: {
  filename:    string;
  reportTitle: string;
  reportDesc:  string;
  period:      string;
  generatedBy: string;
  summary:     PdfSummaryItem[];
  sections:    PdfSection[];
}) {
  const { filename, reportTitle, reportDesc, period, generatedBy, summary, sections } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.width;   // 297mm landscape
  const H   = doc.internal.pageSize.height;  // 210mm

  const ORANGE_RGB: [number, number, number] = [249, 115, 22];
  const DARK_RGB:   [number, number, number] = [15,  23,  42];
  const MID_RGB:    [number, number, number] = [51,  65,  85];
  const MUTED_RGB:  [number, number, number] = [148, 163, 184];

  // ── COVER PAGE ─────────────────────────────────────────────

  // Orange accent bar on left
  doc.setFillColor(...ORANGE_RGB);
  doc.rect(0, 0, 6, H, "F");

  // Business name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DARK_RGB);
  doc.text("ORIZO BILLS", 16, 22);

  // Divider
  doc.setDrawColor(...ORANGE_RGB);
  doc.setLineWidth(0.6);
  doc.line(16, 26, W - 14, 26);

  // Report title block
  doc.setFontSize(28);
  doc.setTextColor(...ORANGE_RGB);
  doc.setFont("helvetica", "bold");
  doc.text(reportTitle.toUpperCase(), 16, 46);

  doc.setFontSize(13);
  doc.setTextColor(...MID_RGB);
  doc.setFont("helvetica", "normal");
  doc.text(reportDesc, 16, 55);

  // Period badge
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(...ORANGE_RGB);
  doc.setLineWidth(0.4);
  doc.roundedRect(16, 60, Math.min(doc.getTextWidth(`  Period: ${period}  `) + 8, W - 30), 9, 2, 2, "FD");
  doc.setFontSize(10);
  doc.setTextColor(...ORANGE_RGB);
  doc.setFont("helvetica", "bold");
  doc.text(`Period: ${period}`, 20, 66.5);

  // Generated info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_RGB);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`, 16, 76);
  doc.text(`By: ${generatedBy}`, 16, 82);

  // Summary key-value cards
  if (summary.length > 0) {
    const cardW    = (W - 32 - (summary.length - 1) * 6) / Math.min(summary.length, 5);
    const cardMaxW = Math.min(cardW, 52);
    let cx = 16;
    const cy = 95;

    summary.slice(0, 6).forEach((item) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, cy, cardMaxW, 22, 2, 2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_RGB);
      doc.text(item.label.toUpperCase(), cx + 3, cy + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...DARK_RGB);
      // Truncate long values
      const val = String(item.value);
      const maxChars = Math.floor(cardMaxW / 3.2);
      doc.text(val.length > maxChars ? val.slice(0, maxChars - 1) + "…" : val, cx + 3, cy + 15);
      cx += cardMaxW + 5;
    });
  }

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text("This report was generated automatically by Orizo Bills. All amounts are in INR (₹).", 16, H - 12);

  // ── DETAIL SECTIONS ────────────────────────────────────────
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    doc.addPage();

    // Section heading bar
    doc.setFillColor(...ORANGE_RGB);
    doc.rect(0, 0, 6, H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...DARK_RGB);
    doc.text(section.heading, 14, 14);
    if (section.subheading) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED_RGB);
      doc.text(section.subheading, 14, 20);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED_RGB);
    const cnt = `${section.rows.length} record${section.rows.length !== 1 ? "s" : ""}`;
    doc.text(cnt, W - 14 - doc.getTextWidth(cnt), 14);

    // Build column styles
    const colStyles: Record<number, { halign: "left" | "right" | "center" }> = {};
    section.headers.forEach((_, i) => {
      colStyles[i] = { halign: section.alignments?.[i] ?? "left" };
    });

    // Body rows + optional totals row
    const bodyRows = section.rows.map((r) => r.map(String));
    if (section.totalsRow) {
      bodyRows.push(section.totalsRow.map(String));
    }

    autoTable(doc, {
      startY:      section.subheading ? 26 : 22,
      head:        [section.headers],
      body:        bodyRows,
      theme:       "grid",
      styles:      { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, overflow: "linebreak" },
      headStyles:  { fillColor: ORANGE_RGB, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      bodyStyles:  { textColor: MID_RGB },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Bold + shaded totals row
      willDrawCell: (data) => {
        if (section.totalsRow && data.row.index === bodyRows.length - 1 && data.section === "body") {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = DARK_RGB;
        }
      },
      columnStyles: colStyles,
      margin: { left: 14, right: 14 },
    });
  }

  // ── PAGE FOOTERS ───────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "normal");
    const footer = `Orizo Bills  ·  ${reportTitle}  ·  ${period}  ·  Page ${i} of ${pageCount}`;
    doc.text(footer, 14, H - 6);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, H - 9, W - 14, H - 9);
  }

  doc.save(filename);
}

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
              <FileSpreadsheet size={14} color={ORANGE.base} /> Download Excel (.xlsx)
            </button>
            <button onClick={() => { onExportPDF(); setOpen(false); }} style={{ ...menuItemStyle, borderTop: "1px solid #F1F5F9" }}>
              <FileText size={14} color={ORANGE.dark} /> Download PDF
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

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 3, marginTop: 6,
      fontSize: 11.5, fontWeight: 700, color: up ? ORANGE.base : ORANGE.darker,
    }}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct).toFixed(1)}% vs previous period
    </div>
  );
}

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
                background: active ? ORANGE.base : "transparent",
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

interface SaleInvoiceRow {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  paymentMethod: string;
  subtotal: number;
  discountAmt: number;
  cgst: number;
  sgst: number;
  totalAmt: number;
  paidAmt: number;
  balanceDue: number;
  status: string;
  itemCount: number;
}

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

  const invoices = useQuery({
    queryKey: ["report-sales-invoices", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: SaleInvoiceRow[]; total: number }>>(
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

  const invoiceRows = invoices.data?.data?.data ?? [];
  const billHeaders = [
    "Invoice No", "Date", "Customer", "Payment", "Items",
    "Subtotal", "Discount", "CGST", "SGST", "Total", "Paid", "Balance Due", "Status",
  ];
  const billDataRows: (string | number)[][] = invoiceRows.map((inv) => [
    inv.invoiceNumber,
    inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-IN") : "",
    inv.customerName,
    inv.paymentMethod,
    inv.itemCount,
    Number(inv.subtotal ?? 0).toFixed(2),
    Number(inv.discountAmt ?? 0).toFixed(2),
    Number(inv.cgst ?? 0).toFixed(2),
    Number(inv.sgst ?? 0).toFixed(2),
    Number(inv.totalAmt ?? 0).toFixed(2),
    Number(inv.paidAmt ?? 0).toFixed(2),
    Number(inv.balanceDue ?? 0).toFixed(2),
    inv.status,
  ]);

  const handleExportExcel = () => exportExcel(
    "sale-summary.xlsx", "Sale Summary", headers, dataRows,
    billDataRows.length > 0
      ? [{ sheetName: "Bill Details", headers: billHeaders, rows: billDataRows }]
      : undefined,
  );
  const handleExportPDF = () => buildPDF({
    filename:    "sale-summary.pdf",
    reportTitle: "Sale Summary Report",
    reportDesc:  "Total sales, invoices, tax collected and outstanding dues",
    period:      periodLabel(dateRange),
    generatedBy: "Orizo Bills",
    summary: [
      { label: "Total Revenue",   value: `₹${Math.round(s?.totalSales    ?? 0).toLocaleString("en-IN")}` },
      { label: "Total Purchases", value: `₹${Math.round(s?.totalPurchases ?? 0).toLocaleString("en-IN")}` },
      { label: "Net Profit",      value: `₹${Math.round(s?.totalProfit    ?? 0).toLocaleString("en-IN")}` },
      { label: "Outstanding Due", value: `₹${Math.round(s?.outstanding    ?? 0).toLocaleString("en-IN")}` },
      { label: "Total Invoices",  value: String(invoiceRows.length) },
    ],
    sections: [
      {
        heading:    "Summary",
        subheading: `Key financial metrics · ${periodLabel(dateRange)}`,
        headers:    ["Metric", "Value"],
        rows:       dataRows,
        alignments: ["left", "right"],
      },
      ...(billDataRows.length > 0 ? [{
        heading:    "Invoice Detail",
        subheading: `All ${invoiceRows.length} invoice${invoiceRows.length !== 1 ? "s" : ""} in this period`,
        headers:    billHeaders,
        rows:       billDataRows,
        alignments: ["left","left","left","left","right","right","right","right","right","right","right","right","left"] as ("left"|"right"|"center")[],
        totalsRow:  [
          "TOTAL", "", "", "", "",
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.discountAmt ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.cgst ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.sgst ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.totalAmt ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.paidAmt ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(invoiceRows.reduce((s, r) => s + Number(r.balanceDue ?? 0), 0)).toLocaleString("en-IN")}`,
          "",
        ],
      }] : []),
    ],
  });

  const rows: { label: string; value: number; formatted: string; color: string; trend?: boolean }[] = [
    { label: "Total Revenue",   value: s?.totalSales ?? 0,    formatted: fmt(s?.totalSales ?? 0),    color: ORANGE.base,   trend: true },
    { label: "Total Purchases", value: s?.totalPurchases ?? 0, formatted: fmt(s?.totalPurchases ?? 0), color: ORANGE.dark },
    { label: "Net Profit",      value: s?.totalProfit ?? 0,    formatted: fmt(s?.totalProfit ?? 0),    color: ORANGE.light,  trend: true },
    { label: "Outstanding Due", value: s?.outstanding ?? 0,    formatted: fmt(s?.outstanding ?? 0),    color: ORANGE.darker },
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

function PurchaseSummaryReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-purchase-stats", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: Array<{ invoiceNumber: string; supplierName: string; billDate: string; paymentMethod: string; itemCount: number; subtotal: number; taxAmt: number; discountAmt: number; totalAmt: number; status: string }>; total: number }>>(
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

  const purchaseHeaders = ["Bill #", "Supplier", "Date", "Payment", "Items", "Subtotal", "Discount", "Tax", "Total", "Status"];
  const purchaseDetailRows: (string | number)[][] = rows.map((r) => [
    r.invoiceNumber ?? "",
    r.supplierName  ?? "",
    r.billDate ? new Date(r.billDate).toLocaleDateString("en-IN") : "",
    r.paymentMethod ?? "",
    r.itemCount ?? "",
    `₹${Math.round(r.subtotal  ?? 0)}`,
    `₹${Math.round(r.discountAmt ?? 0)}`,
    `₹${Math.round(r.taxAmt    ?? 0)}`,
    `₹${Math.round(r.totalAmt  ?? 0)}`,
    r.status ?? "",
  ]);

  const handleExportExcel = () => exportExcel(
    "purchase-summary.xlsx", "Purchase Summary", headers, dataRows,
    purchaseDetailRows.length > 0
      ? [{ sheetName: "Purchase Detail", headers: purchaseHeaders, rows: purchaseDetailRows }]
      : undefined,
  );
  const handleExportPDF = () => buildPDF({
    filename:    "purchase-summary.pdf",
    reportTitle: "Purchase Summary Report",
    reportDesc:  "Total purchases, tax paid and discount received",
    period:      periodLabel(dateRange),
    generatedBy: "Orizo Bills",
    summary: [
      { label: "Total Bills",    value: String(rows.length) },
      { label: "Total Amount",   value: `₹${Math.round(total).toLocaleString("en-IN")}` },
      { label: "Total Tax Paid", value: `₹${Math.round(tax).toLocaleString("en-IN")}` },
      { label: "Total Discount", value: `₹${Math.round(discount).toLocaleString("en-IN")}` },
      { label: "Avg Bill Value", value: `₹${Math.round(avg).toLocaleString("en-IN")}` },
    ],
    sections: [
      {
        heading:    "Summary",
        subheading: `Key purchase metrics · ${periodLabel(dateRange)}`,
        headers:    headers,
        rows:       dataRows,
        alignments: ["left", "right"],
      },
      ...(purchaseDetailRows.length > 0 ? [{
        heading:    "Purchase Detail",
        subheading: `All ${rows.length} purchase bill${rows.length !== 1 ? "s" : ""} in this period`,
        headers:    purchaseHeaders,
        rows:       purchaseDetailRows,
        alignments: ["left","left","left","left","right","right","right","right","right","left"] as ("left"|"right"|"center")[],
        totalsRow:  [
          "TOTAL", "", "", "",
          String(rows.reduce((s, r) => s + (r.itemCount ?? 0), 0)),
          `₹${Math.round(rows.reduce((s, r) => s + (r.subtotal ?? 0), 0)).toLocaleString("en-IN")}`,
          `₹${Math.round(discount).toLocaleString("en-IN")}`,
          `₹${Math.round(tax).toLocaleString("en-IN")}`,
          `₹${Math.round(total).toLocaleString("en-IN")}`,
          "",
        ],
      }] : []),
    ],
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
            { label: "Total Bills",    value: String(rows.length), color: ORANGE.dark },
            { label: "Total Amount",   value: fmt(total),          color: "#0F172A" },
            { label: "Total Tax Paid", value: fmt(tax),            color: ORANGE.base },
            { label: "Total Discount", value: fmt(discount),       color: ORANGE.light },
            { label: "Avg Bill Value", value: fmt(avg),            color: ORANGE.darker },
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
  const handleExportPDF = () => buildPDF({
    filename:    "stock-report.pdf",
    reportTitle: "Stock Report",
    reportDesc:  "Current inventory levels and stock valuation",
    period:      `As of ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    generatedBy: "Orizo Bills",
    summary: [
      { label: "Total Products",  value: String(summary?.total      ?? 0) },
      { label: "In Stock",        value: String(summary?.inStock     ?? 0) },
      { label: "Low Stock",       value: String(summary?.lowStock    ?? 0) },
      { label: "Out of Stock",    value: String((summary?.total ?? 0) - (summary?.inStock ?? 0) - (summary?.lowStock ?? 0)) },
      { label: "Total Value",     value: `₹${Math.round(summary?.totalValue ?? 0).toLocaleString("en-IN")}` },
    ],
    sections: [
      {
        heading:    "Stock Detail",
        subheading: `${items.length} active product${items.length !== 1 ? "s" : ""}`,
        headers:    ["#", "Product Name", "Code", "Unit", "Stock Qty", "Stock Value (₹)", "Status"],
        rows:       items.map((item, i) => [
          i + 1,
          item.productName,
          item.productCode,
          item.unit,
          item.currentStock,
          Math.round(item.stockValue),
          item.status.replace("_", " "),
        ]),
        alignments: ["right","left","left","left","right","right","left"],
        totalsRow: [
          "", "TOTAL", "", "",
          items.reduce((s, i) => s + i.currentStock, 0),
          `₹${Math.round(summary?.totalValue ?? 0).toLocaleString("en-IN")}`,
          "",
        ],
      },
    ],
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Products", value: String(summary?.total    ?? 0), color: ORANGE.base   },
          { label: "In Stock",       value: String(summary?.inStock  ?? 0), color: ORANGE.light  },
          { label: "Low Stock",      value: String(summary?.lowStock ?? 0), color: ORANGE.amber  },
          { label: "Stock Value",    value: fmt(summary?.totalValue  ?? 0), color: ORANGE.darker },
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
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: item.currentStock <= 0 ? ORANGE.darker : item.status === "LOW_STOCK" ? ORANGE.amber : "#0F172A" }}>{item.currentStock}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>₹{Math.round(item.stockValue)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 8px",
                      background: item.status === "IN_STOCK" ? "rgba(249,115,22,0.08)" : item.status === "LOW_STOCK" ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.16)",
                      color:      item.status === "IN_STOCK" ? ORANGE.base            : item.status === "LOW_STOCK" ? ORANGE.amber            : ORANGE.darker }}>
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
  const handleExportPDF = () => buildPDF({
    filename:    "customer-report.pdf",
    reportTitle: "Customer Report",
    reportDesc:  "Customer-wise balances, outstanding dues and credit notes",
    period:      `As of ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    generatedBy: "Orizo Bills",
    summary: [
      { label: "Total Customers",  value: String(customers.length) },
      { label: "With Outstanding", value: String(customers.filter(c => c.balance > 0).length) },
      { label: "In Credit",        value: String(customers.filter(c => c.balance < 0).length) },
      { label: "Settled",          value: String(customers.filter(c => c.balance === 0).length) },
      { label: "Total Outstanding",value: `₹${Math.round(totalOutstanding).toLocaleString("en-IN")}` },
    ],
    sections: [
      {
        heading:    "Customer Balance List",
        subheading: `Sorted by balance — debtors first`,
        headers:    ["#", "Customer Name", "Phone", "Balance (₹)", "Type", "Member Since"],
        rows:       customers.map((c, i) => [
          i + 1,
          c.name,
          c.phone ?? "—",
          Math.round(Math.abs(c.balance)),
          c.balance > 0 ? "DR (Owes you)" : c.balance < 0 ? "CR (You owe)" : "Settled",
          new Date(c.createdAt).toLocaleDateString("en-IN"),
        ]),
        alignments: ["right","left","left","right","left","left"],
        totalsRow: [
          "", "TOTAL", "",
          Math.round(totalOutstanding),
          `${customers.filter(c => c.balance > 0).length} DR · ${customers.filter(c => c.balance < 0).length} CR`,
          "",
        ],
      },
    ],
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Customers",   value: String(customers.length),                              color: ORANGE.darker },
          { label: "With Outstanding",  value: String(customers.filter((c) => c.balance > 0).length), color: ORANGE.dark   },
          { label: "Total Outstanding", value: `₹${Math.round(totalOutstanding)}`,                      color: ORANGE.base   },
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
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: c.balance > 0 ? ORANGE.darker : "#94A3B8" }}>
                    {c.balance !== 0 ? `₹${Math.round(Math.abs(c.balance))} ${c.balance > 0 ? "DR" : "CR"}` : "—"}
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
    { label: "Total Revenue",       value: fmt(s?.totalSales ?? 0),            color: ORANGE.base,   bold: false },
    { label: "Cost of Purchases",   value: `(${fmt(s?.totalPurchases ?? 0)})`, color: ORANGE.darker, bold: false },
    { label: "Total Expenses",      value: `(${fmt(totalExp)})`,               color: ORANGE.darker, bold: false },
    { label: "Net Profit / (Loss)", value: fmt(Math.abs(netProfit)),           color: netProfit >= 0 ? ORANGE.base : ORANGE.darker, bold: true },
  ];

  const headers = ["Line Item", "Amount"];
  const dataRows: (string | number)[][] = [
    ["Total Revenue", s?.totalSales ?? 0],
    ["Cost of Purchases", -(s?.totalPurchases ?? 0)],
    ["Total Expenses", -totalExp],
    ["Net Profit / (Loss)", netProfit],
  ];

  const handleExportExcel = () => exportExcel(
    "profit-and-loss.xlsx", "P&L Summary", headers, dataRows,
    expRows.length > 0 ? [{
      sheetName: "Expense Detail",
      headers: ["Category", "Description", "Amount (₹)", "Date"],
      rows: expRows.map((e: { amount: number; category: string; description?: string; expenseDate?: string }) => [
        e.category, (e as { description?: string }).description ?? "—",
        Math.round(e.amount), (e as { expenseDate?: string }).expenseDate
          ? new Date((e as { expenseDate: string }).expenseDate).toLocaleDateString("en-IN") : "—",
      ]),
    }] : undefined,
  );
  const handleExportPDF = () => {
    // Build per-category expense summary
    const byCat: Record<string, number> = {};
    expRows.forEach((e: { category: string; amount: number }) => { byCat[e.category] = (byCat[e.category] ?? 0) + e.amount; });
    const catRows: (string | number)[][] = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => [cat, `₹${Math.round(amt).toLocaleString("en-IN")}`]);

    buildPDF({
      filename:    "profit-and-loss.pdf",
      reportTitle: "Profit & Loss Statement",
      reportDesc:  "Revenue, cost of purchases, expenses and net profit",
      period:      periodLabel(dateRange),
      generatedBy: "Orizo Bills",
      summary: [
        { label: "Revenue",       value: `₹${Math.round(s?.totalSales    ?? 0).toLocaleString("en-IN")}` },
        { label: "Purchases",     value: `₹${Math.round(s?.totalPurchases ?? 0).toLocaleString("en-IN")}` },
        { label: "Expenses",      value: `₹${Math.round(totalExp).toLocaleString("en-IN")}` },
        { label: "Net Profit",    value: `₹${Math.round(Math.abs(netProfit)).toLocaleString("en-IN")}` },
        { label: "Profit/Loss",   value: netProfit >= 0 ? "PROFIT" : "LOSS" },
      ],
      sections: [
        {
          heading:    "P&L Summary",
          subheading: periodLabel(dateRange),
          headers:    ["Line Item", "Amount (₹)", "Note"],
          rows: [
            ["Total Revenue",       `₹${Math.round(s?.totalSales    ?? 0).toLocaleString("en-IN")}`, "All sales invoices"],
            ["Cost of Purchases",   `(₹${Math.round(s?.totalPurchases ?? 0).toLocaleString("en-IN")})`, "Purchase bills"],
            ["Total Expenses",      `(₹${Math.round(totalExp).toLocaleString("en-IN")})`,              `${expRows.length} expense entries`],
            ["Net Profit / (Loss)", `₹${Math.round(Math.abs(netProfit)).toLocaleString("en-IN")}`,     netProfit >= 0 ? "✓ Profit" : "✗ Loss"],
          ],
          alignments: ["left", "right", "left"],
          totalsRow:  ["NET", `₹${Math.round(Math.abs(netProfit)).toLocaleString("en-IN")}`, netProfit >= 0 ? "PROFIT" : "LOSS"],
        },
        ...(catRows.length > 0 ? [{
          heading:    "Expense Breakdown by Category",
          subheading: `${expRows.length} expense entries · total ₹${Math.round(totalExp).toLocaleString("en-IN")}`,
          headers:    ["Category", "Total Amount"],
          rows:       catRows,
          alignments: ["left", "right"] as ("left" | "right" | "center")[],
          totalsRow:  ["TOTAL", `₹${Math.round(totalExp).toLocaleString("en-IN")}`],
        }] : []),
      ],
    });
  };

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

function GstReport({ dateRange }: { dateRange: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-gst", dateRange.start, dateRange.end],
    queryFn: () => http.get<ApiResp<{ data: Array<{ cgst: number; sgst: number; totalAmt: number; invoiceDate: string; invoiceNumber: string; customerName: string; paymentMethod: string }>; total: number }>>(
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

  const headers = ["Invoice #", "Date", "Customer", "Payment", "CGST (₹)", "SGST (₹)", "Total GST (₹)", "Invoice Total (₹)"];
  const dataRows: (string | number)[][] = rows.map((r) => [
    r.invoiceNumber,
    new Date(r.invoiceDate).toLocaleDateString("en-IN"),
    r.customerName,
    r.paymentMethod,
    Math.round(r.cgst),
    Math.round(r.sgst),
    Math.round(r.cgst + r.sgst),
    Math.round(r.totalAmt),
  ]);

  const handleExportExcel = () => exportExcel(
    "gst-report.xlsx", "GST Report",
    headers, dataRows,
  );
  const handleExportPDF = () => buildPDF({
    filename:    "gst-report.pdf",
    reportTitle: "GST Report",
    reportDesc:  "CGST, SGST collected invoice-wise",
    period:      periodLabel(dateRange),
    generatedBy: "Orizo Bills",
    summary: [
      { label: "Invoices",    value: String(rows.length) },
      { label: "Total CGST",  value: `₹${Math.round(totalCgst).toLocaleString("en-IN")}` },
      { label: "Total SGST",  value: `₹${Math.round(totalSgst).toLocaleString("en-IN")}` },
      { label: "Total GST",   value: `₹${Math.round(totalCgst + totalSgst).toLocaleString("en-IN")}` },
    ],
    sections: [
      {
        heading:    "Invoice-wise GST Detail",
        subheading: `${rows.length} invoice${rows.length !== 1 ? "s" : ""} · ${periodLabel(dateRange)}`,
        headers,
        rows:       dataRows,
        alignments: ["left","left","left","left","right","right","right","right"],
        totalsRow:  [
          "TOTAL", "", "", "",
          Math.round(totalCgst),
          Math.round(totalSgst),
          Math.round(totalCgst + totalSgst),
          Math.round(rows.reduce((s, r) => s + r.totalAmt, 0)),
        ],
      },
    ],
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
              { label: "Total CGST", value: fmt(totalCgst),             color: ORANGE.amber  },
              { label: "Total SGST", value: fmt(totalSgst),             color: ORANGE.base   },
              { label: "Total GST",  value: fmt(totalCgst + totalSgst), color: ORANGE.darker },
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

const dateInp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 10px",
  fontSize: 13, color: "#1E293B", background: "#fff",
  outline: "none", fontFamily: "inherit", cursor: "pointer",
};