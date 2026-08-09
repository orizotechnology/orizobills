import { useState, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Users, Edit2, Trash2, RefreshCw, AlertTriangle, X, Loader2, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";
import { useInfiniteScroll } from "@/hooks";

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; gstin: string | null; balance: number;
  isActive: boolean; createdAt: string;
}
interface ApiResponse<T> { success: boolean; data: T; }

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [dialog, setDialog] = useState<Customer | null | "new">(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebSearch(val), 320);
  };

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage,
    isLoading, isError, isFetching, refetch,
  } = useInfiniteQuery({
    queryKey: ["customers", debSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const url = debSearch
        ? `/customers?search=${encodeURIComponent(debSearch)}&page=${pageParam}&pageSize=${PAGE_SIZE}`
        : `/customers?page=${pageParam}&pageSize=${PAGE_SIZE}`;
      const res = await http.get<ApiResponse<{ data: Customer[]; total: number }>>(url);
      if (!res.success) throw new Error("Failed");
      return { ...res.data, page: pageParam as number };
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * PAGE_SIZE;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const customers = data?.pages.flatMap((p) => p.data) ?? [];
  const total     = data?.pages[0]?.total ?? 0;

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); },
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  const onSaved = () => { qc.invalidateQueries({ queryKey: ["customers"] }); setDialog(null); };

  const handleRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["customers"], refetchType: "active" });
    await refetch();
  }, [qc, refetch]);

  return (
    <div style={{ padding: "24px 28px", height: "100%", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Customers</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {isLoading ? "Loading…" : `${total} customer${total !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void handleRefresh()} style={iconBtn}>
            <RefreshCw size={15} color="#64748B" style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setDialog("new")} style={primaryBtn}><Plus size={15} /> Add Customer</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "10px 14px", marginBottom: 14, flexShrink: 0 }}>
        <div style={{ position: "relative", maxWidth: 340 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by name, phone, email…"
            style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 7, padding: "7px 10px 7px 28px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
        </div>
      </div>

      {/* Scrollable table */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Name","Phone","Email","Address","GSTIN","Balance",""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={centeredCell}>
              <Loader2 size={20} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} />
            </td></tr>}
            {isError && <tr><td colSpan={7} style={{ ...centeredCell, color: "#EF4444" }}>
              <AlertTriangle size={18} /> Backend not connected
            </td></tr>}
            {!isLoading && !isError && customers.length === 0 && (
              <tr><td colSpan={7} style={centeredCell}>
                <Users size={40} color="#E2E8F0" />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94A3B8" }}>
                  {debSearch ? `No customers matching "${debSearch}"` : "No customers yet"}
                </div>
              </td></tr>
            )}
            <AnimatePresence initial={false}>
              {customers.map((c, idx) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ borderBottom: idx < customers.length - 1 ? "1px solid #F1F5F9" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{c.phone ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{c.email ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "#94A3B8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address ?? "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748B" }}>{c.gstin ?? "—"}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: c.balance > 0 ? "#EF4444" : c.balance < 0 ? "#22C55E" : "#94A3B8" }}>
                    {c.balance !== 0 ? `₹${Math.abs(c.balance).toFixed(2)}${c.balance > 0 ? " DR" : " CR"}` : "—"}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setDialog(c)} style={rowIconBtn} title="Edit"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(c.id)} style={{ ...rowIconBtn, color: "#CBD5E1" }} title="Delete"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF1F2"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {isFetchingNextPage && (
          <div style={{ padding: "14px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#94A3B8", fontSize: 13 }}>
            <Loader2 size={16} color="#F97316" style={{ animation: "spin 0.7s linear infinite" }} /> Loading more…
          </div>
        )}
        {!hasNextPage && customers.length > 0 && (
          <div style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#CBD5E1" }}>
            All {total} customers loaded
          </div>
        )}
      </div>

      <AnimatePresence>
        {dialog !== null && (
          <CustomerDialog customer={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} onSaved={onSaved} />
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
