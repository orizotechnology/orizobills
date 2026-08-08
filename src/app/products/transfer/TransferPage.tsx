import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Search, CheckCircle2, Loader2, AlertTriangle, Building2 } from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// TRANSFER PAGE — create an inter-branch stock transfer
// =============================================================

interface Branch  { id: string; name: string; }
interface Product { id: string; name: string; code: string; unit: string; salePrice: number; }
interface InventoryItem { productId: string; currentStock: number; status: string; }
interface ApiResponse<T> { success: boolean; data: T; }

export default function TransferPage() {
  const qc = useQueryClient();
  const { getActiveBranch } = useBranchStore();
  const activeBranch = getActiveBranch();

  const [toBranchId,  setToBranchId]  = useState("");
  const [productId,   setProductId]   = useState("");
  const [qty,         setQty]         = useState("");
  const [notes,       setNotes]       = useState("");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [feedback,    setFeedback]    = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Fetch other branches
  const { data: branchData } = useQuery({
    queryKey: ["transfer-branches"],
    queryFn:  () => http.get<ApiResponse<Branch[]>>("/transfers/branches"),
    staleTime: 60_000,
  });
  const branches: Branch[] = branchData?.data ?? [];

  // Fetch products
  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ["products-for-transfer"],
    queryFn:  async () => {
      const res = await http.get<ApiResponse<{ data: Product[] }>>("/products?pageSize=999&filter=active");
      if (!res.success) throw new Error("Failed");
      return Array.isArray(res.data) ? res.data : (res.data as { data: Product[] }).data ?? [];
    },
    staleTime: 60_000,
  });
  const products: Product[] = (prodData as Product[] | undefined) ?? [];

  // Fetch inventory stock map
  const { data: invData } = useQuery({
    queryKey: ["inventory-for-transfer"],
    queryFn:  async () => {
      const res = await http.get<ApiResponse<{ items: InventoryItem[] }>>("/inventory");
      if (!res.success) return {} as Record<string, number>;
      const map: Record<string, number> = {};
      res.data.items.forEach((i) => { map[i.productId] = i.currentStock; });
      return map;
    },
    staleTime: 30_000,
  });
  const stockMap = invData ?? {};

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedBranch  = branches.find((b) => b.id === toBranchId);
  const availableStock  = productId ? (stockMap[productId] ?? 0) : 0;
  const transferQty     = parseFloat(qty) || 0;
  const canTransfer     = toBranchId && productId && transferQty > 0 && transferQty <= availableStock;

  const handleTransfer = async () => {
    if (!canTransfer || !selectedProduct || !selectedBranch) return;
    setLoading(true);
    try {
      const res = await http.post<{ success: boolean; data: { transferRef: string } }>("/transfers", {
        toBranchId,
        toBranchName:  selectedBranch.name,
        productId:     selectedProduct.id,
        productName:   selectedProduct.name,
        productCode:   selectedProduct.code,
        quantity:      transferQty,
        unit:          selectedProduct.unit,
        notes:         notes || undefined,
      });
      if (res.success) {
        setFeedback({ type: "success", msg: `Transferred ${transferQty} ${selectedProduct.unit} of "${selectedProduct.name}" to ${selectedBranch.name}` });
        qc.invalidateQueries({ queryKey: ["inventory-for-transfer"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
        qc.invalidateQueries({ queryKey: ["transfers-sent"] });
        setProductId(""); setToBranchId(""); setQty(""); setNotes("");
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({ type: "error", msg: "Transfer failed." });
      }
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Transfer failed" });
      setTimeout(() => setFeedback(null), 4000);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Product Transfer</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
          Transfer stock from <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "this branch"}</strong> to another branch
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
              borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600,
              color: feedback.type === "success" ? "#16A34A" : "#EF4444",
            }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {branches.length === 0 && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10,
          padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#92400E",
          display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 size={16} /> No other branches found. Add branches from the Branch settings to enable transfers.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* ── Transfer form ─────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowRightLeft size={16} color="#F97316" /> New Transfer
          </div>

          {/* Destination branch */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Transfer To Branch</label>
            <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} style={inp}>
              <option value="">Select destination branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Product */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inp}>
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) — Stock: {stockMap[p.id] ?? 0} {p.unit}
                </option>
              ))}
            </select>
            {productId && (
              <div style={{ fontSize: 12, marginTop: 4, color: availableStock > 0 ? "#16A34A" : "#EF4444", fontWeight: 600 }}>
                Available: {availableStock} {selectedProduct?.unit}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Quantity</label>
            <input type="number" min={0.001} step={1} value={qty}
              onChange={(e) => setQty(e.target.value)} placeholder="0" style={inp}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }} />
            {productId && transferQty > availableStock && (
              <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
                ⚠ Exceeds available stock ({availableStock})
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason or reference…" rows={2} style={{ ...inp, resize: "none" }} />
          </div>

          {/* Preview */}
          {canTransfer && selectedProduct && selectedBranch && (
            <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px",
              marginBottom: 16, border: "1px solid #E2E8F0", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "#475569", marginBottom: 8 }}>Transfer Preview</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, background: "#FFF7ED", color: "#F97316", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
                  {activeBranch?.name ?? "This Branch"}
                </span>
                <ArrowRightLeft size={13} color="#94A3B8" />
                <span style={{ fontSize: 12, background: "#EFF6FF", color: "#1D4ED8", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
                  {selectedBranch.name}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                <strong>{selectedProduct.name}</strong> · {transferQty} {selectedProduct.unit}
              </div>
            </div>
          )}

          <button onClick={() => void handleTransfer()} disabled={!canTransfer || loading}
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
              : <><ArrowRightLeft size={14} /> Confirm Transfer</>}
          </button>
        </div>

        {/* ── Product stock sidebar ──────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Current Stock</div>
            <div style={{ position: "relative", width: 180 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%",
                transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 7,
                  padding: "5px 8px 5px 24px", fontSize: 12, color: "#475569",
                  background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
            </div>
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto", scrollbarWidth: "none" }}>
            {prodLoading && (
              <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
            )}
            {filtered.map((p) => {
              const stock   = stockMap[p.id] ?? 0;
              const isSelected = p.id === productId;
              return (
                <div key={p.id} onClick={() => setProductId(p.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 18px", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                    background: isSelected ? "rgba(249,115,22,0.05)" : "transparent",
                    borderLeft: isSelected ? "3px solid #F97316" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.code} · {p.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800,
                      color: stock <= 0 ? "#EF4444" : stock <= 5 ? "#EAB308" : "#16A34A" }}>
                      {stock}
                    </div>
                    {isSelected && <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700 }}>SELECTED</div>}
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
