import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, RefreshCw, Search, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { http } from "@/lib/axios";

// =============================================================
// PRODUCT TRANSFER PAGE
// Transfer stock quantities between products / branches.
// Internally this calls PUT /api/inventory/:productId/adjust
// to update the opening stock of the destination product.
// =============================================================

interface Product { id: string; name: string; code: string; unit: string; salePrice: number; isActive: boolean; }
interface InventoryItem { productId: string; currentStock: number; status: string; }
interface ApiResponse<T> { success: boolean; data: T; }

function fmtAmt(n: number) {
  const s = n.toFixed(2);
  return `₹${s.endsWith(".00") ? s.slice(0, -3) : s}`;
}

export default function ProductTransferPage() {
  const qc = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [fromId,     setFromId]     = useState("");
  const [toId,       setToId]       = useState("");
  const [qty,        setQty]        = useState("");
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [feedback,   setFeedback]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ["products-transfer"],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ data: Product[] }>>("/products?pageSize=999&filter=active");
      if (!res.success) throw new Error("Failed");
      return Array.isArray(res.data) ? res.data : (res.data as { data: Product[] }).data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: invData } = useQuery({
    queryKey: ["inventory-transfer"],
    queryFn: async () => {
      const res = await http.get<ApiResponse<{ items: InventoryItem[] }>>("/inventory");
      if (!res.success) return {};
      const map: Record<string, number> = {};
      res.data.items.forEach((i) => { map[i.productId] = i.currentStock; });
      return map;
    },
    staleTime: 30_000,
  });

  const products: Product[] = (prodData as Product[] | undefined) ?? [];
  const stockMap = invData ?? {};

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const fromProduct = products.find((p) => p.id === fromId);
  const toProduct   = products.find((p) => p.id === toId);
  const fromStock   = fromId ? (stockMap[fromId] ?? 0) : 0;
  const transferQty = parseFloat(qty) || 0;

  const canTransfer = fromId && toId && fromId !== toId && transferQty > 0 && transferQty <= fromStock;

  const handleTransfer = async () => {
    if (!canTransfer || !fromId || !toId) return;
    setLoading(true);
    try {
      const newFromStock = fromStock - transferQty;
      const toStock      = (stockMap[toId] ?? 0) + transferQty;

      await Promise.all([
        http.put(`/inventory/${fromId}/adjust`, { openingStock: newFromStock }),
        http.put(`/inventory/${toId}/adjust`,   { openingStock: toStock }),
      ]);

      setFeedback({ type: "success", msg: `Transferred ${transferQty} ${fromProduct?.unit ?? "units"} from ${fromProduct?.name} to ${toProduct?.name}` });
      qc.invalidateQueries({ queryKey: ["inventory-transfer"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setFromId(""); setToId(""); setQty(""); setNotes("");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Transfer failed" });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Product Transfer</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            Move stock quantity between products
          </div>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2",
              border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`,
              borderRadius: 10, padding: "12px 16px",
              fontSize: 13, fontWeight: 600,
              color: feedback.type === "success" ? "#16A34A" : "#EF4444",
            }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Transfer form */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowRightLeft size={16} color="#F97316" /> New Transfer
          </div>

          {/* From product */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>From Product</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={inp}>
              <option value="">Select source product…</option>
              {products.filter((p) => p.id !== toId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Stock: {stockMap[p.id] ?? 0} {p.unit}
                </option>
              ))}
            </select>
            {fromId && (
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                Current stock: <strong style={{ color: fromStock > 0 ? "#16A34A" : "#EF4444" }}>{fromStock}</strong> {fromProduct?.unit}
              </div>
            )}
          </div>

          {/* To product */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>To Product</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} style={inp}>
              <option value="">Select destination product…</option>
              {products.filter((p) => p.id !== fromId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Stock: {stockMap[p.id] ?? 0} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Quantity to Transfer</label>
            <input type="text" inputMode="decimal" value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              style={inp}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
            {fromId && transferQty > fromStock && (
              <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
                ⚠ Exceeds available stock ({fromStock})
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer…" rows={2}
              style={{ ...inp, resize: "none" }} />
          </div>

          {/* Preview */}
          {fromId && toId && transferQty > 0 && (
            <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px", marginBottom: 16,
              border: "1px solid #E2E8F0", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "#475569", marginBottom: 6 }}>Transfer Preview</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#64748B" }}>{fromProduct?.name}</span>
                <span style={{ color: "#EF4444", fontWeight: 700 }}>−{transferQty}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>{toProduct?.name}</span>
                <span style={{ color: "#22C55E", fontWeight: 700 }}>+{transferQty}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => void handleTransfer()}
            disabled={!canTransfer || loading}
            style={{
              width: "100%", padding: "10px 0", border: "none", borderRadius: 8,
              background: canTransfer && !loading ? "#F97316" : "#E2E8F0",
              color: canTransfer && !loading ? "#fff" : "#94A3B8",
              fontSize: 13, fontWeight: 700, cursor: canTransfer && !loading ? "pointer" : "not-allowed",
              fontFamily: "inherit", outline: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Transferring…</>
              : <><ArrowRightLeft size={14} /> Transfer Stock</>}
          </button>
        </div>

        {/* Product stock overview */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Product Stock</div>
            <div style={{ position: "relative", width: 200 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "5px 8px 5px 24px",
                  fontSize: 12, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
            </div>
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto", scrollbarWidth: "none" }}>
            {prodLoading && (
              <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
            )}
            {filtered.map((p) => {
              const stock = stockMap[p.id] ?? 0;
              const isFrom = p.id === fromId;
              const isTo   = p.id === toId;
              return (
                <div key={p.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 18px", borderBottom: "1px solid #F8FAFC",
                    background: isFrom ? "rgba(249,115,22,0.04)" : isTo ? "rgba(34,197,94,0.04)" : "transparent",
                  }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.code} · {p.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800,
                      color: stock <= 0 ? "#EF4444" : stock <= 5 ? "#EAB308" : "#16A34A" }}>
                      {stock}
                    </div>
                    {isFrom && <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700 }}>FROM</div>}
                    {isTo   && <div style={{ fontSize: 10, color: "#22C55E", fontWeight: 700 }}>TO</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const, transition: "border-color 0.15s" };
