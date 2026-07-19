import { Banknote, Layers, CreditCard, Split } from "lucide-react";

interface BillSummaryProps {
  mrpTotal: number;
  subTotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  paidAmount: string;
  onPaidAmountChange: (v: string) => void;
  paymentMode: "Cash" | "UPI" | "Card" | "Split";
  onPaymentModeChange: (m: "Cash" | "UPI" | "Card" | "Split") => void;
}

function fmt(n: number) {
  return `₹${n.toFixed(2)}`;
}

export function BillSummary({
  mrpTotal, subTotal, discount, taxableAmount,
  cgst, sgst, totalAmount,
  paidAmount, onPaidAmountChange,
  paymentMode, onPaymentModeChange,
}: BillSummaryProps) {
  const paid = parseFloat(paidAmount) || 0;
  const change = Math.max(0, paid - totalAmount);

  const modes: { key: "Cash" | "UPI" | "Card" | "Split"; label: string; icon: React.ReactNode }[] = [
    { key: "Cash",  label: "Cash",  icon: <Banknote size={16} strokeWidth={1.6} /> },
    { key: "UPI",   label: "UPI",   icon: <Layers size={16} strokeWidth={1.6} /> },
    { key: "Card",  label: "Card",  icon: <CreditCard size={16} strokeWidth={1.6} /> },
    { key: "Split", label: "Split", icon: <Split size={16} strokeWidth={1.6} /> },
  ];

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: "#fff", borderLeft: "1px solid #E2E8F0",
      display: "flex", flexDirection: "column",
      fontSize: 13,
    }}>
      {/* Add Product button */}
      <div style={{ padding: "10px 12px 8px" }}>
        <button style={{
          width: "100%", background: "#F97316", color: "#fff",
          border: "none", borderRadius: 8, padding: "9px 0",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6, outline: "none",
        }}>
          + Add New Product to Bill
        </button>
      </div>

      {/* Bill Summary */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid #F1F5F9" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 10 }}>
          Bill Summary
        </div>
        {[
          { label: "MRP Total",      value: fmt(mrpTotal),      color: "#1E293B" },
          { label: "Sub Total",      value: fmt(subTotal),      color: "#1E293B" },
          { label: "Discount",       value: fmt(discount),      color: "#EF4444" },
          { label: "Taxable Amount", value: fmt(taxableAmount), color: "#1E293B" },
          { label: "CGST",           value: fmt(cgst),          color: "#1E293B" },
          { label: "SGST",           value: fmt(sgst),          color: "#1E293B" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 6,
          }}>
            <span style={{ color: "#64748B", fontSize: 12 }}>{label}</span>
            <span style={{ fontWeight: 500, color, fontSize: 12 }}>{value}</span>
          </div>
        ))}

        {/* Total */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          borderTop: "1px solid #F1F5F9", paddingTop: 8, marginTop: 4,
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>Total Amount</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#F97316" }}>
            {fmt(totalAmount)}
          </span>
        </div>
      </div>

      {/* Payment mode */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 10 }}>
          Payment
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {modes.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => onPaymentModeChange(key)}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
                padding: "8px 4px",
                border: `1.5px solid ${paymentMode === key ? "#F97316" : "#E2E8F0"}`,
                borderRadius: 10,
                background: paymentMode === key ? "#F97316" : "#fff",
                color: paymentMode === key ? "#fff" : "#64748B",
                cursor: "pointer", outline: "none",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {icon}
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Paid amount */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>Paid Amount</div>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => onPaidAmountChange(e.target.value)}
            style={{
              width: "100%", border: "1.5px solid #E2E8F0",
              borderRadius: 8, padding: "8px 10px",
              fontSize: 14, fontWeight: 600, color: "#1E293B",
              outline: "none", fontFamily: "inherit",
              background: "#F8FAFC",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
          />
        </div>

        {/* Change */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: 10,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#0F172A" }}>Change</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#F97316" }}>
            {fmt(change)}
          </span>
        </div>
      </div>
    </div>
  );
}
