import { X, Plus } from "lucide-react";
import { usePosStore } from "@/store/pos.store";

// =============================================================
// BILL TAB BAR
// Browser-like tabs for multi-bill entry.
// Each tab = one independent POS bill.
// =============================================================

export function BillTabBar() {
  const { bills, activeBillId, addBill, closeBill, setActiveBill } = usePosStore();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "#F1F5F9",
        borderBottom: "1px solid #E2E8F0",
        height: 36,
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}
    >
      {/* Tabs */}
      {bills.map((bill) => {
        const isActive = bill.id === activeBillId;
        return (
          <div
            key={bill.id}
            onClick={() => setActiveBill(bill.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 20px",
              minWidth: 160,
              maxWidth: 220,
              cursor: "pointer",
              background: isActive ? "#fff" : "transparent",
              borderRight: "1px solid #E2E8F0",
              borderBottom: isActive ? "2px solid #F97316" : "2px solid transparent",
              flexShrink: 0,
              transition: "background 0.15s",
              position: "relative",
            }}
          >
            {/* Invoice no */}
            <span
              style={{
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#F97316" : "#64748B",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {bill.invoiceNo}
            </span>

            {/* Close button — only show if more than 1 bill */}
            {bills.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeBill(bill.id);
                }}
                style={{
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#94A3B8",
                  padding: 0,
                  flexShrink: 0,
                  outline: "none",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#FEE2E2";
                  (e.currentTarget as HTMLButtonElement).style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
                }}
                title="Close bill"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}

      {/* New bill button */}
      <button
        onClick={addBill}
        title="Open new bill (Ctrl+T)"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          border: "none",
          borderRight: "1px solid #E2E8F0",
          background: "transparent",
          cursor: "pointer",
          color: "#64748B",
          flexShrink: 0,
          outline: "none",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E2E8F0"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
