import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { UserRound, Printer, Save, FilePlus, RefreshCw, Archive, CheckCircle2, AlertCircle } from "lucide-react";
import { nanoid } from "nanoid";
import { useQueryClient } from "@tanstack/react-query";
import { PosTopBar }   from "./components/PosTopBar";
import { BillTabBar }  from "./components/BillTabBar";
import { ProductTable } from "./components/ProductTable";
import { BillSummary } from "./components/BillSummary";
import type { ProductRow } from "./components/ProductTable";
import { usePosStore } from "@/store/pos.store";
import { http } from "@/lib/axios";

// =============================================================
// POS PAGE
// Search bar (top) accepts both:
//   - Manual typing   → live dropdown with results
//   - Barcode scanner → rapid input + Enter → instant add
// No dialog boxes. Everything inline.
// =============================================================

export default function PosPage() {
  const qc = useQueryClient();
  const {
    activeBillId, getActiveBill, updateBill,
    addRowToBill, updateRowInBill, removeRowFromBill, addBill,
  } = usePosStore();

  const [saving,   setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const bill      = getActiveBill();
  const rows      = bill?.rows ?? [];
  const discount  = bill?.discount  ?? 0;
  const payMode   = bill?.paymentMode ?? "Cash";
  const paidAmt   = bill?.paidAmount  ?? "0.00";

  // ── Totals ──────────────────────────────────────────────────
  const mrpTotal    = rows.reduce((s, r) => s + r.mrp   * r.qty, 0);
  const subTotal    = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const discTotal   = rows.reduce((s, r) => s + r.discAmt, 0) + discount;
  const taxableAmt  = Math.max(0, subTotal - discTotal);
  const cgst        = rows.reduce((s, r) => s + r.taxAmt / 2, 0);
  const sgst        = cgst;
  const totalAmount = Math.max(0, taxableAmt + cgst + sgst);
  const totalItems  = rows.length;
  const totalQty    = rows.reduce((s, r) => s + r.qty, 0);
  const totalTax    = rows.reduce((s, r) => s + r.taxAmt, 0);

  // ── Save sale ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!bill) return;
    const validRows = bill.rows.filter((r) => r.product.trim() && r.qty > 0);
    if (!validRows.length) {
      setFeedback({ type: "error", msg: "Add at least one item before saving." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const paid = parseFloat(bill.paidAmount) || 0;
      const res = await http.post<{ success: boolean; data: { invoiceNumber: string } }>("/sales", {
        customerName:  bill.customer.trim() || "Walk-in Customer",
        invoiceDate:   new Date().toISOString(),
        paymentMethod: bill.paymentMode,
        discountPct:   bill.discount,
        paidAmt:       paid,
        items: validRows.map((r) => ({
          itemName:    r.product,   itemCode:    r.code,
          productId:   r.productId, quantity:    r.qty,
          unit:        "Nos",       mrp:         r.mrp,
          unitPrice:   r.price,     discountPct: r.discPct,
          discountAmt: r.discAmt,   taxPercent:  r.taxPct,
          taxAmount:   r.taxAmt,    totalAmount: r.total,
        })),
      });
      if (res.success) {
        setFeedback({ type: "success", msg: `Invoice ${res.data?.invoiceNumber ?? ""} saved!` });
        qc.invalidateQueries({ queryKey: ["sales"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
        setTimeout(() => { addBill(); setFeedback(null); }, 1400);
      } else {
        setFeedback({ type: "error", msg: "Failed to save sale." });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed to save" });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setSaving(false); }
  }, [bill, addBill, qc]);

  const addEmptyRow = useCallback(() => {
    if (!activeBillId) return;
    addRowToBill(activeBillId, {
      id: nanoid(), product: "", code: "", qty: 1,
      mrp: 0, price: 0, discPct: 0, discAmt: 0, taxPct: 0, taxAmt: 0, total: 0,
    });
  }, [activeBillId, addRowToBill]);

  const removeRow = useCallback((rowId: string) => {
    if (activeBillId) removeRowFromBill(activeBillId, rowId);
  }, [activeBillId, removeRowFromBill]);

  const updateRow = useCallback((rowId: string, field: keyof ProductRow, value: number | string) => {
    if (activeBillId) updateRowInBill(activeBillId, rowId, field, value);
  }, [activeBillId, updateRowInBill]);

  if (!bill) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>

      {/* Top bar — search + barcode scanner input */}
      <PosTopBar invoiceNo={bill.invoiceNo} />

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 3000,
            background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2",
            border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`,
            borderRadius: 10, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: 13, fontWeight: 600,
            color: feedback.type === "success" ? "#16A34A" : "#EF4444",
          }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}
      </AnimatePresence>

      {/* Multi-bill tabs */}
      <BillTabBar />

      {/* Customer row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #E2E8F0", background: "#fff", flexShrink: 0 }}>
        <UserRound size={16} color="#64748B" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Customer</span>
        <input
          type="text"
          placeholder="Customer name or mobile..."
          value={bill.customer}
          onChange={(e) => updateBill(bill.id, { customer: e.target.value })}
          style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 12px", fontSize: 13, color: "#475569", outline: "none", fontFamily: "inherit", width: 280, background: "#F8FAFC" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
        />
        <button style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #F97316", borderRadius: 7, background: "#fff", color: "#F97316", padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          + Add Customer
        </button>
      </div>

      {/* Main body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* Left: product table */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <ProductTable rows={rows} onRemoveRow={removeRow} onUpdateRow={updateRow} />

          {/* Bottom toolbar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "8px 14px", display: "flex", alignItems: "center", gap: 16, background: "#fff", flexShrink: 0 }}>
            <button onClick={addEmptyRow} style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #F97316", borderRadius: 7, background: "#fff", color: "#F97316", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", flexShrink: 0 }}>
              + Add Row
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>Payment Type</span>
              <select value={payMode} onChange={(e) => updateBill(bill.id, { paymentMode: e.target.value as typeof payMode })}
                style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 24px 6px 10px", fontSize: 13, color: "#1E293B", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Split</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>
              <input type="number" value={bill.discount}
                onChange={(e) => updateBill(bill.id, { discount: parseFloat(e.target.value) || 0 })}
                style={{ width: 70, border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 8px", fontSize: 13, textAlign: "right", outline: "none", fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Totals strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
              {[
                { label: "ITEMS",    value: String(totalItems)       },
                { label: "QTY",      value: String(totalQty)         },
                { label: "DISCOUNT", value: discTotal.toFixed(2)     },
                { label: "TAX",      value: totalTax.toFixed(2)      },
                { label: "NET AMT",  value: totalAmount.toFixed(2), orange: true },
              ].map(({ label, value, orange }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: orange ? "#F97316" : "#1E293B" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Status / action bar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#22C55E" }}>Ready</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FooterBtn icon={<Printer size={13} />} label="Print (F6)"     v="outline"        onClick={() => {}} />
              <FooterBtn icon={<Save size={13} />}    label="Save & Print"   v="outline-orange" onClick={() => {}} />
              <FooterBtn icon={<Save size={13} />}    label={saving ? "Saving…" : "Save (F2)"} v="orange" onClick={handleSave} disabled={saving} />
            </div>
          </div>

          {/* Footer nav */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", flexShrink: 0 }}>
            <FooterBtn icon={<FilePlus  size={13} />} label="New (F3)"      v="outline" onClick={addBill}   />
            <FooterBtn icon={<RefreshCw size={13} />} label="Update (F4)"   v="outline" onClick={() => {}} />
            <FooterBtn icon={<Archive   size={13} />} label="Old Bill (F5)" v="outline" onClick={() => {}} />
            <FooterBtn icon={<Printer   size={13} />} label="Print (F6)"    v="outline" onClick={() => {}} />
          </div>
        </div>

        {/* Right: Bill Summary */}
        <BillSummary
          mrpTotal={mrpTotal} subTotal={subTotal} discount={discTotal}
          taxableAmount={taxableAmt} cgst={cgst} sgst={sgst}
          totalAmount={totalAmount} paidAmount={paidAmt}
          onPaidAmountChange={(v) => updateBill(bill.id, { paidAmount: v })}
          paymentMode={payMode}
          onPaymentModeChange={(m) => updateBill(bill.id, { paymentMode: m })}
        />
      </div>
    </div>
  );
}

function FooterBtn({ icon, label, v, onClick, disabled }: {
  icon: React.ReactNode; label: string;
  v: "outline" | "outline-orange" | "orange";
  onClick?: () => void; disabled?: boolean;
}) {
  const s: Record<string, React.CSSProperties> = {
    "outline":        { background: "#fff",    color: "#475569", border: "1px solid #E2E8F0"   },
    "outline-orange": { background: "#fff",    color: "#F97316", border: "1.5px solid #F97316" },
    "orange":         { background: "#F97316", color: "#fff",    border: "none"                },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none", borderRadius: 7, opacity: disabled ? 0.7 : 1, ...s[v] }}>
      {icon}{label}
    </button>
  );
}
