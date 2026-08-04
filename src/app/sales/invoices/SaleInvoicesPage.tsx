import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, FileText, Trash2, RefreshCw, AlertTriangle, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/axios";

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  paymentMethod: string;
  totalAmt: number;
  paidAmt: number;
  balanceDue: number;
  status: string;
  itemCount: number;
}

interface ApiResponse<T> { success: boolean; data: T; }

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PAID:      { bg: "rgba(34,197,94,0.1)",    color: "#16A34A" },
  PARTIAL:   { bg: "rgba(234,179,8,0.1)",    color: "#A16207" },
  UNPAID:    { bg: "rgba(239,68,68,0.1)",    color: "#DC2626" },
  DRAFT:     { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
  CANCELLED: { bg: "rgba(148,163,184,0.12)", color: "#94A3B8" },
};

// =============================================================
// DELETE CONFIRMATION DIALOG
// =============================================================

interface DeleteDialogProps {
  invoice: SaleInvoice;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ invoice, isDeleting, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid #F1F5F9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(239,68,68,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <AlertCircle size={18} color="#EF4444" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>
              Delete Invoice
            </span>
          </div>
          {!isDeleting && (
            <button
              onClick={onCancel}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            Are you sure you want to delete this invoice?
          </p>

          {/* Invoice summary card */}
          <div style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <code style={{ fontSize: 13, fontWeight: 700, color: "#F97316", background: "rgba(249,115,22,0.08)", borderRadius: 5, padding: "2px 8px" }}>
                {invoice.invoiceNumber}
              </code>
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                background: STATUS_COLOR[invoice.status]?.bg ?? "#F1F5F9",
                color: STATUS_COLOR[invoice.status]?.color ?? "#64748B",
              }}>
                {invoice.status}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#64748B" }}>{invoice.customerName}</span>
              <span style={{ fontWeight: 700, color: "#0F172A" }}>₹{invoice.totalAmt.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              {new Date(invoice.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              {" · "}{invoice.paymentMethod}
              {" · "}{invoice.itemCount} item{invoice.itemCount !== 1 ? "s" : ""}
            </div>
          </div>

          <p style={{ margin: "0 0 20px", fontSize: 12, color: "#EF4444", fontWeight: 500 }}>
            ⚠ This will permanently remove the invoice and reverse inventory stock counts. This cannot be undone.
          </p>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              style={{
                flex: 1, padding: "10px 0",
                border: "1.5px solid #E2E8F0", borderRadius: 9,
                background: "#fff", color: "#475569",
                fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: isDeleting ? 0.5 : 1,
              }}
            >
              No, Keep It
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              style={{
                flex: 1, padding: "10px 0",
                border: "none", borderRadius: 9,
                background: isDeleting ? "#FCA5A5" : "#EF4444",
                color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: isDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              {isDeleting ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Deleting…
                </>
              ) : (
                <><Trash2 size={14} /> Yes, Delete</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================

export default function SaleInvoicesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SaleInvoice | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["sales", page],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: SaleInvoice[]; total: number }>>(`/sales?page=${page}&pageSize=20`);
      if (!res.success) throw new Error("Failed");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const invoices = (data?.data ?? []).filter((i) =>
    !search ||
    i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    i.customerName.toLowerCase().includes(search.toLowerCase())
  );
  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete<{ success: boolean }>(`/sales/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-sales"] });
      qc.invalidateQueries({ queryKey: ["recent-invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setDeleteTarget(null);
      toast.success("Invoice deleted successfully");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
      setDeleteTarget(null);
    },
  });

  const handleDeleteClick = (inv: SaleInvoice) => setDeleteTarget(inv);
  const handleDeleteConfirm = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); };
  const handleDeleteCancel  = () => { if (!deleteMutation.isPending) setDeleteTarget(null); };
  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["sales"], refetchType: "active" });
    await qc.invalidateQueries({ queryKey: ["dashboard-sales"], refetchType: "active" });
    await qc.invalidateQueries({ queryKey: ["recent-invoices"], refetchType: "active" });
    await qc.invalidateQueries({ queryKey: ["inventory"], refetchType: "active" });
    await qc.refetchQueries({ queryKey: ["sales"], type: "active" });
    await qc.refetchQueries({ queryKey: ["dashboard-sales"], type: "active" });
    await qc.refetchQueries({ queryKey: ["recent-invoices"], type: "active" });
    await qc.refetchQueries({ queryKey: ["inventory"], type: "active" });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Sale Invoices</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{total} invoice{total !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => { void handleRefresh(); }} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button type="button" onClick={() => navigate("/app/pos")} style={primaryBtn}><Plus size={15} /> New Invoice</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice or customer…"
            style={searchInput}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Invoice #", "Customer", "Date", "Payment", "Items", "Total", "Paid", "Balance", "Status", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} style={loadingCell}><Spinner /> Loading invoices…</td></tr>
            )}
            {isError && (
              <tr><td colSpan={10} style={errorCell}>
                <AlertTriangle size={20} color="#F97316" /> Could not load invoices. Is the backend running?
              </td></tr>
            )}
            {!isLoading && !isError && invoices.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: "64px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <FileText size={40} color="#E2E8F0" />
                    <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                      {search ? `No invoices matching "${search}"` : "No invoices yet"}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            <AnimatePresence initial={false}>
              {invoices.map((inv, idx) => {
                const sc = STATUS_COLOR[inv.status] ?? STATUS_COLOR.DRAFT;
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ borderBottom: idx < invoices.length - 1 ? "1px solid #F1F5F9" : "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}><code style={chip}>{inv.invoiceNumber}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{inv.customerName}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{inv.paymentMethod}</td>
                    <td style={{ ...tdStyle, color: "#64748B" }}>{inv.itemCount}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#0F172A" }}>₹{inv.totalAmt.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: "#22C55E" }}>₹{inv.paidAmt.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: inv.balanceDue > 0 ? "#EF4444" : "#94A3B8" }}>
                      {inv.balanceDue > 0 ? `₹${inv.balanceDue.toFixed(2)}` : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...badge, background: sc.bg, color: sc.color }}>{inv.status}</span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleDeleteClick(inv)}
                        style={rowIconBtn}
                        title="Delete invoice"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "#EF4444";
                          (e.currentTarget as HTMLButtonElement).style.background = "#FFF1F2";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1";
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              Page <strong>{page}</strong> of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            invoice={deleteTarget}
            isDeleting={deleteMutation.isPending}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const primaryBtn:  React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn:     React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const searchInput: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const thStyle:     React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle:     React.CSSProperties = { padding: "12px 14px", fontSize: 13 };
const chip:        React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const badge:       React.CSSProperties = { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px" };
const rowIconBtn:  React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#CBD5E1", display: "flex", alignItems: "center", justifyContent: "center" };
const paginationRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #F1F5F9" };
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: d ? "#F8FAFC" : "#fff", color: d ? "#CBD5E1" : "#475569", fontSize: 13, cursor: d ? "not-allowed" : "pointer", fontFamily: "inherit" });
const loadingCell: React.CSSProperties = {
  padding: "48px",
  textAlign: "center",
  color: "#94A3B8",
  fontSize: 13,
  display: "flex" as never,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
const errorCell: React.CSSProperties = {
  padding: "48px",
  textAlign: "center",
  color: "#EF4444",
  fontSize: 13,
  display: "flex" as never,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
const emptyCell: React.CSSProperties = {
  padding: "64px",
  textAlign: "center",
  display: "flex" as never,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
};

function Spinner() {
  return <div style={{ width: 20, height: 20, border: "2.5px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", marginRight: 8 }} />;
}
