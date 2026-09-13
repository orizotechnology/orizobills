import type { ProductRow } from "./ProductTable";
import type { PrintSettings } from "@/store/print.store";
import type { BusinessProfile } from "@/store/business.store";

// =============================================================
// POS PRINT RECEIPT
// Hidden from screen, visible only during window.print().
// Renders the actual POS bill data using the saved print config.
// Supports Thermal (58mm / 80mm) and A4 / A5 paper types.
//
// QR code: pre-generated as a data-URL before print is fired.
// Shown only when paymentMode is "UPI" or "Split".
// The encoded UPI URL has a fixed amount so the customer pays
// exactly the right total — the amount cannot be changed.
// =============================================================

export interface ReceiptProps {
  invoiceNo:    string;
  customerName: string;
  invoiceDate:  Date;
  rows:         ProductRow[];
  mrpTotal:     number;
  subTotal:     number;
  discTotal:    number;
  taxableAmt:   number;
  cgst:         number;
  sgst:         number;
  roundingAdj:  number;
  totalAmount:  number;
  paidAmount:   number;
  paymentMode:  string;
  settings:     PrintSettings;
  profile:      BusinessProfile;
  /** For Split mode: the UPI portion amount. Omit for full-UPI payments. */
  splitUpiAmt?: number;
  /** Pre-generated QR data URL — must be generated before window.print() fires. */
  qrDataUrl?:   string;
}

// ── helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  return "₹" + String(Math.round(n));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Builds a UPI deep-link with a locked amount.
 * The amount field is pre-filled and the UPI app should
 * not allow the customer to change it.
 */
function buildUpiUrl(upiId: string, name: string, amount: number): string {
  // NPCI UPI deep-link spec (mandatory fields only):
  //   pa  — payee VPA — must NOT be encoded (@ and . are literals)
  //   am  — amount as decimal string with 2 places (e.g. "325.00")
  //   cu  — currency, always INR
  //   tn  — transaction note (optional but helps apps; keep short, no special chars)
  //   pn  — payee name is OPTIONAL — omitting it avoids "temporary technical issue"
  //         when the name doesn't exactly match the VPA registration on the bank side.
  const pa   = upiId.trim().toLowerCase();          // VPA must be lowercase
  const am   = amount.toFixed(2);                   // "325.00" — decimal required
  const tn   = encodeURIComponent("Invoice");       // short safe note
  return `upi://pay?pa=${pa}&am=${am}&cu=INR&tn=${tn}`;
}

