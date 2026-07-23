import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShoppingBag, ShoppingCart, TrendingUp,
  IndianRupee, CalendarDays, ChevronDown,
} from "lucide-react";
import { StatCard } from "./components/StatCard";
import { SalesChart } from "./components/SalesChart";
import { QuickActions } from "./components/QuickActions";
import { RecentInvoices } from "./components/RecentInvoices";
import { useAuthStore } from "@/store/auth.store";
import { http } from "@/lib/axios";

// =============================================================
// DASHBOARD — uses /api/sales/stats aggregate endpoint
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

const now       = new Date();
const monthName = now.toLocaleString("en-IN", { month: "long" });
const year      = now.getFullYear();
const firstDay  = `01 ${monthName.slice(0, 3)} ${year}`;
const lastDay   = `${new Date(year, now.getMonth() + 1, 0).getDate()} ${monthName.slice(0, 3)} ${year}`;

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => http.get<StatsResp>("/sales/stats"),
    staleTime: 60_000,
  });

  const stats = data?.data;

  const STATS = [
    {
      title: "Total Sales",
      value: isLoading ? "…" : fmt(stats?.totalSales ?? 0),
      change: 0, changeLabel: "all time",
      icon: <ShoppingBag size={20} strokeWidth={1.7} />,
    },
    {
      title: "Total Purchases",
      value: isLoading ? "…" : fmt(stats?.totalPurchases ?? 0),
      change: 0, changeLabel: "all time",
      icon: <ShoppingCart size={20} strokeWidth={1.7} />,
    },
    {
      title: "Total Profit",
      value: isLoading ? "…" : fmt(stats?.totalProfit ?? 0),
      change: 0, changeLabel: "all time",
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

      {/* ── Greeting + date ────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
            Hello, {user?.name ?? "there"} 👋
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 5 }}>
            Here's what's happening with your business today.
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#475569", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginTop: 2, outline: "none" }}
        >
          <CalendarDays size={14} color="#94A3B8" />
          {firstDay} - {lastDay}
          <ChevronDown size={13} color="#94A3B8" />
        </motion.button>
      </div>

      {/* ── Stats + Quick Actions ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "stretch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14 }}>
          {STATS.map((s, i) => <StatCard key={s.title} {...s} index={i} />)}
        </div>
        <QuickActions compact />
      </div>

      {/* ── Sales chart (real daily data) ────────────── */}
      <SalesChart />

      {/* ── Recent Invoices ───────────────────────────── */}
      <RecentInvoices />
    </div>
  );
}
