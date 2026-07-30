import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, ShoppingCart, TrendingUp,
  IndianRupee, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { StatCard } from "./components/StatCard";
import { SalesChart } from "./components/SalesChart";
import { QuickActions } from "./components/QuickActions";
import { RecentInvoices } from "./components/RecentInvoices";
import { useAuthStore } from "@/store/auth.store";
import { http } from "@/lib/axios";

// =============================================================
// DASHBOARD — month-aware stats, chart and recent invoices
// =============================================================

interface StatsResp {
  success: boolean;
  data: {
    totalSales: number;
    totalPurchases: number;
    totalProfit: number;
    outstanding: number;
  };
}

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)   return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Build list: last 24 months newest-first
function buildMonthList() {
  const now    = new Date();
  const list: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}` });
  }
  return list;
}
const MONTH_LIST = buildMonthList();

export default function DashboardPage() {
  const { session } = useAuthStore();
  const qc          = useQueryClient();

  // ── Selected period ─────────────────────────────────────
  const now = new Date();
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    if (pickerOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [pickerOpen]);

  const selectMonth = (year: number, month: number) => {
    setSelYear(year);
    setSelMonth(month);
    setPickerOpen(false);
    // Invalidate all dashboard queries so they refresh with new params
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["sales-daily"] });
    qc.invalidateQueries({ queryKey: ["recent-invoices"] });
  };

  // ── Stats query — filtered by month ─────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", selYear, selMonth],
    queryFn: () => http.get<StatsResp>(`/sales/stats?year=${selYear}&month=${selMonth}`),
    staleTime: 60_000,
  });

  const stats = data?.data;

  // ── Formatted date range label ───────────────────────────
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const dateLabel   = `01 ${MONTH_NAMES[selMonth - 1]} ${selYear} – ${daysInMonth} ${MONTH_NAMES[selMonth - 1]} ${selYear}`;

  // ── Prev / Next month navigation ─────────────────────────
  const goPrev = () => {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12); }
    else setSelMonth(m => m - 1);
  };
  const goNext = () => {
    const isNow = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;
    if (isNow) return;
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1); }
    else setSelMonth(m => m + 1);
  };
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;

  const STATS = [
    {
      title: "Total Sales",
      value: isLoading ? "…" : fmt(stats?.totalSales ?? 0),
      change: 0, changeLabel: MONTH_NAMES[selMonth - 1],
      icon: <ShoppingBag size={20} strokeWidth={1.7} />,
    },
    {
      title: "Total Purchases",
      value: isLoading ? "…" : fmt(stats?.totalPurchases ?? 0),
      change: 0, changeLabel: MONTH_NAMES[selMonth - 1],
      icon: <ShoppingCart size={20} strokeWidth={1.7} />,
    },
    {
      title: "Total Profit",
      value: isLoading ? "…" : fmt(stats?.totalProfit ?? 0),
      change: 0, changeLabel: MONTH_NAMES[selMonth - 1],
      icon: <TrendingUp size={20} strokeWidth={1.7} />,
      valueColor: !isLoading && (stats?.totalProfit ?? 0) < 0 ? "#EF4444" : undefined,
    },
    {
      title: "Outstanding",
      value: isLoading ? "…" : fmt(stats?.outstanding ?? 0),
      change: 0, changeLabel: "unpaid",
      icon: <IndianRupee size={20} strokeWidth={1.7} />,
    },
  ];

  return (
    <div style={{ padding: "24px 28px 32px", display: "flex", flexDirection: "column", gap: 20, minHeight: "100%" }}>

      {/* ── Greeting + month picker ──────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
            Hello, {session?.name ?? "there"} 👋
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 5 }}>
            Here's what's happening with your business.
          </div>
        </motion.div>

        {/* Month picker */}
        <div ref={pickerRef} style={{ position: "relative", flexShrink: 0, marginTop: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Prev */}
            <button onClick={goPrev}
              style={{ width: 30, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px 0 0 8px", cursor: "pointer", color: "#64748B", outline: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <ChevronLeft size={13} />
            </button>

            {/* Label button */}
            <button onClick={() => setPickerOpen(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #E2E8F0", borderLeft: "none", borderRight: "none", padding: "7px 14px", fontSize: 13, color: "#475569", cursor: "pointer", fontFamily: "inherit", outline: "none", height: 36, whiteSpace: "nowrap" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <CalendarDays size={13} color="#94A3B8" />
              {dateLabel}
              <ChevronDown size={12} color="#94A3B8" style={{ transition: "transform 0.15s", transform: pickerOpen ? "rotate(180deg)" : "rotate(0)" }} />
            </button>

            {/* Next */}
            <button onClick={goNext} disabled={isCurrentMonth}
              style={{ width: 30, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "0 8px 8px 0", cursor: isCurrentMonth ? "not-allowed" : "pointer", color: isCurrentMonth ? "#CBD5E1" : "#64748B", outline: "none" }}
              onMouseEnter={e => { if (!isCurrentMonth) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Dropdown — list of last 24 months */}
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  zIndex: 400, overflow: "hidden",
                  width: 220, maxHeight: 320, overflowY: "auto",
                  scrollbarWidth: "none",
                }}
              >
                {MONTH_LIST.map(({ year, month, label }) => {
                  const isSelected = year === selYear && month === selMonth;
                  return (
                    <button key={`${year}-${month}`} onClick={() => selectMonth(year, month)}
                      style={{
                        width: "100%", padding: "10px 14px", background: isSelected ? "rgba(249,115,22,0.07)" : "none",
                        border: "none", borderBottom: "1px solid #F8FAFC",
                        textAlign: "left", fontSize: 13, fontWeight: isSelected ? 700 : 400,
                        color: isSelected ? "#F97316" : "#475569",
                        cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                      {label}
                      {isSelected && <span style={{ fontSize: 10, background: "#F97316", color: "#fff", borderRadius: 99, padding: "1px 7px" }}>Selected</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Stats + Quick Actions ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "stretch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14 }}>
          {STATS.map((s, i) => <StatCard key={s.title} {...s} index={i} />)}
        </div>
        <QuickActions compact />
      </div>

      {/* ── Sales chart — pass selected month ─────────── */}
      <SalesChart year={selYear} month={selMonth} />

      {/* ── Recent Invoices — pass selected month ──────── */}
      <RecentInvoices year={selYear} month={selMonth} />
    </div>
  );
}