// ── Pre-generate QR data URL (call BEFORE window.print()) ────
export async function generateQrDataUrl(
  upiId: string,
  shopName: string,
  amount: number,
  size = 300,
): Promise<string | null> {
  if (!upiId || amount <= 0) return null;
  try {
    const url = buildUpiUrl(upiId, shopName, amount);
    const QRCode = await import("qrcode");
    return await (QRCode.default ?? QRCode).toDataURL(url, {
      width:                size,
      margin:               3,
      errorCorrectionLevel: "H",
      color:                { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

// ── Sync QR image — renders immediately from pre-generated dataUrl ──
function QrImg({ dataUrl, size }: { dataUrl: string | null | undefined; size: number }) {
  if (!dataUrl) return <div style={{ width: size, height: size, background: "#f0f0f0", borderRadius: 4 }} />;
  return (
    <img
      src={dataUrl}
      alt="UPI QR"
      width={size}
      height={size}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}

// ── Amount in words ───────────────────────────────────────────
function amountToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const toWords = (num: number): string => {
    if (num === 0) return "";
    if (num < 20)  return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + toWords(num % 100) : "");
    if (num < 100000) return toWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + toWords(num % 1000) : "");
    if (num < 10000000) return toWords(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + toWords(num % 100000) : "");
    return toWords(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + toWords(num % 10000000) : "");
  };
  const rupees = Math.floor(n);
  const paise  = Math.round((n - rupees) * 100);
  const w = toWords(rupees);
  return (w ? w + " Rupees" : "Zero Rupees") +
    (paise > 0 ? " and " + toWords(paise) + " Paise" : "") + " Only";
}

// =============================================================
// THERMAL RECEIPT  (58 mm / 80 mm)
// =============================================================
function ThermalReceipt(props: ReceiptProps) {
  const {
    invoiceNo, customerName, invoiceDate,
    rows, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
    roundingAdj, totalAmount, paidAmount, paymentMode,
    settings, profile, splitUpiAmt,
  } = props;

  const fs  = settings.fontSize === "small" ? 11 : settings.fontSize === "large" ? 15 : 13;
  // Receipt fills 100% of the printable area — width is driven by @page size in print.css.
  // We keep a screen-preview width that matches the selected paper roll.
  const previewW = settings.paperType === "Thermal 58mm" ? 200
    : settings.paperType === "Thermal 72mm" ? 240
    : settings.paperType === "Thermal 76mm" ? 255
    : 272; // 80mm default
  const pad = `${settings.marginTop}px ${settings.marginRight}px ${settings.marginBottom}px ${settings.marginLeft}px`;
  const font = `${settings.fontFamily || "Arial"}, Arial, sans-serif`;
  const bold = settings.fontBold ? 700 : 400;
  // QR size: use settings.qrSize if set, else fall back to 70% of preview width
  const qrSize = settings.qrSize ? Math.min(settings.qrSize, Math.round(previewW * 0.95)) : Math.round(previewW * 0.68);

  const change     = Math.max(0, paidAmount - totalAmount);
  const isUpi      = paymentMode === "UPI";
  const isSplit    = paymentMode === "Split";
  const needsQr    = (isUpi || isSplit) && !!profile.upiId && settings.showQR;

  const qrAmount   = isSplit && splitUpiAmt !== undefined ? splitUpiAmt : totalAmount;

  const cashPortion = isSplit && splitUpiAmt !== undefined
    ? totalAmount - splitUpiAmt
    : null;

  const Dash  = () => <div style={{ borderTop: "1px dashed #999", margin: "4px 0" }} />;
  const Solid = () => <div style={{ borderTop: "1px solid #000",  margin: "3px 0"  }} />;

  return (
    <div className="pos-receipt" style={{
      /* Screen: fixed preview width matching roll. Print: print.css overrides to 100% roll width. */
      width: previewW, maxWidth: "100%", boxSizing: "border-box",
      background: "#fff",
      fontFamily: font, fontSize: fs,
      fontWeight: bold,
      color: "#000", padding: pad,
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {profile.logoUrl ? (
          <img src={profile.logoUrl} alt="logo"
            style={{ width: settings.logoSize ?? 48, height: settings.logoSize ?? 48,
              objectFit: "contain", margin: "0 auto 5px", display: "block" }} />
        ) : (
          profile.storeName && (
            <div style={{ fontWeight: 900, fontSize: fs + 6, margin: "0 auto 5px", textAlign: "center" }}>
              [{profile.storeName.charAt(0).toUpperCase()}]
            </div>
          )
        )}
        <div style={{ fontWeight: 900, fontSize: fs + 3, letterSpacing: 1 }}>
          {(profile.storeName || "SHOP").toUpperCase()}
        </div>
        {profile.address && <div style={{ fontSize: fs - 1 }}>{profile.address}</div>}
        {profile.phone   && <div style={{ fontSize: fs - 1 }}>{profile.phone}</div>}
        {profile.email   && <div style={{ fontSize: fs - 1 }}>{profile.email}</div>}
      </div>

      <Dash />

      {/* ── INVOICE META ── */}
      <div style={{ fontSize: fs - 1, marginBottom: 4, width: "100%" }}>
        <div className="th-row">
          <span>Invoice:</span>
          <span style={{ fontWeight: 700 }}>{invoiceNo}</span>
        </div>
        <div className="th-row">
          <span>Date:</span>
          <span>{fmtDate(invoiceDate)}</span>
        </div>
        {customerName && customerName !== "Walk-in Customer" && (
          <div className="th-row">
            <span>Customer:</span>
            <span style={{ fontWeight: 600 }}>{customerName}</span>
          </div>
        )}
        <div className="th-row">
          <span>Payment:</span>
          <span style={{ fontWeight: 600 }}>
            {isSplit ? "Split (Cash + UPI)" : paymentMode}
          </span>
        </div>
      </div>

      <Dash />

      {/* ── ITEMS ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 3 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ textAlign: "left",  padding: "2px 0",   fontWeight: 700 }}>Item</th>
            <th style={{ textAlign: "right", padding: "2px 2px", fontWeight: 700 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "2px 2px", fontWeight: 700 }}>Rate</th>
            <th style={{ textAlign: "right", padding: "2px 0",   fontWeight: 700 }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #ccc" }}>
              <td style={{ padding: "2px 0" }}>
                <div>{r.product}</div>
                {r.code    && <div style={{ fontSize: fs - 2 }}>{r.code}</div>}
                {r.discPct > 0 && <div style={{ fontSize: fs - 2 }}>Disc: {r.discPct}%</div>}
                {r.taxPct  > 0 && <div style={{ fontSize: fs - 2 }}>GST: {r.taxPct}%</div>}
              </td>
              <td style={{ textAlign: "right", padding: "2px 2px" }}>{r.qty}</td>
              <td style={{ textAlign: "right", padding: "2px 2px" }}>₹{r.price.toFixed(0)}</td>
              <td style={{ textAlign: "right", padding: "2px 0", fontWeight: 600 }}>₹{r.total.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── BILL SUMMARY ── */}
      <div style={{ borderTop: "1px dashed #999", paddingTop: 4, fontSize: fs - 1, width: "100%" }}>
        {mrpTotal !== subTotal && (
          <div className="th-row">
            <span className="th-center">MRP Total</span>
            <span style={{ fontWeight: 600 }}>{fmt(mrpTotal)}</span>
          </div>
        )}
        <div className="th-row">
          <span className="th-center">Subtotal</span>
          <span style={{ fontWeight: 600 }}>{fmt(subTotal)}</span>
        </div>
        {discTotal > 0 && (
          <div className="th-row">
            <span className="th-center">Discount</span>
            <span style={{ fontWeight: 600 }}>- {fmt(discTotal)}</span>
          </div>
        )}
        {taxableAmt > 0 && discTotal > 0 && (
          <div className="th-row">
            <span className="th-center">Taxable Amt</span>
            <span style={{ fontWeight: 600 }}>{fmt(taxableAmt)}</span>
          </div>
        )}
        {cgst > 0 && (
          <div className="th-row">
            <span className="th-center">CGST</span>
            <span style={{ fontWeight: 600 }}>{fmt(cgst)}</span>
          </div>
        )}
        {sgst > 0 && (
          <div className="th-row">
            <span className="th-center">SGST</span>
            <span style={{ fontWeight: 600 }}>{fmt(sgst)}</span>
          </div>
        )}

        <Solid />

        <div className="th-row" style={{ fontWeight: 900, fontSize: fs - 1 }}>
          <span className="th-center">TOTAL</span>
          <span>{fmt(totalAmount)}</span>
        </div>

        {/* Split breakdown */}
        {isSplit && cashPortion !== null && (
          <>
            <div className="th-row" style={{ fontSize: fs - 1, marginTop: 2 }}>
              <span className="th-center">└ Cash</span>
              <span style={{ fontWeight: 600 }}>{fmt(cashPortion)}</span>
            </div>
            <div className="th-row" style={{ fontSize: fs - 1 }}>
              <span className="th-center">└ UPI</span>
              <span style={{ fontWeight: 700 }}>{fmt(qrAmount)}</span>
            </div>
          </>
        )}

        {/* Paid / change for Cash & Card */}
        {!isUpi && !isSplit && (
          <>
            <div className="th-row" style={{ fontSize: fs - 1 }}>
              <span className="th-center">Paid ({paymentMode})</span>
              <span style={{ fontWeight: 600 }}>{fmt(paidAmount)}</span>
            </div>
            {change > 0 && (
              <div className="th-row" style={{ fontSize: fs - 1 }}>
                <span className="th-center">Change</span>
                <span style={{ fontWeight: 600 }}>{fmt(change)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      {settings.showAmountInWords && (
        <div style={{ fontSize: fs - 2, marginTop: 4, fontStyle: "italic", textAlign: "center" }}>
          {amountToWords(totalAmount)}
        </div>
      )}

      {/* ── UPI QR — only for UPI / Split payments ── */}
      {(isUpi || isSplit) && settings.showQR && profile.upiId && qrAmount > 0 && (
        <>
          <Dash />
          <div style={{ textAlign: "center", marginTop: 4, marginBottom: 4 }}>
            <div style={{ fontSize: fs, fontWeight: 700, letterSpacing: 0.3, marginBottom: 3 }}>
              {isSplit ? "Pay UPI Portion" : "Scan & Pay"}
            </div>
            <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 4px" }}>
              <QrImg dataUrl={props.qrDataUrl} size={qrSize} />
            </div>
            <div style={{ fontSize: fs + 4, fontWeight: 900, letterSpacing: -0.5, marginBottom: 1 }}>
              {fmt(qrAmount)}
            </div>
            {isSplit && cashPortion !== null && (
              <div style={{ fontSize: fs - 1, marginBottom: 1 }}>
                (Cash {fmt(cashPortion)} + UPI {fmt(qrAmount)})
              </div>
            )}
            <div style={{ fontSize: fs - 2 }}>{profile.upiId}</div>
          </div>
          <Dash />
        </>
      )}

      {/* ── TERMS ── */}
      {settings.showTerms && settings.termsText && (
        <div style={{ borderTop: "1px dashed #999", marginTop: 5, paddingTop: 4,
          fontSize: fs - 2, textAlign: "center" }}>
          {settings.termsText}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ borderTop: "1px dashed #999", marginTop: 5, paddingTop: 4,
        textAlign: "center", fontSize: fs - 1 }}>
        {settings.footerText}
      </div>

      {/* ── SIGNATURE ── */}
      {settings.showSignature && (
        <div style={{ marginTop: 16, fontSize: fs - 1, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4,
            display: "inline-block", minWidth: 100 }}>
            Authorised Signatory
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// A4 / A5 RECEIPT
// =============================================================
function A4Receipt(props: ReceiptProps) {
  const {
    invoiceNo, customerName, invoiceDate,
    rows, mrpTotal, subTotal, discTotal, taxableAmt, cgst, sgst,
    roundingAdj, totalAmount, paidAmount, paymentMode,
    settings, profile, splitUpiAmt,
  } = props;

  const c      = settings.primaryColor;
  const fs     = settings.fontSize === "small" ? 11 : settings.fontSize === "large" ? 15 : 13;
  const isA5   = settings.paperType === "A5";
  const pad    = `${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm`;
  const change = Math.max(0, paidAmount - totalAmount);

  const isUpi   = paymentMode === "UPI";
  const isSplit = paymentMode === "Split";
  const needsQr = (isUpi || isSplit) && !!profile.upiId && settings.showQR;
  const qrAmount = isSplit && splitUpiAmt !== undefined ? splitUpiAmt : totalAmount;
  const cashPortion = isSplit && splitUpiAmt !== undefined ? totalAmount - splitUpiAmt : null;

  return (
    <div className="pos-receipt" style={{
      width: isA5 ? "148mm" : "210mm",
      background: "#fff", fontFamily: settings.fontFamily,
      fontSize: fs, color: "#1E293B", padding: pad,
    }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 14, paddingBottom: 12, borderBottom: `3px solid ${c}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {settings.showLogo && profile.logoUrl && (
            <img src={profile.logoUrl} alt="logo"
              style={{ width: settings.logoSize ?? 56, height: settings.logoSize ?? 56, objectFit: "contain", borderRadius: 8 }} />
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
            background: c, color: "#fff", borderRadius: 6, fontWeight: 700,
            display: "inline-block" }}>
            {isSplit ? "Split (Cash + UPI)" : paymentMode}
          </div>
        </div>
      </div>

      {/* ── CUSTOMER ── */}
      {customerName && customerName !== "Walk-in Customer" && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#F8FAFC",
          borderLeft: `3px solid ${c}`, borderRadius: "0 6px 6px 0" }}>
          <div style={{ fontSize: fs - 1, fontWeight: 600, color: c }}>BILLED TO</div>
          <div style={{ fontWeight: 700 }}>{customerName}</div>
        </div>
      )}

      {/* ── ITEMS TABLE ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr style={{ background: c, color: "#fff" }}>
            {["#","Item","Qty","MRP","Rate","Disc","GST%","Amount"].map((h, i) => (
              <th key={h} style={{
                padding: "6px 8px",
                textAlign: i > 1 ? "right" : "left",
                fontSize: fs - 1,
              }}>{h}</th>
            ))}
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
                ₹{Math.round(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTALS BLOCK ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 240, maxWidth: 300 }}>
          {[
            mrpTotal !== subTotal ? ["MRP Total", fmt(mrpTotal), "#64748B"] : null,
            ["Subtotal",           fmt(subTotal),  "#000"],
            discTotal > 0 ? ["Discount", `- ${fmt(discTotal)}`, "#EF4444"] : null,
            taxableAmt > 0 && discTotal > 0 ? ["Taxable Amount", fmt(taxableAmt), "#000"] : null,
            cgst > 0 ? ["CGST", fmt(cgst), "#000"] : null,
            sgst > 0 ? ["SGST", fmt(sgst), "#000"] : null,
          ].filter(Boolean).map(([label, value, color]) => (
            <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: fs - 1, marginBottom: 3 }}>
              <span style={{ color: "#64748B" }}>{label}</span>
              <span style={{ color: (color as string) || "#1E293B" }}>{value}</span>
            </div>
          ))}
          {/* Grand total */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            background: c, color: "#fff", padding: "6px 10px",
            borderRadius: 6, fontWeight: 800, fontSize: fs - 1, marginTop: 4,
          }}>
            <span>TOTAL</span><span>{fmt(totalAmount)}</span>
          </div>
          {isSplit && cashPortion !== null && (
            <div style={{ marginTop: 5, fontSize: fs - 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                <span>└ Cash portion</span><span>{fmt(cashPortion)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: c, fontWeight: 700 }}>
                <span>└ UPI portion</span><span>{fmt(qrAmount)}</span>
              </div>
            </div>
          )}
          {!isUpi && !isSplit && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, marginTop: 4, color: "#64748B" }}>
                <span>Paid ({paymentMode})</span>
                <span style={{ fontWeight: 600, color: "#1E293B" }}>{fmt(paidAmount)}</span>
              </div>
              {change > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, color: "#22C55E", fontWeight: 600 }}>
                  <span>Change</span><span>{fmt(change)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      {settings.showAmountInWords && (
        <div style={{ fontSize: fs - 1, color: "#64748B", marginBottom: 8, fontStyle: "italic" }}>
          {amountToWords(totalAmount)}
        </div>
      )}

      {/* ── UPI QR — only for UPI / Split payments ── */}
      {(isUpi || isSplit) && settings.showQR && profile.upiId && qrAmount > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `2px dashed ${c}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <div style={{ fontSize: fs + 1, fontWeight: 800, color: c, letterSpacing: 0.5 }}>
            {isSplit ? "Scan QR to Pay UPI Portion" : "Scan QR to Pay"}
          </div>
          {isSplit && cashPortion !== null && (
            <div style={{ fontSize: fs - 1, color: "#64748B" }}>Cash {fmt(cashPortion)} + UPI {fmt(qrAmount)}</div>
          )}
          <div style={{ border: `3px solid ${c}`, borderRadius: 12, padding: 10, marginTop: 4 }}>
            <QrImg dataUrl={props.qrDataUrl} size={settings.qrSize ?? 160} />
          </div>
          <div style={{ fontSize: fs + 8, fontWeight: 900, color: c, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>
            {fmt(qrAmount)}
          </div>
          {profile.upiId && (
            <div style={{ fontSize: fs - 1, color: "#64748B" }}>{profile.upiId}</div>
          )}
          <div style={{ paddingBottom: 8, borderBottom: `2px dashed ${c}`, width: "100%" }} />
        </div>
      )}

      {/* ── TERMS ── */}
      {settings.showTerms && settings.termsText && (
        <div style={{ fontSize: fs - 1, color: "#64748B", borderTop: "1px solid #E2E8F0", paddingTop: 8, marginTop: 8 }}>
          <strong style={{ color: c }}>Terms: </strong>{settings.termsText}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `2px solid ${c}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontStyle: "italic", color: c, fontSize: fs }}>{settings.footerText}</div>
        {settings.showSignature && (
          <div style={{ fontSize: fs - 1, color: "#64748B", textAlign: "right" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 4, minWidth: 120 }}>Authorised Signatory</div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// MAIN EXPORT — picks Thermal or A4/A5
// =============================================================
export function PosPrintReceipt(props: ReceiptProps) {
  const isTherm = props.settings.paperType.startsWith("Thermal");
  return isTherm ? <ThermalReceipt {...props} /> : <A4Receipt {...props} />;
}