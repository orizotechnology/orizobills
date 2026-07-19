import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ECharts } from "echarts/core";
import type { EChartsOption } from "echarts";
import { ChevronDown } from "lucide-react";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

// Empty data — real data will come from API
const ALL_DATES = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  return `${String(d).padStart(2, "0")} ${new Date(new Date().getFullYear(), new Date().getMonth(), d).toLocaleString("en-IN", { month: "short" })}`;
});

const DATA = Array(31).fill(0);

export function SalesChart() {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || chartRef.current) return;

    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const option: EChartsOption = {
      backgroundColor: "transparent",
      grid: { left: 54, right: 20, top: 14, bottom: 34 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#E2E8F0",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#1E293B", fontSize: 12, fontFamily: "inherit" },
        axisPointer: {
          type: "cross",
          lineStyle: { color: "#F97316", width: 1, type: "dashed" },
          crossStyle: { color: "#F97316", width: 1 },
        },
        formatter(params: unknown) {
          const arr = params as Array<{ name: string; value: number }>;
          const p = arr[0];
          if (!p) return "";
          const v = p.value;
          const label = v >= 100000
            ? `₹${(v / 100000).toFixed(1)}L`
            : `₹${(v / 1000).toFixed(0)}K`;
          return `<div style="font-size:11px;color:#64748B">${p.name}</div>
                  <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:3px">${label}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: ALL_DATES,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: "#94A3B8",
          fontSize: 11,
          interval: 4,
        },
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
            if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
            if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
            return `₹${v}`;
          },
        },
      },
      series: [
        {
          type: "line",
          data: DATA,
          smooth: 0.5,
          symbol: "none",
          lineStyle: { color: "#F97316", width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(249,115,22,0.20)" },
              { offset: 1, color: "rgba(249,115,22,0.00)" },
            ]),
          },
        },
      ],
    };

    chart.setOption(option);

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        padding: "20px 20px 12px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Sales Overview</span>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 13,
            color: "#64748B",
            background: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          This Month <ChevronDown size={13} />
        </button>
      </div>

      {/* Chart */}
      <div ref={ref} style={{ width: "100%", height: 220 }} />
    </div>
  );
}
