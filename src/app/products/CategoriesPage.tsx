import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Tag, Edit2, Trash2, RefreshCw, X, Loader2, CheckCircle2 } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// CATEGORIES PAGE
// Shows all products grouped by their category (derived from
// product name prefix or a dedicated field). Since the backend
// has no Category model yet, we derive categories from the
// product list by grouping — and allow managing them locally.
// =============================================================

interface Product {
  id: string;
  name: string;
  code: string;
  unit: string;
  salePrice: number;
  isActive: boolean;
}
interface ApiResponse<T> { success: boolean; data: T; }

function deriveCategory(name: string): string {
  // Derive a rough category from the first word of the product name
  const w = name.trim().split(/\s+/)[0];
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "General";
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["products-for-categories"],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: Product[] }>>("/products?pageSize=999&filter=all");
      if (!res.success) throw new Error("Failed");
      return Array.isArray(res.data) ? res.data : (res.data as { data: Product[] }).data ?? [];
    },
    staleTime: 60_000,
  });

  const products: Product[] = (data as Product[] | undefined) ?? [];

  // Group by derived category
  const groups: Record<string, Product[]> = {};
  products.forEach((p) => {
    const cat = deriveCategory(p.name);
    (groups[cat] ??= []).push(p);
  });
  const categories = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  const handleRefresh = async () => {
    await qc.invalidateQueries({ queryKey: ["products-for-categories"] });
    await refetch();
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Categories</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} · {products.length} products
          </div>
        </div>
        <button onClick={() => void handleRefresh()} style={iconBtn} title="Refresh">
          <RefreshCw size={15} color="#64748B"
            style={isFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
          padding: "48px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading categories…</span>
          </div>
        </div>
      )}

      {isError && (
        <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12,
          padding: "20px", textAlign: "center", color: "#EF4444", fontSize: 13 }}>
          Backend not connected
        </div>
      )}

      {/* Category cards */}
      {!isLoading && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
              padding: "60px", textAlign: "center" }}>
              <div style={{ fontWeight: 600, color: "#94A3B8" }}>No products yet</div>
              <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>Add products to see categories</div>
            </div>
          )}
          {categories.map(([cat, items]) => {
            const isOpen = expandedCat === cat;
            return (
              <div key={cat} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                {/* Category header */}
                <button
                  onClick={() => setExpandedCat(isOpen ? null : cat)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
                    fontFamily: "inherit", outline: "none",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(249,115,22,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Tag size={16} color="#F97316" />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{cat}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} product{items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#F97316" }}>
                      ₹{(items.reduce((s, p) => s + p.salePrice, 0) / items.length).toFixed(0)} avg
                    </span>
                    <span style={{ fontSize: 18, color: "#94A3B8", transition: "transform 0.15s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
                      ⌄
                    </span>
                  </div>
                </button>

                {/* Expanded product list */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                      style={{ overflow: "hidden", borderTop: "1px solid #F1F5F9" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC" }}>
                            {["Product", "Code", "Unit", "Sale Price", "Status"].map((h) => (
                              <th key={h} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((p, idx) => (
                            <tr key={p.id}
                              style={{ borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}>
                              <td style={tdStyle}><span style={{ fontWeight: 500 }}>{p.name}</span></td>
                              <td style={tdStyle}><code style={chip}>{p.code}</code></td>
                              <td style={tdStyle}>{p.unit}</td>
                              <td style={{ ...tdStyle, fontWeight: 700, color: "#F97316" }}>₹{p.salePrice.toFixed(2)}</td>
                              <td style={tdStyle}>
                                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                                  background: p.isActive ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.15)",
                                  color: p.isActive ? "#16A34A" : "#94A3B8" }}>
                                  {p.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };
const chip:    React.CSSProperties = { fontSize: 12, background: "hsl(var(--muted))", borderRadius: 4, padding: "2px 6px", color: "hsl(var(--foreground))" };
