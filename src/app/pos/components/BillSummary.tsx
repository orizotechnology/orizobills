import { useState, useEffect, useRef, useCallback } from "react";
import { Banknote, Layers, CreditCard, Split, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useBusinessStore } from "@/store/business.store";

// =============================================================
// BILL SUMMARY + PAYMENT PANEL
// QR generated via canvas API (browser-safe, no Node.js deps)
// =============================================================

interface BillSummaryProps {
  mrpTotal:      number;
  subTotal:      number;
  discount:      number;
  taxableAmount: number;
  cgst:          number;
  sgst:          number;
  roundingAdj:   number;  // difference from rounding total to nearest ₹5
  totalAmount:   number;
  paidAmount:    string;
  onPaidAmountChange: (v: string) => void;
  paymentMode:   "Cash" | "UPI" | "Card" | "Split";
  onPaymentModeChange: (m: "Cash" | "UPI" | "Card" | "Split") => void;
}

function fmt(n: number) {
  // All POS amounts are rounded to nearest ₹5 — show as whole rupees
  return `₹${Math.round(n)}`;
}

function buildUpiUrl(upiId: string, amount: number): string {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Store&am=${amount.toFixed(2)}&cu=INR&tn=Payment`;
}

// ── Pure canvas QR renderer (no Node deps) ───────────────────
// Uses the qrcode library's toCanvas function which works in browser

async function renderQrToCanvas(canvas: HTMLCanvasElement, text: string): Promise<void> {
  // Dynamic import so Vite resolves the browser build correctly
  const QRCode = await import("qrcode");
  await (QRCode.default ?? QRCode).toCanvas(canvas, text, {
    width: 190,
    margin: 2,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}

// ── UPI QR panel ─────────────────────────────────────────────

function UpiQrPanel({ upiId, amount, label = "Scan to pay" }: {
  upiId: string;
  amount: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"generating" | "ready" | "error">("generating");
  const retryCount = useRef(0);

  const generate = useCallback(() => {
    if (!upiId || amount <= 0) { setStatus("error"); return; }
    setStatus("generating");
    // Wait for canvas to be in the DOM
    const attempt = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (retryCount.current < 10) {
          retryCount.current++;
          setTimeout(attempt, 60);
        } else {
          setStatus("error");
        }
        return;
      }
      retryCount.current = 0;
      renderQrToCanvas(canvas, buildUpiUrl(upiId, amount))
        .then(() => setStatus("ready"))
        .catch(() => setStatus("error"));
    };
    setTimeout(attempt, 60);
  }, [upiId, amount]);

  useEffect(() => {
    setStatus("generating");
    retryCount.current = 0;
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upiId, amount]);

  if (!upiId) {
    return (
      <div style={qrBox}>
        <AlertCircle size={20} color="#F97316" />
        <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textAlign: "center", marginTop: 6 }}>No UPI ID set</div>
        <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 2 }}>Add it in Profile → Business Details</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0 4px", position: "relative" }}>

      {/* Single canvas — always in DOM so ref is always valid */}
      <div style={{
        border: "2px solid #E2E8F0", borderRadius: 10, padding: 6,
        background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        visibility: status === "ready" ? "visible" : "hidden",
        height: status === "ready" ? "auto" : 0,
        overflow: "hidden",
      }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 6 }} />
      </div>

      {/* Overlays for non-ready states */}
      {status === "generating" && (
        <div style={qrBox}>
          <div style={{ width: 20, height: 20, border: "3px solid #E2E8F0", borderTopColor: "#F97316", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>Generating QR…</div>
        </div>
      )}

      {status === "error" && (
        <div style={qrBox}>
          <AlertCircle size={20} color="#EF4444" />
          <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>Failed to generate QR</div>
          <button onClick={generate}
            style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#F97316", background: "none", border: "1px solid #FED7AA", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Retry
          </button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
            borderRadius: 20, padding: "3px 10px",
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#F97316" }}>{fmt(amount)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#F97316", opacity: 0.7, letterSpacing: "0.04em" }}>FIXED</span>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{upiId}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748B" }}>
            <Clock size={11} color="#94A3B8" /> {label}
          </div>
        </>
      )}
    </div>
  );
}

const qrBox: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", padding: "16px 12px",
  background: "#F8FAFC", border: "1px dashed #E2E8F0",
  borderRadius: 10, minHeight: 100, width: "100%",
};

// ── Main component ────────────────────────────────────────────

export function BillSummary({
  mrpTotal, subTotal, discount, taxableAmount,
  cgst, sgst, roundingAdj, totalAmount,
  paidAmount, onPaidAmountChange,
  paymentMode, onPaymentModeChange,
}: BillSummaryProps) {
  const { profile } = useBusinessStore();
  const upiId = profile.upiId.trim();

  // Split mode: track cash portion separately
  const [splitCash, setSplitCash] = useState("");

  // When switching modes — reset everything to blank so user enters manually
  useEffect(() => {
    setSplitCash("");
    // Reset paid amount to blank on every mode switch — no auto-fill
    onPaidAmountChange("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode]);

  const paid       = parseFloat(paidAmount) || 0;
  const change     = Math.max(0, paid - totalAmount);

  // Split computations
  const splitCashAmt = parseFloat(splitCash) || 0;
  const splitUpiAmt  = Math.max(0, totalAmount - splitCashAmt);

  // Mode order: Cash → UPI → Split → Card
  const modes: { key: "Cash" | "UPI" | "Card" | "Split"; label: string; icon: React.ReactNode }[] = [
    { key: "Cash",  label: "Cash",  icon: <Banknote   size={15} strokeWidth={1.6} /> },
    { key: "UPI",   label: "UPI",   icon: <Layers     size={15} strokeWidth={1.6} /> },
    { key: "Split", label: "Split", icon: <Split      size={15} strokeWidth={1.6} /> },
    { key: "Card",  label: "Card",  icon: <CreditCard size={15} strokeWidth={1.6} /> },
  ];

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: "#fff", borderLeft: "1px solid #E2E8F0",
      display: "flex", flexDirection: "column",
      fontSize: 13, overflowY: "auto",
    }}>

      {/* ── Add New Product to Bill button ─────────────── */}
      <div style={{ padding: "10px 12px 8px", flexShrink: 0 }}>
        <button style={{
          width: "100%", background: "#F97316", color: "#fff",
          border: "none", borderRadius: 8, padding: "9px 0",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6, outline: "none",
        }}>
          + Add New Product to Bill
        </button>
      </div>

      {/* ── Bill Summary ───────────────────────────────── */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 8 }}>
          Bill Summary
        </div>
        {[
          { label: "MRP Total",      value: fmt(mrpTotal),      color: "#1E293B" },
          { label: "Sub Total",      value: fmt(subTotal),      color: "#1E293B" },
          { label: "Discount",       value: fmt(discount),      color: "#EF4444" },
          { label: "Taxable Amount", value: fmt(taxableAmount), color: "#1E293B" },
          { label: "CGST",           value: fmt(cgst),          color: "#1E293B" },
          { label: "SGST",           value: fmt(sgst),          color: "#1E293B" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 5,
          }}>
            <span style={{ color: "#64748B", fontSize: 12 }}>{label}</span>
            <span style={{ fontWeight: 500, color, fontSize: 12 }}>{value}</span>
          </div>
        ))}

        {/* Rounding adjustment — only shown when non-zero */}
        {roundingAdj !== 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 5,
          }}>
            <span style={{ color: "#64748B", fontSize: 12 }}>
              Rounding {roundingAdj > 0 ? "▲" : "▼"}
            </span>
            <span style={{
              fontWeight: 500, fontSize: 12,
              color: roundingAdj > 0 ? "#16A34A" : "#EF4444",
            }}>
              {roundingAdj > 0 ? "+" : ""}{fmt(roundingAdj)}
            </span>
          </div>
        )}

        {/* Total row */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          borderTop: "1px solid #F1F5F9", paddingTop: 7, marginTop: 4,
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>Total Amount</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#F97316" }}>
            {fmt(totalAmount)}
          </span>
        </div>
      </div>

      {/* ── Payment section ────────────────────────────── */}
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #F1F5F9" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 10 }}>
          Payment
        </div>

        {/* Mode selector buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
          {modes.map(({ key, label, icon }) => {
            const active = paymentMode === key;
            return (
              <button
                key={key}
                onClick={() => onPaymentModeChange(key)}
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "8px 2px",
                  border: `1.5px solid ${active ? "#F97316" : "#E2E8F0"}`,
                  borderRadius: 10,
                  background: active ? "#F97316" : "#fff",
                  color: active ? "#fff" : "#64748B",
                  cursor: "pointer", outline: "none",
                  fontFamily: "inherit", transition: "all 0.15s",
                  flexShrink: 0,
                }}
              >
                {icon}
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em" }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── CASH mode ─────────────────────────────────── */}
        {paymentMode === "Cash" && (
          <div style={{ marginTop: 12 }}>
            <div style={fieldLabel}>Cash Received</div>
            <input
              type="number"
              value={paidAmount}
              step="1"
              onChange={(e) => onPaidAmountChange(e.target.value)}
              style={amtInput}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
            <ChangeRow label="Change" value={fmt(change)} highlight={change > 0} />
          </div>
        )}

        {/* ── UPI mode ──────────────────────────────────── */}
        {paymentMode === "UPI" && (
          <div style={{ marginTop: 10 }}>
            {/* Amount is locked — show read-only */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 8, padding: "8px 12px", marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Amount (fixed)</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#F97316" }}>{fmt(totalAmount)}</span>
            </div>

            {/* QR panel */}
            <UpiQrPanel upiId={upiId} amount={totalAmount} label="Waiting for customer scan…" />

            {/* Scan confirmed button */}
            <button
              onClick={() => onPaidAmountChange(String(totalAmount))}
              style={{
                width: "100%", marginTop: 10,
                padding: "9px 0",
                background: "#22C55E", color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <CheckCircle2 size={15} /> Payment Received
            </button>
          </div>
        )}

        {/* ── SPLIT mode ────────────────────────────────── */}
        {paymentMode === "Split" && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Total reminder */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#F8FAFC", borderRadius: 8, padding: "7px 12px",
              border: "1px solid #E2E8F0",
            }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>Bill Total</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{fmt(totalAmount)}</span>
            </div>

            {/* Cash portion */}
            <div>
              <div style={fieldLabel}>
                <Banknote size={12} /> Cash Amount
              </div>
              <input
                type="number"
                value={splitCash}
                step="1"
                min={0}
                max={totalAmount}
                placeholder="Enter cash portion…"
                autoFocus
                onChange={(e) => {
                  const v = e.target.value;
                  setSplitCash(v);
                  const cashAmt = parseFloat(v) || 0;
                  // paidAmount = total only when cash entered (so save knows it's fully paid)
                  if (cashAmt > 0) {
                    onPaidAmountChange(String(totalAmount));
                  } else {
                    onPaidAmountChange("");
                  }
                }}
                style={amtInput}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#22C55E"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
              />
            </div>

            {/* UPI portion — auto-calculated */}
            {splitCash !== "" && (
              <div>
                <div style={{ ...fieldLabel, color: "#F97316" }}>
                  <Layers size={12} /> UPI Amount (auto)
                </div>
                <div style={{
                  border: "1.5px solid #FED7AA", borderRadius: 8,
                  padding: "8px 12px", background: "#FFF7ED",
                  fontSize: 15, fontWeight: 800, color: "#F97316",
                  textAlign: "right",
                }}>
                  {fmt(splitUpiAmt)}
                </div>
              </div>
            )}

            {/* QR for UPI portion — only show when cash < total */}
            {splitCash !== "" && splitUpiAmt > 0 && (
              <UpiQrPanel
                upiId={upiId}
                amount={splitUpiAmt}
                label="Scan to pay UPI portion"
              />
            )}

            {splitCash !== "" && splitUpiAmt <= 0 && splitCashAmt > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(34,197,94,0.07)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                <CheckCircle2 size={14} color="#22C55E" />
                <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>
                  Full amount in cash — no UPI needed
                </span>
              </div>
            )}

            {/* Change if cash overpaid */}
            {splitCashAmt > totalAmount && (
              <ChangeRow label="Cash Change" value={fmt(splitCashAmt - totalAmount)} highlight />
            )}
          </div>
        )}

        {/* ── CARD mode ─────────────────────────────────── */}
        {paymentMode === "Card" && (
          <div style={{ marginTop: 12 }}>
            <div style={fieldLabel}>Amount Charged to Card</div>
            <input
              type="number"
              value={paidAmount}
              step="1"
              onChange={(e) => onPaidAmountChange(e.target.value)}
              style={amtInput}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#F97316"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
            <ChangeRow label="Change" value={fmt(change)} highlight={change > 0} />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function ChangeRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginTop: 10,
    }}>
      <span style={{ fontWeight: 600, fontSize: 12, color: "#64748B" }}>{label}</span>
      <span style={{
        fontWeight: 800, fontSize: 15,
        color: highlight ? "#22C55E" : "#94A3B8",
      }}>
        {value}
      </span>
    </div>
  );
}

const amtInput: React.CSSProperties = {
  width: "100%", border: "1.5px solid #E2E8F0",
  borderRadius: 8, padding: "8px 10px",
  fontSize: 15, fontWeight: 700, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748B",
  textTransform: "uppercase", letterSpacing: "0.05em",
  marginBottom: 5, display: "flex", alignItems: "center", gap: 4,
};
