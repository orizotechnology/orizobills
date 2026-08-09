import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightLeft, ArrowUpRight, ArrowDownLeft,
  Building2, Package, RefreshCw, AlertTriangle,
  CheckCircle2, Loader2,
} from "lucide-react";
import { http } from "@/lib/axios";
import { useBranchStore } from "@/store/branch.store";

// =============================================================
// TRANSFER PAGE — fully wired to API, no mock data
// Tab 1 : New Transfer  (POST /api/transfers)
// Tab 2 : Products Transferred  (GET /api/transfers/sent)
// Tab 3 : Products Received     (GET /api/transfers/received)
// =============================================================

type Tab = "transfer" | "sent" | "received";

interface StockTransfer {
  id: string; transferRef: string; direction: "OUT" | "IN";
  fromBranchId: string; fromBranchName: string;
  toBranchId: string;   toBranchName: string;
  productId: string | null; productName: string; productCode: string;
  quantity: number; unit: string; notes: string | null;
  status: string; transferDate: string;
}
interface Branch   { id: string; name: string; }
interface Product  { id: string; name: string; code: string; unit: string; isActive: boolean; }
interface InvItem  { productId: string; currentStock: number; }
interface ApiRes<T>{ success: boolean; data: T; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function groupByBranch<T extends { toBranchName?: string; fromBranchName?: string }>(
  arr: T[], key: "toBranchName" | "fromBranchName"
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  arr.forEach((item) => {
    const k = item[key] ?? "Unknown";
    (map[k] ??= []).push(item);
  });
  return map;
}

export default function TransferPage() {
  const qc = useQueryClient();
  const { getActiveBranch } = useBranchStore();
  const activeBranch = getActiveBranch();

  const [tab,      setTab]      = useState<Tab>("transfer");
  const [toBranchId,   setToBranchId]   = useState("");
  const [toBranchName, setToBranchName] = useState("");
  const [productId,    setProductId]    = useState("");
  const [qty,          setQty]          = useState("");
  const [notes,        setNotes]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [feedback,     setFeedback]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── API: available branches ──────────────────────────────
  const { data: branchData } = useQuery({
    queryKey: ["transfer-branches"],
    queryFn: async () => {
      const res = await http.get<ApiRes<Branch[]>>("/transfers/branches");
      return res.success ? res.data : [];
    },
    staleTime: 60_000,
  });
  const branches: Branch[] = branchData ?? [];

  // ── API: products + stock ────────────────────────────────
  const { data: prodData } = useQuery({
    queryKey: ["transfer-products"],
    queryFn: async () => {
      const res = await http.get<ApiRes<{ data: Product[] }>>("/products?pageSize=999&filter=active");
      return res.success
        ? (Array.isArray(res.data) ? res.data : (res.data as { data: Product[] }).data ?? [])
        : [];
    },
    staleTime: 60_000,
  });
  const products: Product[] = prodData ?? [];

  const { data: invData, refetch: refetchInv } = useQuery({
    queryKey: ["transfer-inventory"],
    queryFn: async () => {
      const res = await http.get<ApiRes<{ items: InvItem[] }>>("/inventory");
      if (!res.success) return {} as Record<string, number>;
      const map: Record<string, number> = {};
      res.data.items.forEach((i) => { map[i.productId] = i.currentStock; });
      return map;
    },
    staleTime: 30_000,
  });
  const stockMap = invData ?? {};

  // ── API: sent transfers ──────────────────────────────────
  const { data: sentData, isLoading: sentLoading, isError: sentError, refetch: refetchSent, isFetching: sentFetching } = useQuery({
    queryKey: ["transfers-sent"],
    queryFn: async () => {
      const res = await http.get<ApiRes<{ data: StockTransfer[]; total: number }>>("/transfers/sent?pageSize=500");
      return res.success ? res.data : { data: [], total: 0 };
    },
    staleTime: 30_000,
    enabled: tab === "sent",
  });

  // ── API: received transfers ──────────────────────────────
  const { data: recvData, isLoading: recvLoading, isError: recvError, refetch: refetchRecv, isFetching: recvFetching } = useQuery({
    queryKey: ["transfers-received"],
    queryFn: async () => {
      const res = await http.get<ApiRes<{ data: StockTransfer[]; total: number }>>("/transfers/received?pageSize=500");
      return res.success ? res.data : { data: [], total: 0 };
    },
    staleTime: 30_000,
    enabled: tab === "received",
  });

  const sentItems  = sentData?.data  ?? [];
  const recvItems  = recvData?.data  ?? [];
  const sentTotal  = sentData?.total ?? 0;
  const recvTotal  = recvData?.total ?? 0;

  const sentGroups = useMemo(() => groupByBranch(sentItems, "toBranchName"),   [sentItems]);
  const recvGroups = useMemo(() => groupByBranch(recvItems, "fromBranchName"), [recvItems]);

  const sentQtyTotal = sentItems.reduce((s, t) => s + t.quantity, 0);
  const recvQtyTotal = recvItems.reduce((s, t) => s + t.quantity, 0);

  const selectedProduct = products.find((p) => p.id === productId);
  const fromStock       = productId ? (stockMap[productId] ?? 0) : 0;
  const transferQty     = parseFloat(qty) || 0;
  const canTransfer     = toBranchId && productId && transferQty > 0 && transferQty <= fromStock;

  // ── Submit transfer ──────────────────────────────────────
  const handleTransfer = async () => {
    if (!canTransfer || !toBranchId || !productId) return;
    setSubmitting(true);
    try {
      await http.post("/transfers", {
        toBranchId,
        toBranchName,
        productId,
        productName: selectedProduct?.name ?? "",
        productCode: selectedProduct?.code ?? "",
        quantity:    transferQty,
        unit:        selectedProduct?.unit ?? "Nos",
        notes:       notes || undefined,
      });
      setFeedback({ type: "success", msg: `Transferred ${transferQty} ${selectedProduct?.unit ?? "units"} of ${selectedProduct?.name} to ${toBranchName}` });
      qc.invalidateQueries({ queryKey: ["transfers-sent"] });
      qc.invalidateQueries({ queryKey: ["transfer-inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      refetchInv();
      setToBranchId(""); setToBranchName(""); setProductId(""); setQty(""); setNotes("");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Transfer failed" });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setSubmitting(false); }
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "transfer", label: "New Transfer",         icon: <ArrowRightLeft size={14} /> },
    { key: "sent",     label: "Products Transferred", icon: <ArrowUpRight   size={14} /> },
    { key: "received", label: "Products Received",    icon: <ArrowDownLeft  size={14} /> },
  ];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "#F8FAFC" }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Product Transfer</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
          Inter-branch stock movement for{" "}
          <strong style={{ color: "#F97316" }}>{activeBranch?.name ?? "this branch"}</strong>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #E2E8F0",
        borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px",
              borderRadius: 7, border: "none",
              background: tab === key ? "#F97316" : "transparent",
              color:      tab === key ? "#fff"    : "#64748B",
              fontWeight: tab === key ? 700       : 500,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit", outline: "none",
              transition: "all 0.15s" }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
              background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2",
              border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`,
              borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600,
              color: feedback.type === "success" ? "#16A34A" : "#EF4444" }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════
          TAB 1 — New Transfer
      ════════════════════════════════════════════════════ */}
      {tab === "transfer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Form */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 18,
              display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowRightLeft size={15} color="#F97316" />
              </div>
              New Transfer
            </div>

            {/* To Branch */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}><Building2 size={12} style={{ display: "inline", marginRight: 4 }} />Transfer To Branch</label>
              <select value={toBranchId}
                onChange={(e) => {
                  const b = branches.find((x) => x.id === e.target.value);
                  setToBranchId(e.target.value);
                  setToBranchName(b?.name ?? "");
                }} style={inp}>
                <option value="">Select destination branch…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {branches.length === 0 && (
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>No other branches registered yet</div>
              )}
            </div>

            {/* Product */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}><Package size={12} style={{ display: "inline", marginRight: 4 }} />Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inp}>
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — Stock: {stockMap[p.id] ?? 0} {p.unit}
                  </option>
                ))}
              </select>
              {productId && (
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  Available: <strong style={{ color: fromStock > 0 ? "#16A34A" : "#EF4444" }}>{fromStock}</strong> {selectedProduct?.unit}
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
              {productId && transferQty > fromStock && (
                <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>⚠ Exceeds available stock ({fromStock})</div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason or reference…" rows={2} style={{ ...inp, resize: "none" }} />
            </div>

            {/* Preview */}
            {toBranchId && productId && transferQty > 0 && (
              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px",
                marginBottom: 16, border: "1px solid #E2E8F0", fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: "#475569", marginBottom: 8, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.04em" }}>Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ background: "#FFF7ED", color: "#F97316", fontSize: 12,
                    borderRadius: 5, padding: "3px 10px", fontWeight: 600 }}>
                    {activeBranch?.name ?? "This Branch"}
                  </span>
                  <ArrowRightLeft size={14} color="#94A3B8" />
                  <span style={{ background: "#EFF6FF", color: "#1D4ED8", fontSize: 12,
                    borderRadius: 5, padding: "3px 10px", fontWeight: 600 }}>
                    {toBranchName}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  <strong>{selectedProduct?.name}</strong> · {transferQty} {selectedProduct?.unit}
                </div>
              </div>
            )}

            <button onClick={() => void handleTransfer()} disabled={!canTransfer || submitting}
              style={{ width: "100%", padding: "11px 0", border: "none", borderRadius: 8,
                background: canTransfer && !submitting ? "#F97316" : "#E2E8F0",
                color: canTransfer && !submitting ? "#fff" : "#94A3B8",
                fontSize: 13, fontWeight: 700,
                cursor: canTransfer && !submitting ? "pointer" : "not-allowed",
                fontFamily: "inherit", outline: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {submitting
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Transferring…</>
                : <><ArrowRightLeft size={14} /> Confirm Transfer</>}
            </button>
          </div>

          {/* Live stock overview */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Current Stock</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Click a product to select it</div>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto", scrollbarWidth: "none" }}>
              {products.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  No products found
                </div>
              )}
              {products.map((p) => {
                const stock = stockMap[p.id] ?? 0;
                const isSelected = p.id === productId;
                return (
                  <div key={p.id} onClick={() => setProductId(p.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 18px", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                      background: isSelected ? "rgba(249,115,22,0.05)" : "transparent",
                      borderLeft: isSelected ? "3px solid #F97316" : "3px solid transparent",
                      transition: "background 0.1s" }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.code} · {p.unit}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800,
                        color: stock <= 0 ? "#EF4444" : stock <= 5 ? "#EAB308" : "#16A34A" }}>{stock}</div>
                      {isSelected && <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700 }}>SELECTED</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 2 — Products Transferred (sent OUT)
      ════════════════════════════════════════════════════ */}
      {tab === "sent" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => void refetchSent()} style={iconBtn} title="Refresh">
              <RefreshCw size={15} color="#64748B"
                style={sentFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
            </button>
          </div>

          {sentLoading && <LoadingCard />}
          {sentError   && <ErrorCard />}

          {!sentLoading && !sentError && sentItems.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Transfers",   value: String(sentTotal),                            color: "#F97316" },
                { label: "Branches Supplied", value: String(Object.keys(sentGroups).length),        color: "#8B5CF6" },
                { label: "Total Units Sent",  value: sentQtyTotal.toFixed(0),                       color: "#EF4444" },
              ].map((c) => (
                <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8",
                    textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {!sentLoading && !sentError && sentItems.length === 0 && (
            <EmptyCard icon={<ArrowUpRight size={44} color="#E2E8F0" />}
              title="No transfers sent yet"
              sub="Use the Transfer tab to send stock to other branches" />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(sentGroups).map(([branchName, items]) => (
              <div key={branchName} style={{ background: "#fff", borderRadius: 12,
                border: "1px solid #E2E8F0", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowUpRight size={15} color="#F97316" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>To: {branchName}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} transfer{items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>
                    {items.reduce((s, t) => s + t.quantity, 0).toFixed(0)} units sent
                  </div>
                </div>
                <TransferTable items={items} direction="OUT" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB 3 — Products Received (IN)
      ════════════════════════════════════════════════════ */}
      {tab === "received" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => void refetchRecv()} style={iconBtn} title="Refresh">
              <RefreshCw size={15} color="#64748B"
                style={recvFetching ? { animation: "spin 0.8s linear infinite" } : undefined} />
            </button>
          </div>

          {recvLoading && <LoadingCard />}
          {recvError   && <ErrorCard />}

          {!recvLoading && !recvError && recvItems.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Received",       value: String(recvTotal),                            color: "#22C55E" },
                { label: "Source Branches",       value: String(Object.keys(recvGroups).length),       color: "#8B5CF6" },
                { label: "Total Units Received",  value: recvQtyTotal.toFixed(0),                      color: "#F97316" },
              ].map((c) => (
                <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8",
                    textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {!recvLoading && !recvError && recvItems.length === 0 && (
            <EmptyCard icon={<ArrowDownLeft size={44} color="#E2E8F0" />}
              title="No transfers received yet"
              sub="Transfers sent from other branches will appear here" />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(recvGroups).map(([branchName, items]) => (
              <div key={branchName} style={{ background: "#fff", borderRadius: 12,
                border: "1px solid #E2E8F0", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 18px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowDownLeft size={15} color="#16A34A" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>From: {branchName}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{items.length} transfer{items.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>
                    +{items.reduce((s, t) => s + t.quantity, 0).toFixed(0)} units received
                  </div>
                </div>
                <TransferTable items={items} direction="IN" />
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────

function TransferTable({ items, direction }: { items: StockTransfer[]; direction: "OUT" | "IN" }) {
  const isOut = direction === "OUT";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
          {["Date", "Product", "Code", "Qty", "Unit", "Notes", "Status"].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {items.map((t, idx) => (
            <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
              <td style={{ ...tdStyle, color: "#64748B", whiteSpace: "nowrap" }}>{fmtDate(t.transferDate)}</td>
              <td style={{ ...tdStyle, fontWeight: 500 }}>{t.productName}</td>
              <td style={tdStyle}><code style={chip}>{t.productCode}</code></td>
              <td style={{ ...tdStyle, fontWeight: 700, color: isOut ? "#EF4444" : "#22C55E" }}>
                {isOut ? "−" : "+"}{t.quantity}
              </td>
              <td style={{ ...tdStyle, color: "#64748B" }}>{t.unit}</td>
              <td style={{ ...tdStyle, color: "#94A3B8", maxWidth: 180,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.notes ?? "—"}
              </td>
              <td style={tdStyle}>
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                  background: "rgba(34,197,94,0.1)", color: "#16A34A" }}>{t.status}</span>
              </td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  );
}

function LoadingCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
      padding: "48px", textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 24, height: 24, border: "3px solid #F97316", borderTopColor: "transparent",
          borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#94A3B8" }}>Loading…</span>
      </div>
    </div>
  );
}

function ErrorCard() {
  return (
    <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 12,
      padding: "20px", textAlign: "center", color: "#EF4444", fontSize: 13, marginBottom: 16 }}>
      <AlertTriangle size={16} style={{ display: "inline", marginRight: 6 }} /> Backend not connected
    </div>
  );
}

function EmptyCard({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
      padding: "64px", textAlign: "center", marginBottom: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {icon}
        <div style={{ fontWeight: 600, color: "#94A3B8" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#CBD5E1" }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const lbl:    React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp:    React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const, transition: "border-color 0.15s" };
const thStyle: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };
const chip:    React.CSSProperties = { fontSize: 12, background: "#F1F5F9", borderRadius: 4, padding: "2px 6px", color: "#475569" };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
