import { useState, useRef } from "react";
import {
  Printer, AlignLeft, AlignCenter, AlignRight,
  ChevronDown, ChevronUp, Upload, X, Check,
} from "lucide-react";
import { usePrintStore } from "@/store/print.store";
import { useBusinessStore } from "@/store/business.store";
import { toast } from "sonner";

// =============================================================
// TYPES
// =============================================================

type BillStyleId =
  | "classic" | "bold"   | "minimal"  | "boxed"  | "double-line"
  | "banner"  | "split"  | "stamp"    | "clean"  | "invoice";

type Align = "left" | "center" | "right";

interface LocalSettings {
  billStyle:         BillStyleId;
  paperWidthMm:      number;
  headerAlign:       Align;
  bodyAlign:         Align;
  footerAlign:       Align;
  showLogo:          boolean;
  logoUrl:           string;
  fontSize:          "small" | "medium" | "large";
  fontFamily:        string;
  copies:            number;
  autoCut:           boolean;
  showFooter:        boolean;
  footerText:        string;
  showTerms:         boolean;
  termsText:         string;
  showAmountInWords: boolean;
  showSignature:     boolean;
  showGST:           boolean;
  tableStyle:        "minimal" | "bordered" | "compact";
  marginTop:         number;
  marginBottom:      number;
  marginLeft:        number;
  marginRight:       number;
}

// =============================================================
// 10 BILL STYLE DEFINITIONS — each has a unique preview renderer
// =============================================================
const BILL_STYLES: {
  id:      BillStyleId;
  name:    string;
  desc:    string;
  preview: (shopName: string) => React.ReactNode;
}[] = [
  {
    id: "classic", name: "Classic", desc: "Centred header, dashed dividers",
    preview: n => (
      <div style={{ textAlign: "center", fontFamily: "monospace" }}>
        <div style={{ fontWeight: 900, fontSize: 8, letterSpacing: 1, marginBottom: 2 }}>{n}</div>
        <div style={{ borderTop: "1px dashed #999", margin: "2px 0" }} />
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ borderTop: "1px dashed #999", margin: "2px 0" }} />
        <div style={{ fontWeight: 700, fontSize: 7 }}>TOTAL   ₹150</div>
        <div style={{ fontSize: 6, color: "#666", marginTop: 2 }}>Thank you!</div>
      </div>
    ),
  },
  {
    id: "bold", name: "Bold", desc: "Oversized shop name, double rule",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", padding: "2px 0", textAlign: "center", fontWeight: 900, fontSize: 9, letterSpacing: 2 }}>{n}</div>
        <div style={{ fontSize: 6.5, marginTop: 2 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ borderTop: "2px solid #000", marginTop: 3, paddingTop: 1, fontWeight: 700, fontSize: 7, textAlign: "right" }}>₹150</div>
      </div>
    ),
  },
  {
    id: "minimal", name: "Minimal", desc: "Pure text, zero decoration",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ fontWeight: 700, fontSize: 7.5 }}>{n}</div>
        <div style={{ fontSize: 5.5, color: "#777" }}>INV-001  01 Sep 2026</div>
        <div style={{ fontSize: 6.5, marginTop: 3 }}>Product A         ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B          ₹50</div>
        <div style={{ fontSize: 7, fontWeight: 700, marginTop: 2 }}>Total             ₹150</div>
      </div>
    ),
  },
  {
    id: "boxed", name: "Boxed", desc: "Outline border around header",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ border: "1px solid #000", padding: "3px 5px", textAlign: "center", fontWeight: 900, fontSize: 8, marginBottom: 3 }}>{n}</div>
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ borderTop: "1px solid #000", marginTop: 2, paddingTop: 1, fontWeight: 700, fontSize: 7 }}>TOTAL ₹150</div>
      </div>
    ),
  },
  {
    id: "double-line", name: "Double Line", desc: "CASH MEMO band under header",
    preview: n => (
      <div style={{ textAlign: "center", fontFamily: "monospace" }}>
        <div style={{ fontWeight: 900, fontSize: 8 }}>{n}</div>
        <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", margin: "2px 0", padding: "1px 0", fontSize: 6, fontWeight: 700, letterSpacing: 2 }}>CASH MEMO</div>
        <div style={{ fontSize: 6.5, textAlign: "left" }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5, textAlign: "left" }}>Product B ........... ₹50</div>
        <div style={{ fontWeight: 700, fontSize: 7 }}>TOTAL   ₹150</div>
      </div>
    ),
  },
  {
    id: "banner", name: "Banner", desc: "Black inverted header bar",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ background: "#000", color: "#fff", padding: "3px 5px", textAlign: "center", fontWeight: 900, fontSize: 8, letterSpacing: 1 }}>{n}</div>
        <div style={{ fontSize: 6.5, marginTop: 2 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ background: "#000", color: "#fff", padding: "2px 4px", marginTop: 2, fontWeight: 700, fontSize: 7, textAlign: "right" }}>₹150</div>
      </div>
    ),
  },
  {
    id: "split", name: "Split", desc: "Logo circle left, details right",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
          <div style={{ width: 20, height: 20, border: "1.5px solid #000", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 9, flexShrink: 0 }}>{n[0]}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 7.5 }}>{n}</div>
            <div style={{ fontSize: 5.5, color: "#777" }}>INV-001 | Cash</div>
          </div>
        </div>
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ fontWeight: 700, fontSize: 7, marginTop: 2 }}>TOTAL ₹150</div>
      </div>
    ),
  },
  {
    id: "stamp", name: "Stamp", desc: "Dotted frame, centred bold total",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ border: "2px dotted #000", padding: "3px 5px", textAlign: "center", fontWeight: 900, fontSize: 8, marginBottom: 3 }}>{n}</div>
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ border: "2px dotted #000", marginTop: 3, padding: "2px 0", fontWeight: 700, fontSize: 7, textAlign: "center" }}>** TOTAL ₹150 **</div>
      </div>
    ),
  },
  {
    id: "clean", name: "Clean", desc: "Thick top rule, date on right",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ borderTop: "3px solid #000", paddingTop: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 3 }}>
            <div style={{ fontWeight: 900, fontSize: 8 }}>{n}</div>
            <div style={{ fontSize: 5.5, color: "#666" }}>01 Sep 26</div>
          </div>
        </div>
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ textAlign: "right", fontWeight: 700, fontSize: 7, marginTop: 2 }}>₹150</div>
      </div>
    ),
  },
  {
    id: "invoice", name: "Invoice", desc: "Formal GST invoice header",
    preview: n => (
      <div style={{ fontFamily: "monospace" }}>
        <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 2, marginBottom: 2 }}>
          <div style={{ fontWeight: 900, fontSize: 9 }}>{n}</div>
          <div style={{ fontSize: 5.5, color: "#666" }}>GSTIN: 29XXXXX1234Z5</div>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1 }}>TAX INVOICE</div>
        </div>
        <div style={{ fontSize: 6.5 }}>Product A ......... ₹100</div>
        <div style={{ fontSize: 6.5 }}>Product B ........... ₹50</div>
        <div style={{ fontWeight: 700, fontSize: 7, marginTop: 2 }}>TOTAL ₹150</div>
      </div>
    ),
  },
];

