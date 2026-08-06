import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, RotateCcw } from "lucide-react";
import { http } from "@/lib/axios";

interface SaleReturn {
  id: string;
  returnNumber: string;
  customerName: string;
  returnDate: string;
  totalAmt: number;
  status: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

export default function SaleReturnPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sale-returns", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: SaleReturn[]; total: number }>>(`/sales/returns?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const returns = data?.data ?? [];
  console.log("API Data:", data);
console.log("Returns:", returns);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleRefresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sale-returns"], refetchType: "active" }),
      qc.invalidateQueries({ queryKey: ["inventory"], refetchType: "active" }),
      qc.refetchQueries({ queryKey: ["sale-returns"], type: "active" }),
      qc.refetchQueries({ queryKey: ["inventory"], type: "active" }),
    ]);
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>
     <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 11,
    borderBottom: "1px solid #E5E7EB",
    marginBottom: 18,
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: 18,
      fontWeight: 700,
      color: "#01040f",
    }}
  >
    Sale Returns
  </h2>

  <div style={{ display: "flex", gap: 10 }}>
    <button
      style={{
        background: "#2563EB",
        color: "#fff",
        border: "none",
        borderRadius: 18,
        padding: "8px 18px",
        height: 36,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      + New Return
    </button>

    <button
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "none",
        background: "#FEE2E2",
        color: "#EF4444",
        fontSize: 18,
        cursor: "pointer",
      }}
    >
      ✕
    </button>
  </div>
</div> 

{/* Filters */}
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 20,
    borderBottom: "1px solid #E5E7EB",
  }}
>
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <span style={{ fontSize: 13 }}>From</span>

    <input
      type="date"
      style={{
        width: 125,
        height: 32,
        border: "1px solid #D1D5DB",
        borderRadius: 6,
        padding: "0 10px",
        fontSize: 13,
      }}
    />

    <span style={{ fontSize: 13 }}>To</span>

    <input
      type="date"
      style={{
        width: 125,
        height: 32,
        border: "1px solid #D1D5DB",
        borderRadius: 6,
        padding: "0 10px",
        fontSize: 13,
      }}
    />
  </div>

  <input
    type="text"
    placeholder="Search by party..."
    style={{
      width: 220,
      height: 36,
      border: "1px solid #D1D5DB",
      borderRadius: 6,
      padding: "0 12px",
      fontSize: 13,
    }}
  />
</div>

{/* Summary Card */}
<div
  style={{
    width: 280,
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    padding: 20,
    marginBottom: 20,
  }}
>
  <div style={{ color: "#64748B", fontSize: 14 }}>
    Total Returns
  </div>

  <div
    style={{
      fontSize: 22,
      fontWeight: 700,
      color: "#1E3A8A",
      marginTop: 8,
    }}
  >
    ₹0
  </div>

  <div style={{ marginTop: 10, fontSize: 15 }}>
    Count: <b>{total}</b>
  </div>
</div>

<div
  style={{
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
    minHeight:220,
  }}
>


        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
             {["Date", "Return No", "Party", "Items", "Amount", "Status"].map((h) => ( 
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>}
            {isError && <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#EF4444" }}><AlertTriangle size={18} /> Backend not connected</td></tr>}
            {!isLoading && !isError && returns.length === 0 && (
             <tr>
  <td
    colSpan={6}
    style={{
      height: "180px",
      textAlign: "center",
      verticalAlign: "middle",
      color: "#64748B",
      fontSize: 15,
      fontWeight: 500,
    }}
  >
    No returns found. Click <b>"+ New Return"</b> to add one.
  </td>
</tr> 
            )}
            <AnimatePresence initial={false}>
              {returns.map((r, idx) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < returns.length - 1 ? "1px solid #F1F5F9" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={tdStyle}>
  {new Date(r.returnDate).toLocaleDateString("en-IN")}
</td>

<td style={tdStyle}>
  <code style={chip}>{r.returnNumber}</code>
</td>

<td style={tdStyle}>
  {r.customerName}
</td>

<td style={tdStyle}>
  1
</td>

<td style={tdStyle}>
  ₹{r.totalAmt.toFixed(2)}
</td>

<td style={tdStyle}>
  <span>Completed</span>
</td>
                </motion.tr>

              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>Page <strong>{page}</strong> of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip: React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer" });
