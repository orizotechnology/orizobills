import type { ProductRow } from "./ProductTable";
import type { PrintSettings } from "@/store/print.store";
import type { BusinessProfile } from "@/store/business.store";

// =============================================================
// POS PRINT RECEIPT
// Hidden from screen, visible only during window.print().
// Renders the actual POS bill data using the saved print config.
// Supports both Thermal (58mm / 80mm) and A4 / A5 paper types.
// =============================================================

interface ReceiptProps {
  invoiceNo:    string;   // real invoice number from server after save, or local tab label
  customerName: string;
  invoiceDate:  Date;
  rows:         ProductRow[];
  mrpTotal:     number;
  subTotal:     number;
  discTotal:    number;
  taxableAmt:   number;
  cgst:         number;
  sgst:         number;
  totalAmount:  number;
  paidAmount:   number;
  paymentMode:  string;
  settings:     PrintSettings;
  profile:      BusinessProfile;
}

function fmt(n: number): string {
  return "₹" + n.toFixed(2).replace(/\.00$/, "");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Thermal receipt (58mm / 80mm) ─────────────────────────────
function ThermalReceipt({
  invoiceNo, customerName, invoiceDate,
  rows, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
  totalAmount, paidAmount, paymentMode,
  settings, profile,
}: ReceiptProps) {
  const c   = settings.primaryColor;
  const fs  = settings.fontSize === "small" ? 10 : settings.fontSize === "large" ? 13 : 11;
  const w   = settings.paperType === "Thermal 58mm" ? 200 : 260;
  const pad = `${settings.marginTop}px ${settings.marginRight}px ${settings.marginBottom}px ${settings.marginLeft}px`;
  const change = Math.max(0, paidAmount - totalAmount);

  return (
    <div className="pos-receipt" style={{
      width: w, background: "#fff", fontFamily: settings.fontFamily,
      fontSize: fs, color: "#000", padding: pad,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {settings.showLogo && profile.logoUrl && (
          <img src={profile.logoUrl} alt="logo"
            style={{ width: 48, height: 48, objectFit: "contain", margin: "0 auto 5px", display: "block" }} />
        )}
        {settings.showLogo && !profile.logoUrl && profile.storeName && (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: c,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: fs + 8, margin: "0 auto 5px" }}>
            {profile.storeName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ fontWeight: 900, fontSize: fs + 3, color: c }}>
          {(profile.storeName || "SHOP").toUpperCase()}
        </div>
        {profile.address && <div style={{ fontSize: fs - 1, color: "#555" }}>{profile.address}</div>}
        {profile.phone   && <div style={{ fontSize: fs - 1, color: "#555" }}>{profile.phone}</div>}
        {profile.email   && <div style={{ fontSize: fs - 1, color: "#555" }}>{profile.email}</div>}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px dashed #999", margin: "4px 0" }} />

      {/* Invoice info */}
      <div style={{ fontSize: fs - 1, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Invoice:</span><span style={{ fontWeight: 700 }}>{invoiceNo}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Date:</span><span>{fmtDate(invoiceDate)}</span>
        </div>
        {customerName && customerName !== "Walk-in Customer" && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Customer:</span><span>{customerName}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Payment:</span><span>{paymentMode}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px dashed #999", margin: "4px 0" }} />

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${c}` }}>
            <th style={{ textAlign: "left",  padding: "2px 0", color: c }}>Item</th>
            <th style={{ textAlign: "right", padding: "2px 2px", color: c }}>Qty</th>
            <th style={{ textAlign: "right", padding: "2px 2px", color: c }}>Rate</th>
            <th style={{ textAlign: "right", padding: "2px 0", color: c }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
              <td style={{ padding: "2px 0" }}>
                <div>{r.product}</div>
                {r.code && <div style={{ fontSize: fs - 2, color: "#666" }}>{r.code}</div>}
                {r.discPct > 0 && (
                  <div style={{ fontSize: fs - 2, color: "#888" }}>Disc: {r.discPct}%</div>
                )}
              </td>
              <td style={{ textAlign: "right", padding: "2px 2px" }}>{r.qty}</td>
              <td style={{ textAlign: "right", padding: "2px 2px" }}>₹{r.price.toFixed(0)}</td>
              <td style={{ textAlign: "right", padding: "2px 0", fontWeight: 600 }}>₹{r.total.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ borderTop: "1px dashed #999", paddingTop: 4, fontSize: fs - 1 }}>
        {mrpTotal !== subTotal && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>MRP Total</span><span>{fmt(mrpTotal)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#666" }}>Subtotal</span><span>{fmt(subTotal)}</span>
        </div>
        {discTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Discount</span>
            <span style={{ color: "#e53e3e" }}>- {fmt(discTotal)}</span>
          </div>
        )}
        {(cgst > 0 || sgst > 0) && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>CGST</span><span>{fmt(cgst)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>SGST</span><span>{fmt(sgst)}</span>
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between",
          fontWeight: 900, fontSize: fs + 1, borderTop: `1px solid ${c}`,
          paddingTop: 3, marginTop: 3 }}>
          <span>TOTAL</span>
          <span style={{ color: c }}>{fmt(totalAmount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1 }}>
          <span style={{ color: "#666" }}>Paid ({paymentMode})</span>
          <span style={{ fontWeight: 600 }}>{fmt(paidAmount)}</span>
        </div>
        {change > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1 }}>
            <span style={{ color: "#666" }}>Change</span>
            <span style={{ fontWeight: 600, color: "#22c55e" }}>{fmt(change)}</span>
          </div>
        )}
      </div>

      {/* Amount in words */}
      {settings.showAmountInWords && (
        <div style={{ fontSize: fs - 2, color: "#555", marginTop: 4, fontStyle: "italic" }}>
          {amountToWords(totalAmount)}
        </div>
      )}

      {/* Terms */}
      {settings.showTerms && settings.termsText && (
        <div style={{ borderTop: "1px dashed #ccc", marginTop: 6, paddingTop: 4,
          fontSize: fs - 2, color: "#666" }}>
          {settings.termsText}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px dashed #999", marginTop: 6, paddingTop: 4,
        textAlign: "center", fontSize: fs - 1, color: "#555" }}>
        {settings.footerText}
      </div>

      {/* Signature */}
      {settings.showSignature && (
        <div style={{ marginTop: 16, fontSize: fs - 1, textAlign: "right" }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "inline-block", minWidth: 100 }}>
            Authorised Signatory
          </div>
        </div>
      )}
    </div>
  );
}

// ── A4 / A5 receipt ───────────────────────────────────────────
function A4Receipt({
  invoiceNo, customerName, invoiceDate,
  rows, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
  totalAmount, paidAmount, paymentMode,
  settings, profile,
}: ReceiptProps) {
  const c   = settings.primaryColor;
  const fs  = settings.fontSize === "small" ? 11 : settings.fontSize === "large" ? 15 : 13;
  const isA5 = settings.paperType === "A5";
  const pad = `${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm`;
  const change = Math.max(0, paidAmount - totalAmount);

  return (
    <div className="pos-receipt" style={{
      width: isA5 ? "148mm" : "210mm",
      minHeight: isA5 ? "105mm" : "297mm",
      background: "#fff", fontFamily: settings.fontFamily,
      fontSize: fs, color: "#1E293B", padding: pad,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 14, paddingBottom: 12, borderBottom: `3px solid ${c}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {settings.showLogo && profile.logoUrl && (
            <img src={profile.logoUrl} alt="logo"
              style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }} />
          )}
          {settings.showLogo && !profile.logoUrl && profile.storeName && (
            <div style={{ width: 52, height: 52, borderRadius: 8, background: c,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: fs + 8 }}>
              {profile.storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: fs + 6, color: c }}>
              {profile.storeName || "Your Business"}
            </div>
            {profile.address && <div style={{ fontSize: fs - 1, color: "#64748B" }}>{profile.address}</div>}
            {profile.phone   && <div style={{ fontSize: fs - 1, color: "#64748B" }}>{profile.phone}</div>}
            {profile.email   && <div style={{ fontSize: fs - 1, color: "#64748B" }}>{profile.email}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: fs + 8, color: c, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: fs - 1, color: "#64748B" }}>No: <strong>{invoiceNo}</strong></div>
          <div style={{ fontSize: fs - 1, color: "#64748B" }}>Date: {fmtDate(invoiceDate)}</div>
          <div style={{ fontSize: fs - 1, marginTop: 4, padding: "3px 8px",
            background: "#F97316", color: "#fff", borderRadius: 6, fontWeight: 700,
            display: "inline-block" }}>{paymentMode}</div>
        </div>
      </div>

      {/* Customer row */}
      {customerName && customerName !== "Walk-in Customer" && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#F8FAFC",
          borderLeft: `3px solid ${c}`, borderRadius: "0 6px 6px 0" }}>
          <div style={{ fontSize: fs - 1, fontWeight: 600, color: c }}>BILLED TO</div>
          <div style={{ fontWeight: 700 }}>{customerName}</div>
        </div>
      )}

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr style={{ background: c, color: "#fff" }}>
            <th style={{ padding: "6px 8px", textAlign: "left",  fontSize: fs - 1 }}>#</th>
            <th style={{ padding: "6px 8px", textAlign: "left",  fontSize: fs - 1 }}>Item</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>Qty</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>MRP</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>Rate</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>Disc</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>Tax%</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontSize: fs - 1 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              borderBottom: "1px solid #F1F5F9",
              background: settings.tableStyle === "striped" && i % 2 === 1 ? "#F8FAFC" : "#fff",
            }}>
              <td style={{ padding: "6px 8px", color: "#94A3B8", fontSize: fs - 1 }}>{i + 1}</td>
              <td style={{ padding: "6px 8px" }}>
                <div style={{ fontWeight: 500 }}>{r.product}</div>
                {r.code && <div style={{ fontSize: fs - 2, color: "#94A3B8" }}>{r.code}</div>}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.qty}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8" }}>₹{r.mrp.toFixed(0)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>₹{r.price.toFixed(0)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#EF4444" }}>
                {r.discPct > 0 ? `${r.discPct}%` : "—"}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748B" }}>
                {r.taxPct > 0 ? `${r.taxPct}%` : "—"}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>
                ₹{r.total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals block */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 240 }}>
          {[
            mrpTotal !== subTotal ? ["MRP Total", fmt(mrpTotal), false] : null,
            ["Subtotal", fmt(subTotal), false],
            discTotal > 0 ? ["Discount", `- ${fmt(discTotal)}`, false, "#EF4444"] : null,
            cgst > 0 ? ["CGST", fmt(cgst), false] : null,
            sgst > 0 ? ["SGST", fmt(sgst), false] : null,
          ].filter(Boolean).map(([label, value, , color]) => (
            <div key={label as string} style={{ display: "flex", justifyContent: "space-between",
              gap: 16, fontSize: fs - 1, marginBottom: 3 }}>
              <span style={{ color: "#64748B" }}>{label}</span>
              <span style={{ color: (color as string) || "#1E293B" }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            background: c, color: "#fff", padding: "6px 10px",
            borderRadius: 6, fontWeight: 800, fontSize: fs + 1, marginTop: 4 }}>
            <span>TOTAL</span><span>{fmt(totalAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between",
            fontSize: fs - 1, marginTop: 4, color: "#64748B" }}>
            <span>Paid ({paymentMode})</span>
            <span style={{ fontWeight: 600, color: "#1E293B" }}>{fmt(paidAmount)}</span>
          </div>
          {change > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: fs - 1, color: "#22C55E", fontWeight: 600 }}>
              <span>Change</span><span>{fmt(change)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount in words */}
      {settings.showAmountInWords && (
        <div style={{ fontSize: fs - 1, color: "#64748B", marginBottom: 8, fontStyle: "italic" }}>
          {amountToWords(totalAmount)}
        </div>
      )}

      {/* Terms */}
      {settings.showTerms && settings.termsText && (
        <div style={{ fontSize: fs - 1, color: "#64748B", borderTop: "1px solid #E2E8F0",
          paddingTop: 8, marginTop: 8 }}>
          <strong style={{ color: c }}>Terms: </strong>{settings.termsText}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `2px solid ${c}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontStyle: "italic", color: c, fontSize: fs }}>{settings.footerText}</div>
        {settings.showSignature && (
          <div style={{ fontSize: fs - 1, color: "#64748B", textAlign: "right" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 4, minWidth: 120 }}>
              Authorised Signatory
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export — picks A4 or Thermal based on settings ───────
export function PosPrintReceipt(props: ReceiptProps) {
  const isTherm = props.settings.paperType.startsWith("Thermal");
  return isTherm ? <ThermalReceipt {...props} /> : <A4Receipt {...props} />;
}

// ── Amount in words helper ────────────────────────────────────
function amountToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const toWords = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + toWords(num % 100) : "");
    if (num < 100000) return toWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + toWords(num % 1000) : "");
    if (num < 10000000) return toWords(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + toWords(num % 100000) : "");
    return toWords(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + toWords(num % 10000000) : "");
  };
  const rupees = Math.floor(n);
  const paise  = Math.round((n - rupees) * 100);
  const w = toWords(rupees);
  return (w ? w + " Rupees" : "Zero Rupees") + (paise > 0 ? " and " + toWords(paise) + " Paise" : "") + " Only";
}
