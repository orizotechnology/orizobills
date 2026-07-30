import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts } from "echarts/core";
import type { EChartsOption } from "echarts";
import { http } from "@/lib/axios";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface DailyData { day: number; amount: number }
interface ApiResp { success: boolean; data: { daily: DailyData[]; year: number; month: number } }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface SalesChartProps { year: number; month: number; }

export function SalesChart({ year, month }: SalesChartProps) {
  const ref      = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-daily", year, month],
    queryFn: () => http.get<ApiResp>(`/sales/daily?year=${year}&month=${month}`),
    staleTime: 60_000,
  });

  const daily    = data?.data?.daily ?? [];
  const amounts  = daily.map((d) => d.amount);
  const dates    = daily.map((d) =>
    `${String(d.day).padStart(2, "0")} ${MONTH_NAMES[month - 1]}`
  );
  const totalMonth = amounts.reduce((s, v) => s + v, 0);

  // Build / update chart whenever data changes
  useEffect(() => {
    if (!ref.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
      const onResize = () => chartRef.current?.resize();
      window.addEventListener("resize", onResize);
      // store cleanup ref on the chart object (safe pattern)
      (chartRef.current as any)._cleanup = () => window.removeEventListener("resize", onResize);
    }

    const option: EChartsOption = {
      backgroundColor: "transparent",
      grid: { left: 54, right: 20, top: 14, bottom: 34 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#1E293B", fontSize: 12 },
        axisPointer: {
          type: "cross",
          lineStyle:  { color: "#F97316", width: 1, type: "dashed" },
          crossStyle: { color: "#F97316", width: 1 },
        },
        formatter(params: unknown) {
          const arr = params as Array<{ name: string; value: number }>;
          const p = arr[0];
          if (!p) return "";
          const v = p.value;
          const label = v >= 100_000
            ? `₹${(v / 100_000).toFixed(1)}L`
            : v >= 1_000
            ? `₹${(v / 1_000).toFixed(1)}K`
            : `₹${v.toFixed(0)}`;
          return `<div style="font-size:11px;color:#64748B">${p.name}</div>
                  <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:3px">${label}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: dates.length ? dates : Array.from({ length: 31 }, (_, i) => `${String(i+1).padStart(2,"0")} ${MONTH_NAMES[month-1]}`),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "#94A3B8", fontSize: 11, interval: 4 },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#F1F5F9", type: "dashed" } },
        axisLabel: {
          color: "#94A3B8",
          fontSize: 11,
          formatter(v: number) {
            if (v === 0) return "₹0";
            if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
            if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
            return `₹${v}`;
          },
        },
      },
      series: [{
        type: "line",
        data: amounts.length ? amounts : Array(31).fill(0),
        smooth: 0.4,
        symbol: "none",
        lineStyle: { color: "#F97316", width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(249,115,22,0.20)" },
            { offset: 1, color: "rgba(249,115,22,0.00)" },
          ]),
        },
      }],
    };

    chartRef.current.setOption(option, true);
  }, [amounts, dates, month]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        (chartRef.current as any)._cleanup?.();
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []);

  const isCurrentMonth = false; // navigation handled by parent

  const fmt = (v: number) =>
    v >= 100_000 ? `₹${(v/100_000).toFixed(1)}L`
    : v >= 1_000 ? `₹${(v/1_000).toFixed(1)}K`
    : `₹${v.toFixed(0)}`;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 20px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Sales Overview</span>
          {!isLoading && totalMonth > 0 && (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700, color: "#F97316" }}>
              {fmt(totalMonth)} this month
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
      </div>

      {isLoading && (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 13 }}>
          <div style={{ width: 20, height: 20, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginRight: 8 }} />
          Loading chart data…
        </div>
      )}
      <div ref={ref} style={{ width: "100%", height: 220, display: isLoading ? "none" : "block" }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, border: "1px solid #E2E8F0", borderRadius: 6,
  background: "#fff", cursor: "pointer", fontSize: 13, color: "#475569",
  display: "flex", alignItems: "center", justifyContent: "center",
};
