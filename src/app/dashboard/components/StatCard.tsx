import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: ReactNode;
  index?: number;
}

export function StatCard({ title, value, change, changeLabel, icon, index = 0 }: StatCardProps) {
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Row 1: icon left, 3-dot right */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "rgba(249,115,22,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#F97316",
          }}
        >
          {icon}
        </div>
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#CBD5E1",
            padding: 2,
            display: "flex",
          }}
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Title */}
      <div style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>{title}</div>

      {/* Value */}
      <div style={{ color: "#0F172A", fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1 }}>
        {value}
      </div>

      {/* Change + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {change === 0 ? (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#F8FAFC", color: "#94A3B8" }}>
            — 0%
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
              background: isPositive ? "#F0FDF4" : "#FFF1F2",
              color: isPositive ? "#16A34A" : "#EF4444",
            }}
          >
            {isPositive ? "▲" : "▼"} {Math.abs(change)}%
          </span>
        )}
        <span style={{ color: "#94A3B8", fontSize: 12 }}>vs {changeLabel}</span>
      </div>
    </motion.div>
  );
}
