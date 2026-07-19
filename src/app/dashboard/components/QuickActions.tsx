import { motion } from "framer-motion";
import { FilePlus, UserPlus, Package, Wallet, Receipt, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface Action {
  label: string;
  Icon: LucideIcon;
  to: string;
}

// Order: Create Invoice + Add Product (top), Record Payment + Add Expense (middle),
//        View Reports + Add Customer (bottom)
const ACTIONS: Action[] = [
  { label: "Create Invoice",  Icon: FilePlus,  to: "/app/pos"              },
  { label: "Add Product",     Icon: Package,   to: "/app/products/all"     },
  { label: "Record Payment",  Icon: Wallet,    to: "/app/sales/payment-in" },
  { label: "Add Expense",     Icon: Receipt,   to: "/app/expenses"         },
  { label: "View Reports",    Icon: BarChart2, to: "/app/reports"          },
  { label: "Add Customer",    Icon: UserPlus,  to: "/app/customers"        },
];

export function QuickActions({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();

  const iconSize   = compact ? 22 : 28;
  const iconBox    = compact ? 44 : 56;
  const iconRadius = compact ? 10 : 14;
  const fontSize   = compact ? 12 : 13;
  const gap        = compact ? 10 : 12;
  const padding    = compact ? "12px 14px 14px" : "16px 18px 18px";

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #E2E8F0",
      padding,
      height: "100%",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ fontSize: compact ? 14 : 15, fontWeight: 600, color: "#0F172A", marginBottom: gap }}>
        Quick Actions
      </div>

      {/* 2-column grid that fills available height */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap,
        flex: 1,
      }}>
        {ACTIONS.map(({ label, Icon, to }, i) => (
          <motion.button
            key={label}
            onClick={() => navigate(to)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            whileHover={{ y: -2, boxShadow: "0 6px 16px rgba(0,0,0,0.09)" }}
            whileTap={{ scale: 0.96 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              background: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
              outline: "none",
              padding: "14px 8px",
              minHeight: 90,
            }}
          >
            <div style={{
              width: iconBox,
              height: iconBox,
              borderRadius: iconRadius,
              background: "rgba(249,115,22,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F97316",
            }}>
              <Icon size={iconSize} strokeWidth={1.6} />
            </div>
            <span style={{
              fontSize,
              fontWeight: 500,
              color: "#475569",
              textAlign: "center",
              lineHeight: 1.3,
            }}>
              {label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
