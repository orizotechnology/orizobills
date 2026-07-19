// Recent Invoices — skeleton loading rows, exactly matching the screenshot

const COLS = ["Invoice No.", "Customer", "Date", "Amount", "Status", "Payment"];

// Each row has 6 skeleton bars with varied widths to look natural
const ROW_WIDTHS = [
  [72, 80, 58, 52, 60, 48],
  [68, 85, 62, 55, 58, 52],
  [75, 78, 55, 50, 65, 46],
  [70, 82, 60, 54, 56, 50],
  [65, 76, 57, 48, 62, 44],
];

function SkeletonRow({ widths }: { widths: number[] }) {
  return (
    <tr style={{ borderBottom: "1px solid #F8FAFC" }}>
      {widths.map((w, i) => (
        <td key={i} style={{ padding: "13px 16px" }}>
          <div
            style={{
              height: 11,
              borderRadius: 6,
              background: "#F1F5F9",
              width: `${w}%`,
              animation: "pulse 1.8s ease-in-out infinite",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function RecentInvoices() {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "18px 20px 12px" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Recent Invoices</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
              {COLS.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "0 16px 10px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#94A3B8",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_WIDTHS.map((widths, i) => (
              <SkeletonRow key={i} widths={widths} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px 16px",
          borderTop: "1px solid #F1F5F9",
          textAlign: "center",
        }}
      >
        <button
          style={{
            background: "none",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            color: "#F97316",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          View All Invoices
        </button>
      </div>

      {/* Keyframes for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
