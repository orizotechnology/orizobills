import { useState, useRef, useEffect } from "react";
import { Bell, HelpCircle, Search, ChevronDown, Plus, FileText, ShoppingCart, Receipt, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BranchSelector } from "@/components/branches/BranchSelector";

// =============================================================
// TOP BAR
// - Bell   → navigates to /app/sales/payment-in (receivables)
// - Help   → navigates to /app/settings/general
// - Create → dropdown with quick-create shortcuts
// =============================================================

const CREATE_ITEMS = [
  { label: "Sale Invoice",    icon: FileText,     to: "/app/sales/invoices"   },
  { label: "POS / Quick Sale",icon: Plus,         to: "/app/pos"              },
  { label: "Purchase Bill",   icon: ShoppingCart, to: "/app/purchase/new"     },
  { label: "Expense",         icon: Receipt,      to: "/app/expenses"         },
];

export function TopBar() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    if (createOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [createOpen]);

  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: 56, padding: "0 20px",
      background: "#fff", borderBottom: "1px solid #E2E8F0",
      flexShrink: 0, gap: 12,
    }}>
      {/* Branch Selector */}
      <BranchSelector />

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{ position: "relative", width: 260 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Search anything..."
          style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 12px 7px 32px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; e.currentTarget.style.background = "#fff"; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC"; }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        {/* Bell → receivables / payment-in */}
        <button
          onClick={() => navigate("/app/sales/payment-in")}
          title="Payments & Receivables"
          style={{ position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#64748B", outline: "none", transition: "background 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          aria-label="Payments"
        >
          <Bell size={18} strokeWidth={1.8} />
          <span style={{ position: "absolute", top: 5, right: 5, background: "#F97316", color: "#fff", fontSize: 9, fontWeight: 700, width: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            3
          </span>
        </button>

        {/* Help → settings */}
        <button
          onClick={() => navigate("/app/settings/general")}
          title="Settings & Help"
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#64748B", outline: "none", transition: "background 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
          aria-label="Help"
        >
          <HelpCircle size={18} strokeWidth={1.8} />
        </button>

        {/* Create dropdown */}
        <div ref={createRef} style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setCreateOpen(p => !p)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", transition: "background 0.12s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EA580C"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F97316"; }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Create
            <ChevronDown size={13} strokeWidth={2.2} style={{ transition: "transform 0.15s", transform: createOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>

          {/* Dropdown menu */}
          {createOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              background: "#fff", border: "1px solid #E2E8F0",
              borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              minWidth: 200, zIndex: 500, overflow: "hidden", padding: "4px 0",
            }}>
              {/* Header */}
              <div style={{ padding: "8px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>QUICK CREATE</span>
                <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", display: "flex", padding: 2 }}>
                  <X size={12} />
                </button>
              </div>

              {CREATE_ITEMS.map(({ label, icon: Icon, to }) => (
                <button
                  key={to}
                  onClick={() => { navigate(to); setCreateOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", textAlign: "left", transition: "background 0.1s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color="#F97316" />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
