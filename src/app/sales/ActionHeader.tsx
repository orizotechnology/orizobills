import { Search, Plus } from "lucide-react";

export default function ActionHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        width: "100%",
      }}
    >
      {/* Search */}
      <div
        style={{
          flex: 1,
          position: "relative",
        }}
      >
        <Search
          size={18}
          color="#94A3B8"
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />

        <input
          placeholder="Search Transactions..."
          style={{
            width: "100%",
            height: "40px",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            paddingLeft: "42px",
            paddingRight: "15px",
            fontSize: "14px",
            outline: "none",
            background: "#FFFFFF",
            color: "#334155",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          style={{
            height: "40px",
            padding: "0 18px",
            border: "none",
            borderRadius: "12px",
            background: "#F97316",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          Add Sale
        </button>

        <button
          style={{
            height: "40px",
            padding: "0 18px",
            border: "none",
            borderRadius: "12px",
            background: "#1D4ED8",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          Add Purchase
        </button>
      </div>
    </div>
  );
}