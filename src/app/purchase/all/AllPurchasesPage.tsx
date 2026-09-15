import { useState, useMemo } from "react";
import {useQuery,useMutation,useQueryClient,} from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {Plus,Search,RefreshCw,AlertTriangle,ShoppingCart,Trash2,X,Download,ArrowUpDown,ArrowUp,ArrowDown,} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { http } from "@/lib/axios";
import { useDialogKeyboard } from "@/hooks";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  billDate: string;
  paymentMethod: string;
  subtotal: number;
  discountAmt: number;
  taxAmt: number;
  totalAmt: number;
  status: string;
  itemCount: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  CONFIRMED: { bg: "rgba(34,197,94,0.1)", color: "#16A34A" },
  DRAFT: { bg: "rgba(148,163,184,0.12)", color: "#64748B" },
  CANCELLED: { bg: "rgba(239,68,68,0.1)", color: "#DC2626" },
};

const STATUS_FILTERS = ["ALL", "DRAFT", "CONFIRMED", "CANCELLED"];

type SortKey = "billDate" | "totalAmt" | null;
type SortDir = "asc" | "desc";

function toCsvStr(d: Date) { return d.toISOString().slice(0, 10); }

function exportCsv(purchases: PurchaseInvoice[]) {
  const header = ["Bill #", "Supplier", "Date", "Payment", "Items", "Subtotal", "Tax", "Total", "Status"];
  const rows = purchases.map((p) => [
    p.invoiceNumber,
    p.supplierName,
    p.billDate,
    p.paymentMethod,
    String(p.itemCount),
    p.subtotal.toFixed(2),
    p.taxAmt.toFixed(2),
    p.totalAmt.toFixed(2),
    p.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchases-${toCsvStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================
// DELETE CONFIRMATION DIALOG
// =============================================================

function DeleteConfirmDialog({
  purchase,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  purchase: PurchaseInvoice;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useDialogKeyboard({ isOpen: true, onConfirm, onCancel, disabled: isDeleting });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(239,68,68,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={17} color="#EF4444" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>
              Delete Purchase
            </span>
          </div>

          {!isDeleting && (
            <button
              onClick={onCancel}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94A3B8",
                padding: 4,
                display: "flex",
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: "20px 22px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            Are you sure you want to delete this purchase bill?
          </p>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <code
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F97316",
                  background: "rgba(249,115,22,0.08)",
                  borderRadius: 5,
                  padding: "2px 8px",
                }}
              >
                {purchase.invoiceNumber}
              </code>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 20,
                  padding: "3px 10px",
                  background: STATUS_COLOR[purchase.status]?.bg ?? "#F1F5F9",
                  color: STATUS_COLOR[purchase.status]?.color ?? "#64748B",
                }}
              >
                {purchase.status}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#64748B" }}>{purchase.supplierName}</span>
              <span style={{ fontWeight: 700, color: "#0F172A" }}>
                ₹{purchase.totalAmt.toFixed(2)}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              {new Date(purchase.billDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              {" · "}
              {purchase.paymentMethod}
              {" · "}
              {purchase.itemCount} item{purchase.itemCount !== 1 ? "s" : ""}
            </div>
          </div>

          <p style={{ margin: "0 0 20px", fontSize: 12, color: "#EF4444", fontWeight: 500 }}>
            ⚠ This will permanently remove the purchase and reverse
            inventory stock counts. This cannot be undone.
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "1.5px solid #E2E8F0",
                borderRadius: 9,
                background: "#fff",
                color: "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: isDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              No, Keep It
            </button>

            <button
              onClick={onConfirm}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: "10px 0",
                border: "none",
                borderRadius: 9,
                background: isDeleting ? "#FCA5A5" : "#EF4444",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: isDeleting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              {isDeleting ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Yes, Delete
                </>
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

export default function AllPurchasesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [statusF, setStatusF] = useState("ALL");
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebSearch(val), 320);
  };

  const FILTERS = ["All", "This Month", "Today"];

  function toStr(d: Date) { return d.toISOString().slice(0, 10); }
  const dateRange = (() => {
    const now = new Date();
    const today = toStr(now);
    if (filter === "All") return { start: "", end: "" };
    if (filter === "Custom") return { start: fromDate, end: toDate };
    if (filter === "Today") return { start: today, end: today };
    if (filter === "This Week") {
      const mon = new Date(now);
      mon.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      return { start: toStr(mon), end: today };
    }
    if (filter === "This Month") {
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: today };
    }
    return { start: "", end: "" };
  })();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["purchases", page, dateRange.start, dateRange.end, debSearch],
    queryFn: async () => {
      let url = `/purchases?page=${page}&pageSize=50`;
      if (dateRange.start && dateRange.end)
        url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      if (debSearch.trim())
        url += `&search=${encodeURIComponent(debSearch.trim())}`;
      const res = await http.get<ApiResponse<{ data: PurchaseInvoice[]; total: number }>>(url);
      if (!res.success) throw new Error("Failed to load purchases");
      return res.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allPurchases = data?.data ?? [];
  const statusFiltered = statusF === "ALL" ? allPurchases : allPurchases.filter((p) => p.status === statusF);

  const purchases = useMemo(() => {
    if (!sortKey) return statusFiltered;
    const arr = [...statusFiltered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "billDate") cmp = new Date(a.billDate).getTime() - new Date(b.billDate).getTime();
      else if (sortKey === "totalAmt") cmp = a.totalAmt - b.totalAmt;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [statusFiltered, sortKey, sortDir]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const sumTotal = purchases.reduce((s, p) => s + p.totalAmt, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDir === "asc" ? <ArrowUp size={12} color="#F97316" /> : <ArrowDown size={12} color="#F97316" />;
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete<{ success: boolean }>(`/purchases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-purchases"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setDeleteTarget(null);
      toast.success("Purchase deleted successfully");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete purchase");
      setDeleteTarget(null);
    },
  });

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["purchases"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-purchases"] });
    await qc.invalidateQueries({ queryKey: ["inventory"] });
    await refetch();
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "24px 28px",
        background: "#F8FAFC",
        boxSizing: "border-box",
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>All Purchases</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {total} purchase bill{total !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => purchases.length && exportCsv(purchases)}
            style={iconBtn}
            title="Export CSV"
            disabled={!purchases.length}
          >
            <Download size={15} color={purchases.length ? "#64748B" : "#CBD5E1"} />
          </button>

          <button type="button" onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw
              size={15}
              color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined}
            />
          </button>

          <button type="button" onClick={() => navigate("/app/purchase/new")} style={primaryBtn}>
            <Plus size={15} />
            New Purchase
          </button>
        </div>
      </div>

      {/* SEARCH + FILTERS */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: 10,
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={15}
              color="#94A3B8"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search purchase or supplier..."
              style={{
                width: "100%",
                border: "1.5px solid #E2E8F0",
                borderRadius: 7,
                padding: "8px 10px 8px 30px",
                fontSize: 13,
                color: "#475569",
                background: "#F8FAFC",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((item) => {
              const active = filter === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleFilterChange(item)}
                  style={{
                    border: active ? "none" : "1px solid #E2E8F0",
                    background: active ? "#F97316" : "#fff",
                    color: active ? "#fff" : "#64748B",
                    borderRadius: 7,
                    padding: "7px 13px",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {filter === "Custom" && (
            <>
              <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500, whiteSpace: "nowrap" }}>From</span>
                <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} style={dateInp} />
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>To</span>
                <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} style={dateInp} />
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            paddingTop: 8,
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>STATUS</span>
          {STATUS_FILTERS.map((s) => {
            const active = statusF === s;
            const sc = STATUS_COLOR[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setStatusF(s); setPage(1); }}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: active ? "none" : "1px solid #E2E8F0",
                  background: active ? (sc?.bg ?? "#F97316") : "#fff",
                  color: active ? (sc?.color ?? "#fff") : "#64748B",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                {s === "ALL" ? "All" : s}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUMMARY STRIP */}
      {purchases.length > 0 && (
        <div
          style={{
            background: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 10,
            padding: "10px 18px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {purchases.length} bill{purchases.length !== 1 ? "s" : ""} shown
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#F97316" }}>
            ₹{sumTotal.toFixed(2)}
          </span>
        </div>
      )}

      {/* TABLE */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, width: "100%", overflowX: "auto", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={thStyle}>Bill #</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>
                  <button style={sortHeaderBtn} onClick={() => handleSort("billDate")}>
                    Date <SortIcon col="billDate" />
                  </button>
                </th>
                <th style={thStyle}>Payment</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Items</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Tax</th>
                <th style={{ ...thStyle, textAlign: "right" }}>
                  <button style={{ ...sortHeaderBtn, marginLeft: "auto" }} onClick={() => handleSort("totalAmt")}>
                    Total <SortIcon col="totalAmt" />
                  </button>
                </th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}></th>
              </tr>
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 4,
                            background: "#F1F5F9",
                            animation: "pulse 1.4s ease-in-out infinite",
                            width: j === 1 ? "70%" : j === 8 ? "50%" : "60%",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {isError && (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                      <AlertTriangle size={18} />
                      Backend not connected
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && purchases.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 64, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShoppingCart size={20} color="#94A3B8" />
                      </div>

                      <div style={{ fontWeight: 600, color: "#94A3B8" }}>
                        {search ? "No matching purchases" : "No purchases yet"}
                      </div>

                      {(statusF !== "ALL" || filter !== "All") && (
                        <button
                          type="button"
                          onClick={() => { setStatusF("ALL"); setFilter("All"); setPage(1); }}
                          style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Clear filters
                        </button>
                      )}

                      {!search && statusF === "ALL" && filter === "All" && (
                        <button type="button" onClick={() => navigate("/app/purchase/new")} style={{ ...primaryBtn, marginTop: 4 }}>
                          <Plus size={14} />
                          Create first purchase
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              <AnimatePresence initial={false}>
                {!isLoading &&
                  !isError &&
                  purchases.map((purchase, index) => {
                    const statusColor = STATUS_COLOR[purchase.status] ?? STATUS_COLOR.DRAFT;

                    return (
                      <motion.tr
                        key={purchase.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          borderBottom: index < purchases.length - 1 ? "1px solid #F1F5F9" : "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#FAFAFA"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={tdStyle}>
                          <code style={chip}>{purchase.invoiceNumber}</code>
                        </td>

                        <td style={{ ...tdStyle, fontWeight: 500 }}>{purchase.supplierName}</td>

                        <td style={{ ...tdStyle, color: "#64748B" }}>
                          {new Date(purchase.billDate).toLocaleDateString("en-IN")}
                        </td>

                        <td style={{ ...tdStyle, color: "#64748B" }}>{purchase.paymentMethod}</td>

                        <td style={{ ...tdStyle, color: "#64748B", textAlign: "center" }}>{purchase.itemCount}</td>

                        <td style={{ ...tdStyle, color: "#475569", textAlign: "right" }}>
                          ₹{purchase.subtotal.toFixed(2)}
                        </td>

                        <td style={{ ...tdStyle, color: "#64748B", textAlign: "right" }}>
                          ₹{purchase.taxAmt.toFixed(2)}
                        </td>

                        <td style={{ ...tdStyle, fontWeight: 700, color: "#0F172A", textAlign: "right" }}>
                          ₹{purchase.totalAmt.toFixed(2)}
                        </td>

                        <td style={tdStyle}>
                          <span style={{ ...badge, background: statusColor.bg, color: statusColor.color }}>
                            {purchase.status}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(purchase);
                            }}
                            style={rowIconBtn}
                            title="Delete purchase"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#EF4444";
                              e.currentTarget.style.background = "#FFF1F2";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#CBD5E1";
                              e.currentTarget.style.background = "transparent";
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
        </div>

        {totalPages > 1 && (
          <div style={paginationRow}>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              Page <strong>{page}</strong> of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} style={pgBtn(page <= 1)}>
                ← Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                style={pgBtn(page >= totalPages)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            purchase={deleteTarget}
            isDeleting={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
            onCancel={() => {
              if (!deleteMutation.isPending) {
                setDeleteTarget(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </div>
  );
}

// =============================================================
// STYLES
// =============================================================

const primaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#F97316",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748B",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const sortHeaderBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "inherit",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.04em",
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const chip: React.CSSProperties = {
  fontSize: 12,
  background: "#F1F5F9",
  borderRadius: 4,
  padding: "2px 6px",
  color: "#475569",
};

const badge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 20,
  padding: "3px 10px",
};

const rowIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#CBD5E1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const paginationRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 18px",
  borderTop: "1px solid #F1F5F9",
};

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 7,
  border: "1px solid #E2E8F0",
  background: disabled ? "#F8FAFC" : "#fff",
  color: disabled ? "#CBD5E1" : "#475569",
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
});

const dateInp: React.CSSProperties = {
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  color: "#1E293B",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};