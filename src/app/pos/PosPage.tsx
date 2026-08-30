import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserRound, Printer, Save, RefreshCw, Archive,
  CheckCircle2, AlertCircle, X, Loader2, FileText,
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
import { AddProductToBillDialog } from "./components/AddProductToBillDialog";
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
  const [showAddProdDlg, setShowAddProdDlg] = useState(false);
  const [printing,      setPrinting]      = useState(false);
  // Bill overview shown after save — stays open until user closes
  const [showBillOverview, setShowBillOverview] = useState(false);
  // Tracks the last saved invoice snapshot for printing
  const [printData,     setPrintData]     = useState<{
    invoiceNo: string; customerName: string; invoiceDate: Date;
    rows: ProductRow[]; mrpTotal: number; subTotal: number;
    discTotal: number; taxableAmt: number; cgst: number; sgst: number;
    roundingAdj: number; totalAmount: number; paidAmount: number; paymentMode: string;
  } | null>(null);
  // Used to trigger window.print() after printData is committed to DOM
  const pendingPrintRef = useRef(false);
  // Local string for discount input — lets user clear the field while typing
  const [discountStr,   setDiscountStr]   = useState("");

  const bill     = getActiveBill();
  const rows     = bill?.rows ?? [];
  const discount = bill?.discount  ?? 0;
  const payMode      = bill?.paymentMode  ?? "Cash";
  const paidAmt      = bill?.paidAmount   ?? "";
  const discType     = bill?.discountType ?? "%";

  // ── Totals ──────────────────────────────────────────────────
  const mrpTotal      = rows.reduce((s, r) => s + r.mrp   * r.qty, 0);
  const subTotal      = rows.reduce((s, r) => s + r.price * r.qty, 0);
  // bill-level discount: % mode = percentage of subTotal, ₹ mode = flat rupee deduction
  const billDiscAmt   = discType === "%" 
    ? subTotal * (discount / 100)
    : Math.min(discount, subTotal);           // ₹ — can't discount more than subtotal
  const rowDiscAmt    = rows.reduce((s, r) => s + r.discAmt, 0);
  const discTotal     = rowDiscAmt + billDiscAmt;
  const taxableAmt    = Math.max(0, subTotal - discTotal);
  const cgst          = rows.reduce((s, r) => s + r.taxAmt / 2, 0);
  const sgst          = cgst;
  const rawTotal      = Math.max(0, taxableAmt + cgst + sgst);
  // Round to nearest ₹5
  const totalAmount   = Math.round(rawTotal / 5) * 5;
  const roundingAdj   = +(totalAmount - rawTotal).toFixed(2);
  const totalItems    = rows.length;
  const totalQty      = rows.reduce((s, r) => s + r.qty, 0);
  const totalTax      = rows.reduce((s, r) => s + r.taxAmt, 0);

  // All amounts are whole rupees after rounding — no decimals needed
  const fmtAmt = (n: number) => String(Math.round(n));

  // Sync discountStr when active bill switches (tab change)
  useEffect(() => {
    if (!bill) return;
    setDiscountStr(bill.discount === 0 ? "" : String(bill.discount));
  }, [bill?.id]); // discountType is already in bill state, no extra sync needed

  // ── Fire window.print() AFTER printData is committed to DOM ─
  useEffect(() => {
    if (pendingPrintRef.current && printData) {
      pendingPrintRef.current = false;
      // Set paper size on body so @page CSS targets thermal/A4 correctly
      document.body.setAttribute("data-paper", printSettings.paperType);
      // Double rAF ensures browser has fully painted the portal before print dialog
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          setPrinting(false);
          document.body.removeAttribute("data-paper");
        });
      });
    }
  }, [printData]);

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
          mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
          roundingAdj, totalAmount,
          paidAmount:   paid,
          paymentMode:  bill.paymentMode,
        };
        qc.invalidateQueries({ queryKey: ["sales"] });
        qc.invalidateQueries({ queryKey: ["inventory"] });
        if (andPrint) {
          // Set flag BEFORE setPrintData so useEffect fires with flag=true
          pendingPrintRef.current = true;
          setPrinting(true);
        }
        setPrintData(snapshot);
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
  const triggerPrint = useCallback(() => {
    // Build snapshot from current bill if no saved print data exists
    const snap = printData ?? (() => {
      if (!bill) return null;
      const validRows = bill.rows.filter((r) => r.product.trim() && r.qty > 0);
      if (!validRows.length) return null;
      const paid = parseFloat(bill.paidAmount) || totalAmount;
      return {
        invoiceNo:    bill.invoiceNo,
        customerName: bill.customer.trim() || "Walk-in Customer",
        invoiceDate:  new Date(),
        rows:         validRows,
        mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
        roundingAdj, totalAmount,
        paidAmount:   paid,
        paymentMode:  bill.paymentMode,
      };
    })();
    if (!snap) return;

    setPrinting(true);

    if (snap === printData) {
      // printData already in DOM — fire directly
      document.body.setAttribute("data-paper", printSettings.paperType);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.print();
        setPrinting(false);
        document.body.removeAttribute("data-paper");
      }));
    } else {
      // Set flag first, then state — useEffect will fire after render
      pendingPrintRef.current = true;
      setPrintData(snap);
    }
  }, [printData, bill, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst, totalAmount]);

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

            {/* Discount — toggle between % and ₹ */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>

              {/* Type toggle: % / ₹ */}
              <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 7, overflow: "hidden" }}>
                {(["%", "₹"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      updateBill(bill.id, { discountType: t, discount: 0 });
                      setDiscountStr("");
                    }}
                    style={{
                      padding: "5px 9px", border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                      background: discType === t ? "#F97316" : "#fff",
                      color:      discType === t ? "#fff"    : "#64748B",
                      transition: "background 0.15s",
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Value input */}
              <input
                type="text"
                inputMode="numeric"
                value={discountStr}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setDiscountStr(raw);
                  const n = parseFloat(raw);
                  const capped = isNaN(n) ? 0
                    : discType === "%" ? Math.min(n, 100)
                    : n; // ₹ — no upper cap here, calc handles it
                  updateBill(bill.id, { discount: capped });
                }}
                onFocus={(e) => { e.currentTarget.select(); }}
                onBlur={() => {
                  const n = parseFloat(discountStr);
                  if (isNaN(n) || n === 0) {
                    setDiscountStr("");
                    updateBill(bill.id, { discount: 0 });
                  } else {
                    setDiscountStr(String(n));
                  }
                }}
                style={{
                  width: 64, border: "1px solid #E2E8F0", borderRadius: 7,
                  padding: "6px 8px", fontSize: 13, textAlign: "right",
                  outline: "none", fontFamily: "inherit",
                }}
              />

              {/* Live computed discount amount — shown as hint */}
              {billDiscAmt > 0 && (
                <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, whiteSpace: "nowrap" }}>
                  −₹{Math.round(billDiscAmt)}
                </span>
              )}
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
          roundingAdj={roundingAdj}
          totalAmount={totalAmount} paidAmount={paidAmt}
          onPaidAmountChange={(v) => updateBill(bill.id, { paidAmount: v })}
          paymentMode={payMode}
          onPaymentModeChange={(m) => updateBill(bill.id, { paymentMode: m })}
          onAddNewProduct={() => setShowAddProdDlg(true)}
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

      {/* + Add New Product to Bill dialog */}
      <AnimatePresence>
        {showAddProdDlg && (
          <AddProductToBillDialog
            onClose={() => setShowAddProdDlg(false)}
            onAdded={(row) => {
              if (activeBillId) addRowToBill(activeBillId, row);
              setFeedback({ type: "success", msg: `"${row.product}" added to bill` });
              setTimeout(() => setFeedback(null), 3000);
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
              document.body.setAttribute("data-paper", printSettings.paperType);
              setPrinting(true);
              requestAnimationFrame(() => requestAnimationFrame(() => {
                window.print();
                setPrinting(false);
                document.body.removeAttribute("data-paper");
              }));
            }}
            onClose={() => {
              setShowBillOverview(false);
              setPrintData(null);
            }}
            onViewInvoices={() => {
              const invNo = printData.invoiceNo;
              setShowBillOverview(false);
              setPrintData(null);
              navigate("/app/sales/invoices", { state: { highlightInvoice: invNo } });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Print receipt portal — renders directly into body ── */}
      {printData && createPortal(
        <div id="pos-print-area">
          {Array.from({ length: Math.max(1, printSettings.copies) }).map((_, i) => (
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
        </div>,
        document.body
      )}

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
  roundingAdj: number; totalAmount: number; paidAmount: number; paymentMode: string;
}

function BillOverviewModal({
  data, onPrint, onClose, onViewInvoices,
}: { data: OverviewData; onPrint: () => void; onClose: () => void; onViewInvoices: () => void }) {
  const f = (n: number) => "₹" + Math.round(n);
  const change = Math.max(0, data.paidAmount - data.totalAmount);
  const dateStr = data.invoiceDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = data.invoiceDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 4000,
        background: "rgba(10,15,30,0.65)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <motion.div
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 12, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh",
          display: "flex", flexDirection: "column", borderRadius: 20,
          boxShadow: "0 32px 96px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06)",
          overflow: "hidden", background: "#fff" }}>

        {/* ── Branded top strip ── */}
        <div style={{
          background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          padding: "18px 20px 16px", position: "relative",
        }}>
          {/* Close */}
          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12,
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.18)", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", outline: "none",
          }}>
            <X size={14} color="#fff" />
          </button>

          {/* Success pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.22)", borderRadius: 20,
            padding: "4px 10px 4px 6px", marginBottom: 10,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <CheckCircle2 size={13} color="#F97316" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 0.2 }}>
              Bill Saved Successfully
            </span>
          </div>

          {/* Invoice number + meta */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5, lineHeight: 1 }}>
                {data.invoiceNo}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
                {dateStr} · {timeStr} · {data.paymentMode}
              </div>
              {data.customerName !== "Walk-in Customer" && (
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, marginTop: 2 }}>
                  {data.customerName}
                </div>
              )}
            </div>
            {/* Big amount callout */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Total</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: -1, lineHeight: 1 }}>
                {f(data.totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Zigzag tear line ── */}
        <div style={{ height: 12, background: "#fff", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <svg viewBox="0 0 480 12" preserveAspectRatio="none"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
            <path d="M0,0 L10,12 L20,0 L30,12 L40,0 L50,12 L60,0 L70,12 L80,0 L90,12 L100,0 L110,12 L120,0 L130,12 L140,0 L150,12 L160,0 L170,12 L180,0 L190,12 L200,0 L210,12 L220,0 L230,12 L240,0 L250,12 L260,0 L270,12 L280,0 L290,12 L300,0 L310,12 L320,0 L330,12 L340,0 L350,12 L360,0 L370,12 L380,0 L390,12 L400,0 L410,12 L420,0 L430,12 L440,0 L450,12 L460,0 L470,12 L480,0 L480,0 L0,0 Z"
              fill="#EA580C" />
          </svg>
        </div>

        {/* ── Items list ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 0" }}>
          {/* Column header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 44px 68px 72px",
            padding: "8px 0 6px", borderBottom: "1.5px solid #F1F5F9",
            fontSize: 10, fontWeight: 700, color: "#94A3B8",
            textTransform: "uppercase", letterSpacing: "0.06em", gap: 6,
          }}>
            <span>Item</span>
            <span style={{ textAlign: "right" }}>Qty</span>
            <span style={{ textAlign: "right" }}>Rate</span>
            <span style={{ textAlign: "right" }}>Amt</span>
          </div>

          {data.rows.map((r, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 44px 68px 72px",
              padding: "9px 0", gap: 6, alignItems: "center",
              borderBottom: i < data.rows.length - 1 ? "1px dashed #F1F5F9" : "none",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.product}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                  {r.code}
                  {r.discPct > 0 && <span style={{ color: "#EF4444", marginLeft: 6 }}>-{r.discPct}% off</span>}
                  {r.taxPct > 0  && <span style={{ marginLeft: 6 }}>GST {r.taxPct}%</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#64748B", fontWeight: 500 }}>{r.qty}</div>
              <div style={{ textAlign: "right", fontSize: 13, color: "#64748B" }}>₹{r.price.toFixed(0)}</div>
              <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                {f(r.total)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Totals card ── */}
        <div style={{ padding: "10px 20px 14px", background: "#FAFAFA", borderTop: "1.5px dashed #E2E8F0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.mrpTotal !== data.subTotal && (
              <div style={totRow}>
                <span style={{ color: "#94A3B8" }}>MRP Total</span>
                <span style={{ color: "#64748B" }}>{f(data.mrpTotal)}</span>
              </div>
            )}
            <div style={totRow}>
              <span style={{ color: "#64748B" }}>Subtotal</span>
              <span style={{ color: "#1E293B", fontWeight: 500 }}>{f(data.subTotal)}</span>
            </div>
            {data.discTotal > 0 && (
              <div style={totRow}>
                <span style={{ color: "#64748B" }}>Discount</span>
                <span style={{ color: "#EF4444", fontWeight: 600 }}>- {f(data.discTotal)}</span>
              </div>
            )}
            {(data.cgst > 0 || data.sgst > 0) && (
              <>
                <div style={totRow}>
                  <span style={{ color: "#64748B" }}>CGST</span>
                  <span style={{ color: "#1E293B" }}>{f(data.cgst)}</span>
                </div>
                <div style={totRow}>
                  <span style={{ color: "#64748B" }}>SGST</span>
                  <span style={{ color: "#1E293B" }}>{f(data.sgst)}</span>
                </div>
              </>
            )}
            {data.roundingAdj !== 0 && (
              <div style={totRow}>
                <span style={{ color: "#64748B" }}>Rounding {data.roundingAdj > 0 ? "▲" : "▼"}</span>
                <span style={{ color: data.roundingAdj > 0 ? "#16A34A" : "#EF4444", fontWeight: 600 }}>
                  {data.roundingAdj > 0 ? "+" : ""}{f(data.roundingAdj)}
                </span>
              </div>
            )}

            {/* Total + paid in a compact card */}
            <div style={{
              marginTop: 4, borderRadius: 12, overflow: "hidden",
              border: "1.5px solid #F97316",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#F97316", padding: "9px 14px",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>TOTAL</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                  {f(data.totalAmount)}
                </span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#FFF7ED", padding: "7px 14px",
              }}>
                <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>
                  Paid · {data.paymentMode}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#16A34A" }}>
                  {f(data.paidAmount)}
                </span>
              </div>
              {change > 0 && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#F0FDF4", padding: "6px 14px",
                  borderTop: "1px solid #DCFCE7",
                }}>
                  <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>Change</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#16A34A" }}>{f(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{
          padding: "12px 20px 16px", display: "flex", gap: 8,
          background: "#fff", borderTop: "1px solid #F1F5F9",
        }}>
          {/* New Bill — ghost */}
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 12,
            border: "1.5px solid #E2E8F0", background: "#fff",
            color: "#64748B", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "border-color 0.15s, color 0.15s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#94A3B8"; (e.currentTarget as HTMLButtonElement).style.color = "#0F172A"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            New Bill
          </button>

          {/* View Invoice — outlined orange */}
          <button onClick={onViewInvoices} style={{
            flex: 1, padding: "11px 0", borderRadius: 12,
            border: "1.5px solid #F97316", background: "#FFF7ED",
            color: "#F97316", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background 0.15s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFEDD5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
          >
            <FileText size={14} /> View Invoice
          </button>

          {/* Print — solid orange */}
          <button onClick={onPrint} style={{
            flex: 1, padding: "11px 0", borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            boxShadow: "0 4px 14px rgba(249,115,22,0.4)",
            transition: "opacity 0.15s",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            <Printer size={14} /> Print Receipt
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const totRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 12 };

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
