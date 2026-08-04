import { useRef, useEffect, useLayoutEffect } from "react";
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

// ── Smart Y-axis scale (extracted — pure function) ────────────
function niceScale(max: number): { yMax: number; interval: number } {
  if (max === 0) return { yMax: 10_000, interval: 2_000 };
  const mag      = Math.pow(10, Math.floor(Math.log10(max)));
  const ceil     = Math.ceil(max / mag) * mag;
  const cands    = [mag / 10, mag / 5, mag / 2, mag, mag * 2, mag * 5];
  const interval = cands.find((c) => ceil / c <= 6 && ceil / c >= 3) ?? mag;
  const yMax     = Math.ceil(ceil / interval) * interval;
  return { yMax, interval };
}

function yLabel(v: number): string {
  if (v === 0)            return "₹0";
  if (v >= 10_000_000)    return `₹${(v / 10_000_000).toFixed(0)}Cr`;
  if (v >= 100_000)       return `₹${(v / 100_000).toFixed(0)}L`;
  if (v >= 1_000)         return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function SalesChart({ year, month }: SalesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null); // outer card — always visible
  const chartRef     = useRef<HTMLDivElement>(null);  // canvas target
  const instanceRef  = useRef<ECharts | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-daily", year, month],
    queryFn:  () => http.get<ApiResp>(`/sales/daily?year=${year}&month=${month}`),
    staleTime: 60_000,
  });

  const daily      = data?.data?.daily ?? [];
  const amounts    = daily.map((d) => d.amount);
  const dates      = daily.map((d) =>
    `${String(d.day).padStart(2, "0")} ${MONTH_NAMES[month - 1]}`
  );
  const totalMonth = amounts.reduce((s, v) => s + v, 0);

  // ── 1. Init ECharts once — on mount, on the visible outer div ──
  //    We attach to `containerRef` (always in the DOM and visible)
  //    then resize immediately after paint via useLayoutEffect.
  useLayoutEffect(() => {
    const el = chartRef.current;
    if (!el || instanceRef.current) return;

    instanceRef.current = echarts.init(el, undefined, { renderer: "canvas" });

    // ResizeObserver watches the container for ANY size change
    // (window resize, sidebar toggle, panel layout shift, tab change)
    const ro = new ResizeObserver(() => {
      instanceRef.current?.resize();
    });
    ro.observe(el);

    // Also keep the window resize for safety
    const onWinResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", onWinResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  // ── 2. Apply chart options whenever data or month changes ──────
  useEffect(() => {
    if (!instanceRef.current || isLoading) return;

    const maxVal          = Math.max(...(amounts.length ? amounts : [0]), 0);
    const { yMax, interval } = niceScale(maxVal);

    const xData = dates.length
      ? dates
      : Array.from({ length: 31 }, (_, i) =>
          `${String(i + 1).padStart(2, "0")} ${MONTH_NAMES[month - 1]}`);

    const option: EChartsOption = {
      backgroundColor: "transparent",
      animation: true,
      grid: { left: 62, right: 20, top: 14, bottom: 34 },
      tooltip: {
        trigger:     "axis",
        backgroundColor: "#fff",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding:     [8, 12],
        textStyle:   { color: "#1E293B", fontSize: 12 },
        axisPointer: {
          type:       "cross",
          lineStyle:  { color: "#F97316", width: 1, type: "dashed" },
          crossStyle: { color: "#F97316", width: 1 },
        },
        formatter(params: unknown) {
          const arr = params as Array<{ name: string; value: number }>;
          const p   = arr[0];
          if (!p) return "";
          return `<div style="font-size:11px;color:#64748B">${p.name}</div>
                  <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:3px">${yLabel(p.value)}</div>`;
        },
      },
      xAxis: {
        type:        "category",
        data:        xData,
        boundaryGap: false,
        axisLine:    { lineStyle: { color: "#E2E8F0" } },
        axisTick:    { show: false },
        splitLine:   { show: false },
        axisLabel:   {
          color:    "#94A3B8",
          fontSize: 11,
          // Show ~6 evenly spaced labels regardless of days in month
          interval: (index: number, _value: string) => {
            const total = xData.length;
            const step  = Math.max(1, Math.floor(total / 6));
            return index % step === 0 || index === total - 1;
          },
        },
      },
      yAxis: {
        type:     "value",
        min:      0,
        max:      yMax,
        interval,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#F1F5F9", type: "dashed" } },
        axisLabel: { color: "#94A3B8", fontSize: 11, formatter: yLabel },
      },
      series: [{
        type:      "line",
        data:      amounts.length ? amounts : Array(xData.length).fill(0),
        smooth:    0.4,
        symbol:    "none",
        lineStyle: { color: "#F97316", width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(249,115,22,0.20)" },
            { offset: 1, color: "rgba(249,115,22,0.00)" },
          ]),
        },
      }],
    };

    instanceRef.current.setOption(option, { notMerge: true });

    // Force a resize right after setting options — catches the case
    // where the loading overlay was hidden and the div just got its
    // real width for the first time.
    requestAnimationFrame(() => instanceRef.current?.resize());

  }, [amounts, dates, month, isLoading]);

  const fmt = (v: number) =>
    v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L`
    : v >= 1_000 ? `₹${(v / 1_000).toFixed(1)}K`
    : `₹${v.toFixed(0)}`;

  return (
    <div
      ref={containerRef}
      style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 20px 12px" }}
    >
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

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 13 }}>
          <div style={{ width: 20, height: 20, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginRight: 8 }} />
          Loading chart data…
        </div>
      )}

      {/*
        Canvas container — always in the DOM so the ResizeObserver
        has a stable element to watch. Hidden via visibility (not
        display:none) so it keeps its dimensions.
      */}
      <div
        ref={chartRef}
        style={{
          width:      "100%",
          height:     220,
          visibility: isLoading ? "hidden" : "visible",
          // Collapse height while loading so it doesn't push layout
          maxHeight:  isLoading ? 0 : 220,
          overflow:   "hidden",
          transition: "max-height 0.2s",
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
