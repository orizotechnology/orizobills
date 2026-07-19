import { Bell, HelpCircle, Search, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BranchSelector } from "@/components/branches/BranchSelector";

export function TopBar() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 56,
        padding: "0 20px",
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Branch Selector — left of search */}
      <BranchSelector />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search — centred */}
      <div style={{ position: "relative", width: 260 }}>
        <Search
          size={14}
          style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)",
            color: "#94A3B8", pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Search anything..."
          style={{
            width: "100%", border: "1px solid #E2E8F0",
            borderRadius: 8, padding: "7px 12px 7px 32px",
            fontSize: 13, color: "#475569", background: "#F8FAFC",
            outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; e.currentTarget.style.background = "#fff"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC"; }}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        {/* Bell */}
        <button
          style={{
            position: "relative", width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", borderRadius: 8,
            cursor: "pointer", color: "#64748B", outline: "none",
          }}
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.8} />
          <span style={{
            position: "absolute", top: 5, right: 5,
            background: "#F97316", color: "#fff",
            fontSize: 9, fontWeight: 700,
            width: 15, height: 15, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>3</span>
        </button>

        {/* Help */}
        <button
          style={{
            width: 36, height: 36, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "none", border: "none", borderRadius: 8,
            cursor: "pointer", color: "#64748B", outline: "none",
          }}
          aria-label="Help"
        >
          <HelpCircle size={18} strokeWidth={1.8} />
        </button>

        {/* Create */}
        <button
          onClick={() => navigate("/app/pos")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#F97316", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "8px 14px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", marginLeft: 4,
            fontFamily: "inherit", outline: "none",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Create
          <ChevronDown size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
