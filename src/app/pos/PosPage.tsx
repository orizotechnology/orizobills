import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserRound, Printer, Save, RefreshCw, Archive,
  CheckCircle2, AlertCircle, X, Loader2,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PosTopBar }       from "./components/PosTopBar";
import { PosSearchBar }    from "./components/PosSearchBar";
import { BillTabBar }      from "./components/BillTabBar";
import { ProductTable }    from "./components/ProductTable";
import { BillSummary }     from "./components/BillSummary";
import { PosPrintReceipt } from "./components/PosPrintReceipt";
import type { ProductRow } from "./components/ProductTable";
import { usePosStore }   from "@/store/pos.store";
import { usePrintStore } from "@/store/print.store";
import { useBusinessStore } from "@/store/business.store";
import { http } from "@/lib/axios";
import "@/styles/print.css";

export default function PosPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const {
    activeBillId, getActiveBill, updateBill,
    addRowToBill, updateRowInBill, removeRowFromBill, addBill, resetAfterSave,
  } = usePosStore();
  const { settings: printSettings } = usePrintStore();
  const { profile } = useBusinessStore();

  const [saving,        setSaving]        = useState(false);
  const [feedback,      setFeedback]      = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showCustDlg,   setShowCustDlg]   = useState(false);
  const [printing,      setPrinting]      = useState(false);
  // Bill overview shown after save — stays open until user closes
  const [showBillOverview, setShowBillOverview] = useState(false);
  // Tracks the last saved invoice snapshot for printing
  const [printData,     setPrintData]     = useState<{
    invoiceNo: string; customerName: string; invoiceDate: Date;
    rows: ProductRow[]; mrpTotal: number; subTotal: number;
    discTotal: number; taxableAmt: number; cgst: number; sgst: number;
    totalAmount: number; paidAmount: number; paymentMode: string;
  } | null>(null);
  // Used to trigger window.print() after printData is committed to DOM
  const pendingPrintRef = useRef(false);
  // Local string for discount input — lets user clear the field while typing
  const [discountStr,   setDiscountStr]   = useState("");

  const bill     = getActiveBill();
  const rows     = bill?.rows ?? [];
  const discount = bill?.discount  ?? 0;
  const payMode  = bill?.paymentMode ?? "Cash";
  const paidAmt  = bill?.paidAmount  ?? "";

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

  // Drop .00 from displayed amounts
  const fmtAmt = (n: number) => {
    const s = n.toFixed(2);
    return s.endsWith(".00") ? String(Math.round(n)) : s;
  };

  // Sync discountStr when active bill switches (tab change)
  useEffect(() => {
    if (!bill) return;
    setDiscountStr(bill.discount === 0 ? "" : String(bill.discount));
  }, [bill?.id]);

  // ── Fire window.print() AFTER printData is committed to DOM ─
  useEffect(() => {
    if (pendingPrintRef.current && printData) {
      pendingPrintRef.current = false;
      // Small timeout ensures browser has painted the receipt before print dialog
      setTimeout(() => {
        window.print();
        setPrinting(false);
      }, 80);
    }
  }, [printData]);

  // ── Auto-set paidAmt to total when Cash/Card mode & total changes
  useEffect(() => {
    if (!bill) return;
    if ((bill.paymentMode === "Cash" || bill.paymentMode === "Card") && totalAmount > 0) {
      // Only auto-fill if still at default empty/zero
      const cur = parseFloat(bill.paidAmount) || 0;
      if (cur === 0) {
        updateBill(bill.id, { paidAmount: String(Math.round(totalAmount)) });
      }
    }
  }, [totalAmount, bill?.paymentMode]);

  // ── Save sale ───────────────────────────────────────────────
  const handleSave = useCallback(async (andPrint = false) => {
    if (!bill) return;
    const validRows = bill.rows.filter((r) => r.product.trim() && r.qty > 0);
    if (!validRows.length) {
      setFeedback({ type: "error", msg: "Add at least one item before saving." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const paid = parseFloat(bill.paidAmount) || totalAmount;
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
        const savedInvoiceNo = res.data?.invoiceNumber ?? bill.invoiceNo;
        const snapshot = {
          invoiceNo:    savedInvoiceNo,
          customerName: bill.customer.trim() || "Walk-in Customer",
          invoiceDate:  new Date(),
          rows:         validRows,
          mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst, totalAmount,
          paidAmount:   paid,
          paymentMode:  bill.paymentMode,
        };
        setPrintData(snapshot);
        qc.invalidateQueries({ queryKey: ["sales"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
        if (andPrint) {
          // Set pending flag BEFORE state update so useEffect catches it
          pendingPrintRef.current = true;
          setPrinting(true);
          // resetAfterSave happens when user closes the overview
        }
        // Show the bill overview modal — user decides to print or close
        setShowBillOverview(true);
        resetAfterSave();
      } else {
        setFeedback({ type: "error", msg: "Failed to save sale." });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Failed to save" });
      setTimeout(() => setFeedback(null), 3000);
    } finally { setSaving(false); }
  }, [bill, qc, totalAmount, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst]);

  // ── Print ───────────────────────────────────────────────────
  const triggerPrint = () => {
    // Build snapshot from current bill if no saved print data exists
    const dataToUse = printData ?? (() => {
      if (!bill || bill.rows.length === 0) return null;
      const validRows = bill.rows.filter((r) => r.product.trim() && r.qty > 0);
      if (!validRows.length) return null;
      const paid = parseFloat(bill.paidAmount) || totalAmount;
      return {
        invoiceNo:    bill.invoiceNo,
        customerName: bill.customer.trim() || "Walk-in Customer",
        invoiceDate:  new Date(),
        rows:         validRows,
        mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst, totalAmount,
        paidAmount:   paid,
        paymentMode:  bill.paymentMode,
      };
    })();
    if (!dataToUse) return;
    setPrinting(true);
    pendingPrintRef.current = true;
    // If printData already has the right value, useEffect won't fire again —
    // so force-trigger print directly in that case
    if (printData === dataToUse) {
      pendingPrintRef.current = false;
      setTimeout(() => { window.print(); setPrinting(false); }, 80);
    } else {
      setPrintData(dataToUse); // useEffect will fire window.print() after render
    }
  };

  // ── Add empty row ───────────────────────────────────────────
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

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2")  { e.preventDefault(); void handleSave(false); }
      if (e.key === "F3")  { e.preventDefault(); addBill(); }
      if (e.key === "F5")  { e.preventDefault(); navigate("/app/sales/invoices"); }
      if (e.key === "F6")  { e.preventDefault(); triggerPrint(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, addBill, navigate]);

  if (!bill) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>

      <PosTopBar invoiceNo={bill.invoiceNo} />

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
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
          </motion.div>
        )}
      </AnimatePresence>

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
          style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 12px", fontSize: 13, color: "#475569", outline: "none", fontFamily: "inherit", width: 260, background: "#F8FAFC" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
        />
        <button
          onClick={() => setShowCustDlg(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #F97316", borderRadius: 7, background: "#fff", color: "#F97316", padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          + Add Customer
        </button>

        {/* Spacer pushes New Bill to the far right */}
        <div style={{ flex: 1 }} />

        {/* New Bill (F3) — right side of customer row */}
        <button
          onClick={addBill}
          title="Open a new bill (F3)"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            border: "1.5px solid #E2E8F0", borderRadius: 7,
            background: "#fff", color: "#475569",
            padding: "7px 14px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", outline: "none",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#F97316";
            (e.currentTarget as HTMLButtonElement).style.color = "#F97316";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
            (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          New Bill (F3)
        </button>
      </div>

      {/* Main body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* Left: product area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          <PosSearchBar />
          <div style={{ height: 10, background: "#fff", flexShrink: 0 }} />
          <ProductTable rows={rows} onRemoveRow={removeRow} onUpdateRow={updateRow} />

          {/* Bottom toolbar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "8px 14px", display: "flex", alignItems: "center", gap: 14, background: "#fff", flexShrink: 0 }}>
            <button onClick={addEmptyRow}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #F97316", borderRadius: 7, background: "#fff", color: "#F97316", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", flexShrink: 0 }}>
              + Add Row
            </button>

            {/* Payment type — syncs with BillSummary */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>Payment</span>
              <select
                value={payMode}
                onChange={(e) => updateBill(bill.id, { paymentMode: e.target.value as typeof payMode })}
                style={{ border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 24px 6px 10px", fontSize: 13, color: "#1E293B", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Split">Split</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>
              <input
                type="text"
                inputMode="numeric"
                value={discountStr}
                placeholder="0"
                onChange={(e) => {
                  // Allow only digits and a single decimal point
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setDiscountStr(raw);
                  const n = parseFloat(raw);
                  updateBill(bill.id, { discount: isNaN(n) ? 0 : Math.min(n, 100) });
                }}
                onFocus={(e) => {
                  // Select all on focus so user can replace immediately
                  e.currentTarget.select();
                }}
                onBlur={() => {
                  // Normalise on blur — empty becomes "" (placeholder shows 0)
                  const n = parseFloat(discountStr);
                  if (isNaN(n) || n === 0) {
                    setDiscountStr("");
                    updateBill(bill.id, { discount: 0 });
                  } else {
                    setDiscountStr(String(n));
                  }
                }}
                style={{
                  width: 60, border: "1px solid #E2E8F0", borderRadius: 7,
                  padding: "6px 8px", fontSize: 13, textAlign: "right",
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Totals strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
              {[
                { label: "ITEMS",    value: String(totalItems)       },
                { label: "QTY",      value: String(totalQty)         },
                { label: "DISC",     value: fmtAmt(discTotal)        },
                { label: "TAX",      value: fmtAmt(totalTax)         },
                { label: "NET AMT",  value: fmtAmt(totalAmount), orange: true },
              ].map(({ label, value, orange }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: orange ? "#F97316" : "#1E293B" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action bar */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: saving ? "#F97316" : "#22C55E" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: saving ? "#F97316" : "#22C55E" }}>
                {saving ? "Saving…" : "Ready"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FooterBtn
                icon={printing ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Printer size={13} />}
                label="Print (F6)"
                v="outline"
                onClick={triggerPrint}
                disabled={printing}
              />
              <FooterBtn
                icon={<Save size={13} />}
                label="Save & Print"
                v="outline-orange"
                onClick={() => void handleSave(true)}
                disabled={saving}
              />
              <FooterBtn
                icon={saving ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={13} />}
                label={saving ? "Saving…" : "Save (F2)"}
                v="orange"
                onClick={() => void handleSave(false)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Footer nav */}
          <div style={{ borderTop: "1px solid #E2E8F0", padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", flexShrink: 0 }}>
            <FooterBtn icon={<RefreshCw size={13} />} label="Update (F4)"   v="outline" onClick={() => void handleSave(false)} />
            <FooterBtn icon={<Archive   size={13} />} label="Old Bill (F5)" v="outline" onClick={() => navigate("/app/sales/invoices")} />
            <FooterBtn icon={<Printer   size={13} />} label="Print (F6)"    v="outline" onClick={triggerPrint} />
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

      {/* + Add Customer dialog */}
      <AnimatePresence>
        {showCustDlg && (
          <AddCustomerDialog
            defaultName={bill.customer}
            onClose={() => setShowCustDlg(false)}
            onSaved={(name) => {
              updateBill(bill.id, { customer: name });
              setShowCustDlg(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Bill Overview Modal — shown after save ──────────── */}
      <AnimatePresence>
        {showBillOverview && printData && (
          <BillOverviewModal
            data={printData}
            onPrint={() => {
              pendingPrintRef.current = true;
              setPrinting(true);
              // printData already set — trigger directly
              pendingPrintRef.current = false;
              setTimeout(() => { window.print(); setPrinting(false); }, 80);
            }}
            onClose={() => {
              setShowBillOverview(false);
              setPrintData(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Hidden print receipt area — visible only on print ── */}
      <div id="pos-print-area">
        {printData && Array.from({ length: Math.max(1, printSettings.copies) }).map((_, i) => (
          <PosPrintReceipt
            key={i}
            invoiceNo={printData.invoiceNo}
            customerName={printData.customerName}
            invoiceDate={printData.invoiceDate}
            rows={printData.rows}
            mrpTotal={printData.mrpTotal}
            subTotal={printData.subTotal}
            discTotal={printData.discTotal}
            taxableAmt={printData.taxableAmt}
            cgst={printData.cgst}
            sgst={printData.sgst}
            totalAmount={printData.totalAmount}
            paidAmount={printData.paidAmount}
            paymentMode={printData.paymentMode}
            settings={printSettings}
            profile={profile}
          />
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Add Customer Dialog ───────────────────────────────────────

function AddCustomerDialog({
  defaultName,
  onClose,
  onSaved,
}: {
  defaultName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [form, setForm] = useState({
    name:    defaultName,
    phone:   "",
    email:   "",
    address: "",
    gstin:   "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await http.post<{ success: boolean; data: { name: string } }>("/customers", {
        name:    form.name.trim(),
        phone:   form.phone   || undefined,
        email:   form.email   || undefined,
        address: form.address || undefined,
        gstin:   form.gstin   || undefined,
      });
      if (res.success) {
        onSaved(form.name.trim());
      } else {
        setError("Failed to save customer.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Add Customer</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Name *",   key: "name",    placeholder: "Customer name",      ref: nameRef },
            { label: "Phone",    key: "phone",   placeholder: "+91 98765 43210" },
            { label: "Email",    key: "email",   placeholder: "customer@email.com" },
            { label: "GSTIN",    key: "gstin",   placeholder: "22AAAAA0000A1Z5" },
          ].map(({ label, key, placeholder, ref }) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <input
                ref={ref as React.RefObject<HTMLInputElement> | undefined}
                value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                style={inp}
              />
            </div>
          ))}
          <div>
            <label style={lbl}>Address</label>
            <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
              placeholder="Street, City, State, PIN" rows={2}
              style={{ ...inp, resize: "none" }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#EF4444" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px 0", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: "9px 0", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> Add Customer</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── BillOverviewModal — shown after save ──────────────────────

interface OverviewData {
  invoiceNo: string; customerName: string; invoiceDate: Date;
  rows: ProductRow[]; mrpTotal: number; subTotal: number;
  discTotal: number; taxableAmt: number; cgst: number; sgst: number;
  totalAmount: number; paidAmount: number; paymentMode: string;
}

function BillOverviewModal({
  data, onPrint, onClose,
}: { data: OverviewData; onPrint: () => void; onClose: () => void }) {
  const f = (n: number) => "₹" + n.toFixed(2).replace(/\.00$/, "");
  const change = Math.max(0, data.paidAmount - data.totalAmount);
  const dateStr = data.invoiceDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = data.invoiceDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24 }}>
      <motion.div
        initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 560,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            {/* Success badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#DCFCE7",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={16} color="#16A34A" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>Bill Saved Successfully</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{data.invoiceNo}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
              {dateStr} · {timeStr} · {data.paymentMode}
              {data.customerName !== "Walk-in Customer" && (
                <span> · <strong style={{ color: "#475569" }}>{data.customerName}</strong></span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, border: "1px solid #E2E8F0", borderRadius: 8,
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, outline: "none" }}>
            <X size={14} color="#94A3B8" />
          </button>
        </div>

        {/* ── Items list ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 70px 80px",
            padding: "10px 0 6px", borderBottom: "1px solid #F1F5F9",
            fontSize: 11, fontWeight: 700, color: "#94A3B8",
            textTransform: "uppercase", letterSpacing: "0.04em", gap: 8 }}>
            <span>Item</span>
            <span style={{ textAlign: "right" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Rate</span>
            <span style={{ textAlign: "right" }}>Amount</span>
          </div>

          {data.rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 56px 70px 80px",
              padding: "9px 0", borderBottom: "1px solid #F8FAFC",
              alignItems: "center", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{r.product}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  {r.code}
                  {r.discPct > 0 && <span style={{ color: "#EF4444", marginLeft: 6 }}>-{r.discPct}% off</span>}
                  {r.taxPct > 0  && <span style={{ color: "#64748B", marginLeft: 6 }}>GST {r.taxPct}%</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#475569" }}>{r.qty}</div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#475569" }}>₹{r.price.toFixed(0)}</div>
              <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                {f(r.total)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Totals summary ── */}
        <div style={{ padding: "12px 22px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.mrpTotal !== data.subTotal && (
              <div style={totRow}>
                <span style={{ color: "#64748B" }}>MRP Total</span>
                <span>{f(data.mrpTotal)}</span>
              </div>
            )}
            <div style={totRow}>
              <span style={{ color: "#64748B" }}>Subtotal</span>
              <span>{f(data.subTotal)}</span>
            </div>
            {data.discTotal > 0 && (
              <div style={totRow}>
                <span style={{ color: "#64748B" }}>Discount</span>
                <span style={{ color: "#EF4444" }}>- {f(data.discTotal)}</span>
              </div>
            )}
            {(data.cgst > 0 || data.sgst > 0) && (
              <>
                <div style={totRow}>
                  <span style={{ color: "#64748B" }}>CGST</span><span>{f(data.cgst)}</span>
                </div>
                <div style={totRow}>
                  <span style={{ color: "#64748B" }}>SGST</span><span>{f(data.sgst)}</span>
                </div>
              </>
            )}
            {/* Big total row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#F97316", color: "#fff", borderRadius: 10,
              padding: "10px 14px", marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: 20, fontWeight: 900 }}>{f(data.totalAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", ...totRow, marginTop: 4 }}>
              <span style={{ color: "#64748B" }}>Paid ({data.paymentMode})</span>
              <span style={{ fontWeight: 700, color: "#16A34A" }}>{f(data.paidAmount)}</span>
            </div>
            {change > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", ...totRow }}>
                <span style={{ color: "#64748B" }}>Change</span>
                <span style={{ fontWeight: 700, color: "#22C55E" }}>{f(change)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: "14px 22px", display: "flex", gap: 10, borderTop: "1px solid #E2E8F0" }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 0", border: "1.5px solid #E2E8F0", borderRadius: 10,
              background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            New Bill
          </button>
          <button onClick={onPrint}
            style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 10,
              background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", outline: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Printer size={15} /> Print Receipt
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const totRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13 };

// ── FooterBtn ─────────────────────────────────────────────────

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

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp: React.CSSProperties = { width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", boxSizing: "border-box" as const };
