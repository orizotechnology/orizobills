import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Settings, Search, BarChart2, Printer, X } from "lucide-react";

// =============================================================
// PAGE SHELL — Reusable billing page layout
// Matches the Sale Invoices design exactly
// =============================================================

export type FilterRange = "This Week" | "This Month" | "This Year" | "Custom Range" | "All Time";
const FILTERS: FilterRange[] = ["This Week", "This Month", "This Year", "Custom Range", "All Time"];

interface Column { key: string; label: string; }

interface PageShellProps {
  title: string;
  addLabel?: string;
  onAdd?: () => void;
  addTo?: string;           // navigate to this path on add
  showSettings?: boolean;
  showClose?: boolean;
  closeBackTo?: string;
  filters?: boolean;
  activeFilter?: FilterRange;
  onFilterChange?: (f: FilterRange) => void;
  sectionTitle?: string;
  columns?: Column[];
  rows?: ReactNode[];
  emptyMessage?: string;
  topContent?: ReactNode;   // extra content above table
  children?: ReactNode;     // full override
}

export function PageShell({
  title,
  addLabel = "+ Add",
  onAdd,
  addTo,
  showSettings = false,
  showClose = false,
  closeBackTo = "/app/dashboard",
  filters = true,
  activeFilter = "This Week",
  onFilterChange,
  sectionTitle = "Transactions",
  columns = [],
  rows = [],
  emptyMessage = "No records found.",
  topContent,
  children,
}: PageShellProps) {
  const navigate = useNavigate();

  const handleAdd = () => {
    if (onAdd) { onAdd(); return; }
    if (addTo) { navigate(addTo); }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "#fff",
      fontFamily: "system-ui, sans-serif",
    }}>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px 12px",
        borderBottom: "1px solid #F1F5F9",
        flexShrink: 0,
      }}>
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          padding: 0, outline: "none", fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{title}</span>
          <ChevronDown size={16} color="#64748B" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleAdd}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#F97316", color: "#fff",
              border: "none", borderRadius: 7,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", outline: "none",
            }}
          >
            {addLabel}
          </button>
          {showSettings && (
            <button style={iconBtn} title="Settings">
              <Settings size={16} color="#64748B" strokeWidth={1.8} />
            </button>
          )}
          {showClose && (
            <button style={iconBtn} onClick={() => navigate(closeBackTo)} title="Close">
              <X size={16} color="#64748B" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────── */}
      {filters && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "10px 20px",
          borderBottom: "1px solid #F1F5F9",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: "#64748B", marginRight: 6 }}>Filter by:</span>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange?.(f)}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "none",
                fontSize: 13,
                fontWeight: activeFilter === f ? 600 : 400,
                background: activeFilter === f ? "#F97316" : "transparent",
                color: activeFilter === f ? "#fff" : "#475569",
                cursor: "pointer", fontFamily: "inherit", outline: "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Extra top content (summary cards etc.) */}
      {topContent && (
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          {topContent}
        </div>
      )}

      {/* ── Main content ────────────────────────────────── */}
      {children ? (
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {children}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Section header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px 10px",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{sectionTitle}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button style={iconBtn} title="Search"><Search size={15} color="#64748B" strokeWidth={1.8} /></button>
              <button style={iconBtn} title="Analytics"><BarChart2 size={15} color="#64748B" strokeWidth={1.8} /></button>
              <button style={iconBtn} title="Print"><Printer size={15} color="#64748B" strokeWidth={1.8} /></button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {columns.map((col) => (
                    <th key={col.key} style={{
                      padding: "8px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#94A3B8",
                      letterSpacing: "0.05em", whiteSpace: "nowrap",
                      position: "sticky", top: 0, background: "#fff",
                      borderBottom: "1px solid #F1F5F9",
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length || 1} style={{
                      padding: "60px 16px", textAlign: "center",
                      fontSize: 13, color: "#94A3B8",
                    }}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : rows}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "none", border: "none",
  borderRadius: 7, cursor: "pointer", outline: "none",
};