const FONT_OPTIONS = ["Inter", "Roboto", "Mono", "Noto Sans", "Poppins"];
const MM_TO_PX     = 3.78;

// =============================================================
// SHARED UI ATOMS
// =============================================================

const inp: React.CSSProperties = {
  border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 9px",
  fontSize: 12, color: "#111", background: "#fff", outline: "none", fontFamily: "inherit",
};

function Panel({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 10, background: "#fff", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(p => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#111", letterSpacing: "0.03em" }}>{title.toUpperCase()}</span>
        {open ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />}
      </button>
      {open && <div style={{ padding: "0 14px 14px", borderTop: "1px solid #F3F4F6" }}>{children}</div>}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "10px 0", borderBottom: "1px solid #F9FAFB" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Tog({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      style={{ width: 38, height: 21, borderRadius: 11, background: value ? "#111" : "#D1D5DB",
        border: "none", cursor: "pointer", outline: "none", position: "relative",
        transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: value ? 19 : 2, width: 17, height: 17,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );
}

function AlignPicker({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  const opts: { v: Align; icon: React.ReactNode }[] = [
    { v: "left",   icon: <AlignLeft   size={13} /> },
    { v: "center", icon: <AlignCenter size={13} /> },
    { v: "right",  icon: <AlignRight  size={13} /> },
  ];
  return (
    <div style={{ display: "flex", border: "1px solid #D1D5DB", borderRadius: 6, overflow: "hidden" }}>
      {opts.map(({ v, icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ width: 32, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderRight: v !== "right" ? "1px solid #D1D5DB" : "none",
            background: value === v ? "#111" : "#fff", color: value === v ? "#fff" : "#6B7280",
            cursor: "pointer", outline: "none", transition: "background 0.15s, color 0.15s" }}>
          {icon}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, onChange, min = 1, max = 5 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid #D1D5DB", borderRadius: 6, overflow: "hidden" }}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 28, height: 28, border: "none", background: "#F9FAFB", cursor: "pointer", fontSize: 16, color: "#374151", outline: "none" }}>−</button>
      <span style={{ width: 32, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#111" }}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 28, height: 28, border: "none", background: "#F9FAFB", cursor: "pointer", fontSize: 16, color: "#374151", outline: "none" }}>+</button>
    </div>
  );
}

// =============================================================
// LIVE RECEIPT PREVIEW
// =============================================================
function ReceiptPreview({ s, shopName, address, phone, logoUrl }: {
  s: LocalSettings; shopName: string; address: string; phone: string; logoUrl: string;
}) {
  const w   = Math.round(s.paperWidthMm * MM_TO_PX);
  const fs  = s.fontSize === "small" ? 9 : s.fontSize === "large" ? 13 : 11;
  const pad = `${s.marginTop}px ${s.marginRight}px ${s.marginBottom}px ${s.marginLeft}px`;
  const bs  = s.billStyle;

  const Dash  = () => <div style={{ borderTop: "1px dashed #999", margin: "5px 0" }} />;
  const Solid = () => <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />;

  const LogoEl = () => !s.showLogo ? null : logoUrl
    ? <img src={logoUrl} alt="logo" style={{ width: 40, height: 40, objectFit: "contain", display: "block" }} />
    : <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #000",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: fs + 5, flexShrink: 0 }}>
        {shopName.charAt(0).toUpperCase()}
      </div>;

  const justifyFor = (a: Align) => a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center";

  const ShopInfo = ({ align }: { align: Align }) => (
    <div style={{ textAlign: align }}>
      <div style={{ fontWeight: 900, fontSize: fs + (bs === "bold" ? 5 : 2), letterSpacing: bs === "bold" ? 2 : 0.5 }}>
        {(shopName || "YOUR SHOP").toUpperCase()}
      </div>
      {address && <div style={{ fontSize: fs - 1, color: "#555" }}>{address}</div>}
      {phone   && <div style={{ fontSize: fs - 1, color: "#555" }}>{phone}</div>}
    </div>
  );

  const logoJustify = justifyFor(s.headerAlign);

  const Header = () => {
    if (bs === "split") return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <LogoEl />
        <div style={{ flex: 1 }}><ShopInfo align={s.headerAlign} /></div>
      </div>
    );

    if (bs === "banner") return (
      <div style={{ background: "#000", color: "#fff", padding: "6px 8px", textAlign: s.headerAlign }}>
        {s.showLogo && logoUrl && <img src={logoUrl} alt="logo" style={{ width: 30, height: 30, objectFit: "contain", display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />}
        <div style={{ fontWeight: 900, fontSize: fs + 3, letterSpacing: 1 }}>{(shopName || "YOUR SHOP").toUpperCase()}</div>
        {address && <div style={{ fontSize: fs - 1, color: "#ccc" }}>{address}</div>}
        {phone   && <div style={{ fontSize: fs - 1, color: "#ccc" }}>{phone}</div>}
      </div>
    );

    if (bs === "boxed") return (
      <div style={{ border: "1px solid #000", padding: "5px 8px", textAlign: s.headerAlign, marginBottom: 5 }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: logoJustify, marginBottom: 3 }}><LogoEl /></div>}
        <ShopInfo align={s.headerAlign} />
      </div>
    );

    if (bs === "stamp") return (
      <div style={{ border: "2px dotted #000", padding: "5px 8px", textAlign: s.headerAlign, marginBottom: 5 }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: logoJustify, marginBottom: 3 }}><LogoEl /></div>}
        <ShopInfo align={s.headerAlign} />
      </div>
    );

    if (bs === "bold") return (
      <div style={{ borderTop: "2.5px solid #000", borderBottom: "2.5px solid #000", padding: "4px 0", textAlign: s.headerAlign }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: logoJustify, marginBottom: 3 }}><LogoEl /></div>}
        <ShopInfo align={s.headerAlign} />
      </div>
    );

    if (bs === "double-line") return (
      <div style={{ textAlign: s.headerAlign }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: logoJustify, marginBottom: 3 }}><LogoEl /></div>}
        <ShopInfo align={s.headerAlign} />
        <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", margin: "3px 0", padding: "1px 0", fontSize: fs - 1, fontWeight: 700, letterSpacing: 2 }}>CASH MEMO</div>
      </div>
    );

    if (bs === "clean") return (
      <div style={{ borderTop: "3px solid #000", paddingTop: 4, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {s.showLogo && <LogoEl />}
            <div>
              <div style={{ fontWeight: 900, fontSize: fs + 3 }}>{(shopName || "YOUR SHOP").toUpperCase()}</div>
              {address && <div style={{ fontSize: fs - 1, color: "#555" }}>{address}</div>}
            </div>
          </div>
          <div style={{ fontSize: fs - 1, color: "#555", textAlign: "right" }}>
            <div>01 Sep 2026</div>
            {phone && <div>{phone}</div>}
          </div>
        </div>
      </div>
    );

    if (bs === "invoice") return (
      <div style={{ textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 5, marginBottom: 4 }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><LogoEl /></div>}
        <div style={{ fontWeight: 900, fontSize: fs + 4, letterSpacing: 1 }}>{(shopName || "YOUR SHOP").toUpperCase()}</div>
        {address && <div style={{ fontSize: fs - 1, color: "#555" }}>{address}</div>}
        {phone   && <div style={{ fontSize: fs - 1, color: "#555" }}>{phone}</div>}
        <div style={{ fontSize: fs - 1, fontWeight: 700, letterSpacing: 2, marginTop: 3, borderTop: "1px solid #ccc", paddingTop: 2 }}>TAX INVOICE</div>
      </div>
    );

    if (bs === "minimal") return (
      <div style={{ marginBottom: 5 }}>
        <div style={{ fontWeight: 700, fontSize: fs + 1 }}>{shopName || "Your Shop"}</div>
        {address && <div style={{ fontSize: fs - 1, color: "#666" }}>{address}</div>}
        {phone   && <div style={{ fontSize: fs - 1, color: "#666" }}>{phone}</div>}
      </div>
    );

    // classic
    return (
      <div style={{ textAlign: s.headerAlign, marginBottom: 5 }}>
        {s.showLogo && <div style={{ display: "flex", justifyContent: logoJustify, marginBottom: 4 }}><LogoEl /></div>}
        <ShopInfo align={s.headerAlign} />
      </div>
    );
  };

  const items = [
    { name: "Product A", qty: 2, rate: 150, total: 300 },
    { name: "Product B", qty: 1, rate: 499, total: 499 },
    { name: "Item C",    qty: 3, rate: 80,  total: 240 },
  ];
  const subtotal = 1039, tax = 52, total = 1091;
  const bordered = s.tableStyle === "bordered";
  const compact  = s.tableStyle === "compact";
  const noTopDash = ["bold","double-line","banner","boxed","stamp","clean","invoice"].includes(bs);

  return (
    <div style={{ width: w, background: "#fff", fontFamily: s.fontFamily, fontSize: fs,
      color: "#000", padding: pad, boxShadow: "0 4px 24px rgba(0,0,0,0.13)", borderRadius: 2, flexShrink: 0 }}>

      <Header />
      {!noTopDash && <Dash />}
      {bs === "banner" && <Dash />}

      {/* meta */}
      <div style={{ fontSize: fs - 1, marginBottom: 4 }}>
        {[["Invoice:", "#INV-0042"], ["Date:", "01 Sep 2026"], ["Customer:", "Rahul Kumar"], ["Payment:", "Cash"]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{k}</span><span style={{ fontWeight: k === "Invoice:" ? 700 : 400 }}>{v}</span>
          </div>
        ))}
      </div>

      <Dash />

      {/* table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1,
        marginBottom: compact ? 2 : 4, border: bordered ? "1px solid #000" : "none" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            {["Item", "Qty", "Rate", "Amt"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: compact ? "1px 2px" : "2px 2px",
                border: bordered ? "1px solid #000" : "none", fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i} style={{ borderBottom: bordered ? "1px solid #ccc" : "1px dotted #ccc" }}>
              <td style={{ padding: compact ? "1px 0" : "2px 0", border: bordered ? "1px solid #ccc" : "none" }}>{r.name}</td>
              <td style={{ textAlign: "right", padding: "2px 2px", border: bordered ? "1px solid #ccc" : "none" }}>{r.qty}</td>
              <td style={{ textAlign: "right", padding: "2px 2px", border: bordered ? "1px solid #ccc" : "none" }}>₹{r.rate}</td>
              <td style={{ textAlign: "right", padding: "2px 0", fontWeight: 600, border: bordered ? "1px solid #ccc" : "none" }}>₹{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div style={{ borderTop: "1px dashed #999", paddingTop: 4, fontSize: fs - 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#555" }}>Subtotal</span><span>₹{subtotal}</span>
        </div>
        {s.showGST && <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#555" }}>CGST (2.5%)</span><span>₹{tax / 2}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#555" }}>SGST (2.5%)</span><span>₹{tax / 2}</span>
          </div>
        </>}
        <Solid />
        {bs === "stamp"
          ? <div style={{ textAlign: "center", fontWeight: 900, fontSize: fs + 1 }}>** TOTAL ₹{total} **</div>
          : <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: fs + 1 }}>
              <span>TOTAL</span><span>₹{total}</span>
            </div>
        }
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, color: "#555" }}>
          <span>Paid (Cash)</span><span>₹{total}</span>
        </div>
      </div>

      {s.showAmountInWords && (
        <div style={{ fontSize: fs - 2, color: "#555", marginTop: 4, fontStyle: "italic" }}>
          One Thousand Ninety One Rupees Only
        </div>
      )}
      {s.showTerms && s.termsText && (
        <div style={{ borderTop: "1px dashed #ccc", marginTop: 5, paddingTop: 4, fontSize: fs - 2, color: "#555" }}>
          {s.termsText}
        </div>
      )}
      {s.showFooter && s.footerText && (
        <div style={{
          borderTop: bs === "banner" ? "none" : "1px dashed #999",
          marginTop: 5, paddingTop: 4, textAlign: s.footerAlign, fontSize: fs - 1,
          ...(bs === "banner" ? { background: "#000", color: "#fff", padding: "4px 8px",
            marginLeft: -s.marginLeft, marginRight: -s.marginRight } : { color: "#555" }),
        }}>
          {s.footerText}
        </div>
      )}
      {s.showSignature && (
        <div style={{ marginTop: 14, fontSize: fs - 1, textAlign: "right" }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "inline-block", minWidth: 90 }}>
            Auth. Signatory
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// MAIN PAGE
// =============================================================
export default function PrintSettingsPage() {
  const { settings: stored, updateSettings } = usePrintStore();
  const { profile } = useBusinessStore();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [s, setS] = useState<LocalSettings>({
    billStyle:         "classic",
    paperWidthMm:      stored.paperType === "Thermal 58mm" ? 58 : 80,
    headerAlign:       "center",
    bodyAlign:         "left",
    footerAlign:       "center",
    showLogo:          stored.showLogo,
    logoUrl:           "",
    fontSize:          stored.fontSize,
    fontFamily:        stored.fontFamily,
    copies:            stored.copies,
    autoCut:           false,
    showFooter:        true,
    footerText:        stored.footerText,
    showTerms:         stored.showTerms,
    termsText:         stored.termsText,
    showAmountInWords: stored.showAmountInWords,
    showSignature:     stored.showSignature,
    showGST:           true,
    tableStyle:        (stored.tableStyle === "striped" ? "minimal" : stored.tableStyle) as LocalSettings["tableStyle"],
    marginTop:         stored.marginTop,
    marginBottom:      stored.marginBottom,
    marginLeft:        stored.marginLeft,
    marginRight:       stored.marginRight,
  });

  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    setS(p => ({ ...p, [key]: value }));
    setDirty(true);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setS(p => ({ ...p, logoUrl: ev.target?.result as string, showLogo: true }));
      setDirty(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    updateSettings({
      paperType:         s.paperWidthMm <= 60 ? "Thermal 58mm" : "Thermal 80mm",
      showLogo:          s.showLogo,
      fontSize:          s.fontSize,
      fontFamily:        s.fontFamily,
      copies:            s.copies,
      footerText:        s.footerText,
      showTerms:         s.showTerms,
      termsText:         s.termsText,
      showAmountInWords: s.showAmountInWords,
      showSignature:     s.showSignature,
      tableStyle:        s.tableStyle === "compact" ? "minimal" : s.tableStyle,
      marginTop:         s.marginTop,
      marginBottom:      s.marginBottom,
      marginLeft:        s.marginLeft,
      marginRight:       s.marginRight,
    });
    setSaving(false);
    setDirty(false);
    toast.success("Print settings saved.");
  }

  const shopName = profile?.storeName || "Your Shop";
  const address  = profile?.address   || "123 Main Street, City";
  const phone    = profile?.phone     || "+91 98765 43210";
  const logoUrl  = s.logoUrl || profile?.logoUrl || "";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      background: "#F9FAFB", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>

      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 24px", background: "#fff", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Printer size={18} color="#111" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Print Settings</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Thermal printer · Black &amp; white</div>
          </div>
        </div>
        <button type="button" onClick={handleSave} disabled={!dirty || saving}
          style={{ background: dirty ? "#111" : "#E5E7EB", color: dirty ? "#fff" : "#9CA3AF",
            border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700,
            cursor: dirty ? "pointer" : "not-allowed", fontFamily: "inherit", outline: "none",
            transition: "background 0.2s, color 0.2s" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT */}
        <div style={{ width: 360, flexShrink: 0, overflowY: "auto", padding: "14px 14px", borderRight: "1px solid #E5E7EB" }}>

          {/* ── 10 BILL STYLE GALLERY ── */}
          <Panel title="Bill Layout Style">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10 }}>
              {BILL_STYLES.map(bs => (
                <div key={bs.id} onClick={() => update("billStyle", bs.id)} style={{ cursor: "pointer" }}>
                  {/* thumbnail card */}
                  <div style={{
                    height: 88, background: "#fff",
                    border: s.billStyle === bs.id ? "2px solid #111" : "1px solid #D1D5DB",
                    borderRadius: 7, overflow: "hidden", padding: "6px 8px",
                    boxSizing: "border-box", position: "relative",
                    transition: "border 0.15s",
                  }}>
                    {s.billStyle === bs.id && (
                      <span style={{ position: "absolute", top: 4, right: 4, width: 15, height: 15,
                        borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </span>
                    )}
                    {bs.preview(shopName.slice(0, 8).toUpperCase() || "SHOP")}
                  </div>
                  {/* label */}
                  <div style={{ marginTop: 5, paddingLeft: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>{bs.name}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.3 }}>{bs.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* LOGO */}
          <Panel title="Logo">
            <Row label="Show Logo on Bill">
              <Tog value={s.showLogo} onChange={v => update("showLogo", v)} />
            </Row>
            {s.showLogo && (
              <div style={{ paddingTop: 8 }}>
                {s.logoUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={s.logoUrl} alt="logo preview"
                      style={{ width: 56, height: 56, objectFit: "contain", border: "1px solid #E5E7EB", borderRadius: 6, background: "#F9FAFB" }} />
                    <div>
                      <div style={{ fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 4 }}>Logo uploaded</div>
                      <button type="button" onClick={() => update("logoUrl", "")}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B7280",
                          background: "none", border: "1px solid #D1D5DB", borderRadius: 5, padding: "3px 8px",
                          cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                        <X size={10} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "16px 0", border: "1.5px dashed #D1D5DB", borderRadius: 8, background: "#F9FAFB",
                      cursor: "pointer", color: "#6B7280", fontFamily: "inherit", outline: "none" }}>
                    <Upload size={18} />
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Upload Logo</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>PNG · JPG · SVG</div>
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
              </div>
            )}
          </Panel>

          {/* ALIGNMENT */}
          <Panel title="Content Alignment">
            <Row label="Header"><AlignPicker value={s.headerAlign} onChange={v => update("headerAlign", v)} /></Row>
            <Row label="Body / Items"><AlignPicker value={s.bodyAlign} onChange={v => update("bodyAlign", v)} /></Row>
            <Row label="Footer"><AlignPicker value={s.footerAlign} onChange={v => update("footerAlign", v)} /></Row>
          </Panel>

          {/* TYPOGRAPHY */}
          <Panel title="Typography">
            <Row label="Font Size">
              <select value={s.fontSize} onChange={e => update("fontSize", e.target.value as LocalSettings["fontSize"])} style={{ ...inp, minWidth: 130 }}>
                <option value="small">Small (9px)</option>
                <option value="medium">Medium (11px)</option>
                <option value="large">Large (13px)</option>
              </select>
            </Row>
            <Row label="Font Family">
              <select value={s.fontFamily} onChange={e => update("fontFamily", e.target.value)} style={{ ...inp, minWidth: 130 }}>
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Row>
          </Panel>

          {/* PAPER & PRINTER */}
          <Panel title="Paper &amp; Printer">

            {/* ── width slider ── */}
            <div style={{ paddingTop: 10, paddingBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Paper Width</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#111", fontVariantNumeric: "tabular-nums" }}>
                  {s.paperWidthMm} mm
                </span>
              </div>

              <input type="range" min={48} max={112} step={1} value={s.paperWidthMm}
                onChange={e => update("paperWidthMm", Number(e.target.value))}
                style={{ width: "100%", accentColor: "#111", cursor: "pointer", height: 4 }} />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>48 mm</span>
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>112 mm</span>
              </div>

              {/* quick presets */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[{ mm: 58, label: "58 mm" }, { mm: 80, label: "80 mm" }].map(({ mm, label }) => (
                  <button key={mm} type="button" onClick={() => update("paperWidthMm", mm)}
                    style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600,
                      border: s.paperWidthMm === mm ? "2px solid #111" : "1px solid #D1D5DB",
                      borderRadius: 7, background: s.paperWidthMm === mm ? "#111" : "#fff",
                      color: s.paperWidthMm === mm ? "#fff" : "#374151",
                      cursor: "pointer", fontFamily: "inherit", outline: "none", transition: "all 0.15s" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Row label="Copies per Print">
              <Stepper value={s.copies} onChange={v => update("copies", v)} min={1} max={5} />
            </Row>
            <Row label="Auto-cut after Print" desc="Printer must support cutter">
              <Tog value={s.autoCut} onChange={v => update("autoCut", v)} />
            </Row>

            {/* margins */}
            <div style={{ paddingTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8, letterSpacing: "0.04em" }}>MARGINS (px)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["marginTop", "marginBottom", "marginLeft", "marginRight"] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 3, textTransform: "capitalize" }}>{k.replace("margin", "")}</div>
                    <input type="number" min={0} max={30} value={s[k]}
                      onChange={e => update(k, Number(e.target.value))}
                      style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* CONTENT OPTIONS */}
          <Panel title="Content Options">
            <Row label="Table Style">
              <select value={s.tableStyle} onChange={e => update("tableStyle", e.target.value as LocalSettings["tableStyle"])} style={{ ...inp, minWidth: 120 }}>
                <option value="minimal">Minimal</option>
                <option value="bordered">Bordered</option>
                <option value="compact">Compact</option>
              </select>
            </Row>
            <Row label="Show GST Breakup"><Tog value={s.showGST} onChange={v => update("showGST", v)} /></Row>
            <Row label="Amount in Words"><Tog value={s.showAmountInWords} onChange={v => update("showAmountInWords", v)} /></Row>
            <Row label="Signature Line"><Tog value={s.showSignature} onChange={v => update("showSignature", v)} /></Row>
          </Panel>

          {/* FOOTER & TERMS */}
          <Panel title="Footer &amp; Terms" defaultOpen={false}>
            <Row label="Show Footer"><Tog value={s.showFooter} onChange={v => update("showFooter", v)} /></Row>
            {s.showFooter && (
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Footer Text</div>
                <input type="text" value={s.footerText} onChange={e => update("footerText", e.target.value)}
                  style={{ ...inp, width: "100%", boxSizing: "border-box" }} placeholder="e.g. Thank you for your purchase!" />
              </div>
            )}
            <Row label="Show Terms"><Tog value={s.showTerms} onChange={v => update("showTerms", v)} /></Row>
            {s.showTerms && (
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Terms Text</div>
                <textarea value={s.termsText} onChange={e => update("termsText", e.target.value)} rows={3}
                  style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }}
                  placeholder="e.g. Goods once sold will not be returned." />
              </div>
            )}
          </Panel>

        </div>

        {/* RIGHT — live preview */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
          alignItems: "center", padding: "32px 24px", background: "#F3F4F6" }}>

          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em" }}>
              LIVE PREVIEW — {s.paperWidthMm} mm
            </div>
          </div>

          <ReceiptPreview s={s} shopName={shopName} address={address} phone={phone} logoUrl={logoUrl} />

          <div style={{ marginTop: 20, fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.6 }}>
            Preview uses sample data.<br />Actual print uses your transaction details.
          </div>
        </div>

      </div>
    </div>
  );
}
