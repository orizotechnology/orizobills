import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Package, Edit2, Trash2,
  ScanLine, AlertTriangle, RefreshCw, Filter,
} from "lucide-react";
import { http } from "@/lib/axios";
import { ProductEditDialog } from "./components/ProductEditDialog";
import type { Product } from "./product.types";

export type { Product };

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

// ── Status filter options — All first ────────────────────────
const STATUS_FILTERS: { value: "all" | "active" | "inactive"; label: string }[] = [
  { value: "all",      label: "All"      },
  { value: "active",   label: "Active"   },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 25;

function useProducts(
  search: string, page: number, pageSize: number,
  filter: "all" | "active" | "inactive"
) {
  return useQuery({
    queryKey: ["products", search, page, pageSize, filter],
    queryFn: async () => {
      let url: string;
      if (search) {
        url = `/products?search=${encodeURIComponent(search)}`;
      } else {
        url = `/products?page=${page}&pageSize=${pageSize}&filter=${filter}`;
      }
      const res = await http.get<ApiResponse<{ data: Product[]; total: number } | Product[]>>(url);
      if (!res.success) throw new Error("Failed to load products");
      const raw = res.data;
      if (Array.isArray(raw)) return { data: raw, total: raw.length };
      return raw as { data: Product[]; total: number };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export default function ProductsPage() {
  const qc = useQueryClient();

  const [search,        setSearch]        = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [page,          setPage]          = useState(1);
  const [filter,        setFilter]        = useState<"all" | "active" | "inactive">("all");
  const [dialogProduct, setDialogProduct] = useState<Product | null | "new">(null);

  const { data, isLoading, isError, isFetching, refetch } =
    useProducts(debouncedSearch, page, PAGE_SIZE, filter);

  const allProducts = data?.data ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebounced(val);
      setPage(1);
    }, 320);
  };

  const handleFilterChange = (f: "all" | "active" | "inactive") => {
    setFilter(f);
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => http.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    setDialogProduct(null);
  };

  const handleRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
    await refetch();
  }, [qc, refetch]);

  // Active count for badge
  const activeCount   = allProducts.filter((p) => p.isActive).length;
  const inactiveCount = allProducts.filter((p) => !p.isActive).length;

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Products</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {isLoading ? "Loading…" : `${total} product${total !== 1 ? "s" : ""} in catalogue`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
            <RefreshCw size={15} color="#64748B"
              style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setDialogProduct("new")} style={primaryBtn}>
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* ── Toolbar: search + status filters ────────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
        padding: "12px 14px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <Search size={14} style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none",
          }} />
          <input
            type="text"
            placeholder="Search by name, code or barcode…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8,
              padding: "7px 12px 7px 32px", fontSize: 13, color: "#475569",
              background: "#F8FAFC", outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "#E2E8F0", flexShrink: 0 }} />

        {/* Status filter chips — All first */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} color="#94A3B8" />
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              style={{
                padding: "5px 13px", borderRadius: 6,
                border: filter === value ? "none" : "1px solid #E2E8F0",
                background: filter === value ? "#F97316" : "#fff",
                color:      filter === value ? "#fff"    : "#64748B",
                fontWeight: filter === value ? 700       : 500,
                fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
                transition: "all 0.12s",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Showing count */}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap" }}>
          Showing <strong style={{ color: "#0F172A" }}>{allProducts.length}</strong>
          {!search && total > PAGE_SIZE && ` of ${total}`}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {[
                  { label: "Product",    w: "220px" },
                  { label: "Code",       w: "100px" },
                  { label: "Barcode",    w: "120px" },
                  { label: "MRP (₹)",    w: "90px"  },
                  { label: "Sale Price", w: "100px" },
                  { label: "Tax %",      w: "70px"  },
                  { label: "Unit",       w: "70px"  },
                  { label: "Status",     w: "80px"  },
                  { label: "",           w: "72px"  },
                ].map((h) => (
                  <th key={h.label} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "#64748B",
                    letterSpacing: "0.04em", whiteSpace: "nowrap", width: h.w,
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Loading */}
              {isLoading && (
                <tr><td colSpan={9} style={{ padding: "48px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 24, height: 24, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading products…</span>
                  </div>
                </td></tr>
              )}

              {/* Error */}
              {isError && !isLoading && (
                <tr><td colSpan={9} style={{ padding: "48px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={24} color="#F97316" />
                    <div style={{ fontSize: 13, color: "#64748B" }}>Could not load products. Is the backend running?</div>
                    <button onClick={() => void handleRefresh()} style={{ ...primaryBtn, marginTop: 4 }}>Retry</button>
                  </div>
                </td></tr>
              )}

              {/* Empty */}
              {!isLoading && !isError && allProducts.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "64px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Package size={44} color="#E2E8F0" />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>
                      {search ? `No products matching "${search}"` : "No products yet"}
                    </div>
                    {!search && (
                      <button onClick={() => setDialogProduct("new")} style={primaryBtn}>
                        <Plus size={14} /> Add your first product
                      </button>
                    )}
                    {search && (
                      <button onClick={() => { setSearch(""); setDebounced(""); }}
                        style={{ fontSize: 12, color: "#F97316", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        Clear search
                      </button>
                    )}
                  </div>
                </td></tr>
              )}

              {/* Rows */}
              <AnimatePresence initial={false}>
                {allProducts.map((p, idx) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      borderBottom: idx < allProducts.length - 1 ? "1px solid #F1F5F9" : "none",
                      opacity: p.isActive ? 1 : 0.55,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    {/* Product name */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1E293B" }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                          {p.description}
                        </div>
                      )}
                    </td>

                    {/* Code */}
                    <td style={{ padding: "12px 14px" }}>
                      <code style={{ fontSize: 12, color: "#475569", background: "#F1F5F9", borderRadius: 4, padding: "2px 6px" }}>
                        {p.code}
                      </code>
                    </td>

                    {/* Barcode */}
                    <td style={{ padding: "12px 14px" }}>
                      {p.barcode ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <ScanLine size={11} color="#F97316" />
                          <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{p.barcode}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#CBD5E1" }}>—</span>
                      )}
                    </td>

                    {/* MRP */}
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748B" }}>
                      ₹{p.mrp.toFixed(2)}
                    </td>

                    {/* Sale price */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>
                        ₹{p.salePrice.toFixed(2)}
                      </span>
                    </td>

                    {/* Tax */}
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748B" }}>
                      {p.taxPct > 0 ? `${p.taxPct}%` : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>

                    {/* Unit */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", background: "#F1F5F9", borderRadius: 4, padding: "2px 7px" }}>
                        {p.unit}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                        background: p.isActive ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.15)",
                        color:      p.isActive ? "#16A34A"              : "#94A3B8",
                      }}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => setDialogProduct(p)} style={rowIconBtn} title="Edit"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteMutation.mutate(p.id)} style={{ ...rowIconBtn, color: "#CBD5E1" }} title="Delete"
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
        </div>

        {/* Pagination */}
        {!search && totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px", borderTop: "1px solid #F1F5F9", fontSize: 13, color: "#64748B" }}>
            <span>Page <strong style={{ color: "#0F172A" }}>{page}</strong> of {totalPages} · {total} total</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pgBtn(page <= 1)}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pgBtn(page >= totalPages)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit / Add Dialog */}
      <AnimatePresence>
        {dialogProduct !== null && (
          <ProductEditDialog
            product={dialogProduct === "new" ? null : dialogProduct}
            onClose={() => setDialogProduct(null)}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  background: "#F97316", color: "#fff",
  border: "none", borderRadius: 8, padding: "9px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", outline: "none",
};

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8,
  border: "1px solid #E2E8F0", background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", outline: "none",
};

const rowIconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7,
  border: "none", background: "transparent", color: "#64748B",
  cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
  outline: "none",
};

const pgBtn = (d: boolean): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: 7,
  border: "1px solid #E2E8F0",
  background: d ? "#F8FAFC" : "#fff",
  color: d ? "#CBD5E1" : "#475569",
  fontSize: 13, cursor: d ? "not-allowed" : "pointer",
  fontFamily: "inherit",
});
