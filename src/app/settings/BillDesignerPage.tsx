import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Monitor, Smartphone,
  Copy, Trash2, RefreshCw, Star, Printer,
  HelpCircle, Upload, Download, Eye, Save, Plus,
} from "lucide-react";
import { useBusinessStore } from "@/store/business.store";

// =============================================================
// BILL DESIGNER PAGE — full rewrite
// 3-column layout: LEFT=library, CENTER=canvas, RIGHT=properties
// =============================================================

// ── Types ─────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  type: "A4" | "Thermal";
  color: string;
  isDefault?: boolean;
}

interface PrintConfig {
  paperType:         "A4" | "A5" | "Thermal 80mm" | "Thermal 58mm";
  orientation:       "portrait" | "landscape";
  marginTop:         number;
  marginBottom:      number;
  marginLeft:        number;
  marginRight:       number;
  showLogo:          boolean;
  showSignature:     boolean;
  showBankDetails:   boolean;
  showQR:            boolean;
  showTerms:         boolean;
  showAmountInWords: boolean;
  fontSize:          "small" | "medium" | "large";
  primaryColor:      string;
  fontFamily:        string;
  copies:            number;
  autoPrint:         boolean;
  footerText:        string;
  termsText:         string;
  headerAlign:       "left" | "center" | "right";
  layoutStyle:       "standard" | "compact" | "spacious";
  tableStyle:        "striped" | "bordered" | "minimal";
  businessNameSize:  "small" | "medium" | "large";
  accentStyle:       "solid" | "gradient" | "outline";
}

const DEFAULT_CONFIG: PrintConfig = {
  paperType: "A4", orientation: "portrait",
  marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10,
  showLogo: true, showSignature: false, showBankDetails: false,
  showQR: true, showTerms: true, showAmountInWords: true,
  fontSize: "medium", primaryColor: "#F97316", fontFamily: "Inter",
  copies: 1, autoPrint: false,
  footerText: "Thank you for your business!",
  termsText: "Goods once sold will not be taken back.\nWarranty as per manufacturer policy.",
  headerAlign: "left",
  layoutStyle: "standard",
  tableStyle: "striped",
  businessNameSize: "medium",
  accentStyle: "solid",
};

const TEMPLATES: Template[] = [
  // ── A4 ────────────────────────────────────────────────────
  { id: "modern",      name: "01 Modern",      type: "A4",      color: "#F97316", isDefault: true },
  { id: "elegant",     name: "02 Elegant",     type: "A4",      color: "#6B7280" },
  { id: "premium",     name: "03 Premium",     type: "A4",      color: "#0F172A" },
  { id: "pharmacy",    name: "04 Pharmacy",    type: "A4",      color: "#0EA5E9" },
  { id: "restaurant",  name: "05 Restaurant",  type: "A4",      color: "#DC2626" },
  { id: "boutique",    name: "06 Boutique",    type: "A4",      color: "#9333EA" },
  { id: "electronics", name: "07 Electronics", type: "A4",      color: "#06B6D4" },
  { id: "wholesale",   name: "08 Wholesale",   type: "A4",      color: "#16A34A" },
  { id: "services",    name: "09 Services",    type: "A4",      color: "#D97706" },
  { id: "minimal",     name: "10 Minimal",     type: "A4",      color: "#1E293B" },
  // ── Thermal ───────────────────────────────────────────────
  { id: "th-retail",      name: "01 Retail",       type: "Thermal", color: "#1E293B" },
  { id: "th-grocery",     name: "02 Grocery",      type: "Thermal", color: "#16A34A" },
  { id: "th-restaurant",  name: "03 Restaurant",   type: "Thermal", color: "#DC2626" },
  { id: "th-pharmacy",    name: "04 Pharmacy",     type: "Thermal", color: "#0EA5E9" },
  { id: "th-fashion",     name: "05 Fashion",      type: "Thermal", color: "#9333EA" },
  { id: "th-electronics", name: "06 Electronics",  type: "Thermal", color: "#0284C7" },
  { id: "th-cafe",        name: "07 Café",         type: "Thermal", color: "#92400E" },
  { id: "th-hardware",    name: "08 Hardware",     type: "Thermal", color: "#0F766E" },
  { id: "th-services",    name: "09 Services",     type: "Thermal", color: "#D97706" },
  { id: "th-minimal",     name: "10 Minimal",      type: "Thermal", color: "#475569" },
];

const FONT_FAMILIES = ["Inter", "Roboto", "Lato", "Open Sans", "Poppins", "Noto Sans"];
const FONT_SIZES    = [
  { v: "small",  l: "Small (10px)" },
  { v: "medium", l: "Medium (12px)" },
  { v: "large",  l: "Large (14px)" },
];

// ── Shared style constants ────────────────────────────────────
const sel: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px",
  fontSize: 12, color: "#1E293B", background: "#F8FAFC", outline: "none",
  fontFamily: "inherit", cursor: "pointer",
};

const numInp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px",
  fontSize: 12, color: "#1E293B", background: "#F8FAFC", outline: "none",
  fontFamily: "inherit", width: 52, textAlign: "right",
};

const iconBtnS: React.CSSProperties = {
  width: 28, height: 28, border: "1px solid #E2E8F0", borderRadius: 6,
  background: "#fff", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", outline: "none",
};

// ── Small helpers ─────────────────────────────────────────────
function PropSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px", background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#F97316" }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>{title}</span>
        </div>
        {open ? <ChevronDown size={14} color="#94A3B8" /> : <ChevronRight size={14} color="#94A3B8" />}
      </button>
      {open && <div style={{ padding: "4px 14px 14px" }}>{children}</div>}
    </div>
  );
}

function Tog({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width: 36, height: 20, borderRadius: 10, background: value ? "#F97316" : "#E2E8F0",
        border: "none", cursor: "pointer", outline: "none", position: "relative",
        transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function PR({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
      {children}
    </div>
  );
}

// ── TriBtn: 3-option radio-style selector ─────────────────────
function TriBtn<T extends string>({ options, value, onChange }: {
  options: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "none",
            background: value === o.v ? "#F97316" : "#F1F5F9",
            color: value === o.v ? "#fff" : "#64748B",
            fontSize: 11, fontWeight: value === o.v ? 700 : 500,
            cursor: "pointer", fontFamily: "inherit", outline: "none", transition: "all 0.15s" }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── Sample data used across all preview renders ───────────────
const SAMPLE_ITEMS = [
  { name: "Wireless Mouse",  hsn: "84716060", qty: 1, rate: 850,   disc: 0 },
  { name: "Keyboard",        hsn: "84716040", qty: 1, rate: 1250,  disc: 0 },
  { name: "USB Type-C Cable",hsn: "85444290", qty: 2, rate: 350,   disc: 0 },
];

type ProfileArg = {
  storeName: string; address: string;
  phone: string; email: string; upiId: string;
};

// ── Utility: row background for table style ───────────────────
function rowBg(idx: number, tableStyle: PrintConfig["tableStyle"], accent: string): string {
  if (tableStyle === "striped") return idx % 2 === 0 ? "#fff" : "#F8FAFC";
  return "#fff";
}
function rowBorder(tableStyle: PrintConfig["tableStyle"], accent: string): string {
  if (tableStyle === "bordered") return `1px solid ${accent}40`;
  if (tableStyle === "minimal")  return "none";
  return "1px solid #F1F5F9";
}

// ═══════════════════════════════════════════════════════════════
// A4 TEMPLATE RENDERERS
// Each returns a JSX element representing the full invoice layout.
// ═══════════════════════════════════════════════════════════════

// ── 01 Modern: orange left accent bar, header top-right ────────
function TplModern({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 6 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  const pad = config.layoutStyle === "compact" ? 8 : config.layoutStyle === "spacious" ? 20 : 14;
  return (
    <div style={{ display: "flex", gap: 0, minHeight: 560, fontFamily: config.fontFamily }}>
      {/* Left accent bar */}
      <div style={{ width: 8, background: c, borderRadius: "4px 0 0 4px", flexShrink: 0 }} />
      <div style={{ flex: 1, padding: pad, background: "#fff" }}>
        {/* Top: logo left, address right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {config.showLogo && (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: c,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 20 }}>
                {(profile.storeName || "O").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: bnFs, color: c }}>{profile.storeName || "Your Business"}</div>
              <div style={{ fontSize: fs - 1, color: "#94A3B8" }}>Modern Invoice</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: fs - 1, color: "#64748B" }}>
            <div style={{ fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>INVOICE</div>
            <div>No: <strong>INV-2024-0123</strong></div>
            <div>Date: 24 May 2024</div>
            <div>{profile.phone || "+91 98765 43210"}</div>
          </div>
        </div>
        {/* Orange rule */}
        <div style={{ height: 3, background: c, marginBottom: 10, borderRadius: 2 }} />
        {/* Bill To row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: fs - 1 }}>
          <div>
            <div style={{ fontWeight: 700, color: c, marginBottom: 3 }}>BILL TO</div>
            <div style={{ fontWeight: 600 }}>Rajesh Kumar</div>
            <div style={{ color: "#64748B" }}>No. 45, MG Road, Bengaluru</div>
            <div style={{ color: "#64748B" }}>+91 98765 12345</div>
          </div>
          <div style={{ background: "#FFF7ED", borderLeft: `3px solid ${c}`, padding: "6px 10px", borderRadius: "0 6px 6px 0" }}>
            <div style={{ color: "#64748B" }}>Due: <strong style={{ color: "#1E293B" }}>31 May 2024</strong></div>
            <div style={{ color: "#64748B" }}>Mode: <strong style={{ color: "#1E293B" }}>UPI</strong></div>
          </div>
        </div>
        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
          <thead>
            <tr style={{ background: c, color: "#fff" }}>
              {["#","Item","Qty","Rate","Amount"].map(h => (
                <th key={h} style={{ padding: "5px 7px", textAlign: h === "#" || h === "Item" ? "left" : "right", fontSize: fs - 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((it, i) => (
              <tr key={i} style={{ background: rowBg(i, config.tableStyle, c), borderBottom: rowBorder(config.tableStyle, c) }}>
                <td style={{ padding: "4px 7px", fontSize: fs - 1 }}>{i + 1}</td>
                <td style={{ padding: "4px 7px", fontSize: fs - 1 }}>{it.name}</td>
                <td style={{ padding: "4px 7px", fontSize: fs - 1, textAlign: "right" }}>{it.qty}</td>
                <td style={{ padding: "4px 7px", fontSize: fs - 1, textAlign: "right" }}>₹{it.rate}</td>
                <td style={{ padding: "4px 7px", fontSize: fs - 1, textAlign: "right" }}>₹{it.qty * it.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <div style={{ minWidth: 200 }}>
            {[["Subtotal","₹2,450"],["GST 18%","₹441"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: fs-1, marginBottom: 2 }}>
                <span style={{ color: "#64748B" }}>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", background: c, color: "#fff",
              padding: "5px 8px", borderRadius: 4, fontWeight: 700, marginTop: 4, fontSize: fs }}>
              <span>Total</span><span>₹2,891</span>
            </div>
          </div>
        </div>
        {config.showAmountInWords && <div style={{ fontSize: fs-1, color: "#64748B", marginBottom: 6 }}><strong style={{ color: c }}>Amount: </strong>Two Thousand Eight Hundred Ninety One Only</div>}
        {config.showTerms && <div style={{ fontSize: fs-1, marginBottom: 6 }}><strong style={{ color: c }}>Terms: </strong><span style={{ color: "#64748B" }}>{config.termsText.split("\n")[0]}</span></div>}
        <div style={{ borderTop: `2px solid ${c}`, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontStyle: "italic", color: c, fontSize: fs }}>{config.footerText}</div>
          {config.showQR && <div style={{ width: 44, height: 44, border: "1px solid #E2E8F0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontSize: 8, color: "#94A3B8" }}>QR</div>}
        </div>
        {config.showSignature && <div style={{ marginTop: 12, fontSize: fs-1, borderTop: "1px solid #E2E8F0", paddingTop: 6, textAlign: "right", color: "#64748B" }}>Authorised Signatory</div>}
      </div>
    </div>
  );
}

// ── 02 Elegant: centered header, thin dividers, italic, grey ──
function TplElegant({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 8 : config.businessNameSize === "small" ? fs + 3 : fs + 5;
  return (
    <div style={{ background: "#fff", padding: 16, fontFamily: config.fontFamily, minHeight: 560, color: "#374151" }}>
      {/* Centered header */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {config.showLogo && (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F3F4F6", border: `2px solid ${c}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 6px", color: c, fontWeight: 800, fontSize: 18 }}>
            {(profile.storeName || "O").charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: bnFs, letterSpacing: 2, color: "#1F2937" }}>{(profile.storeName || "YOUR BUSINESS").toUpperCase()}</div>
        <div style={{ fontSize: fs - 1, color: "#9CA3AF", fontStyle: "italic" }}>{profile.address || "123 Main Street, City"}</div>
        <div style={{ fontSize: fs - 1, color: "#9CA3AF" }}>{profile.phone} · {profile.email}</div>
      </div>
      <div style={{ borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "4px 0", textAlign: "center", marginBottom: 10 }}>
        <span style={{ fontSize: fs + 1, fontWeight: 700, letterSpacing: 4, color: "#374151" }}>INVOICE</span>
        <span style={{ fontSize: fs - 1, color: "#9CA3AF", marginLeft: 12 }}>INV-2024-0123 · 24 May 2024</span>
      </div>
      {/* Bill To row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: fs - 1, borderBottom: "1px solid #E5E7EB", paddingBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, color: "#6B7280", marginBottom: 2, fontSize: fs - 2, letterSpacing: 1 }}>BILLED TO</div>
          <div style={{ fontWeight: 700, fontStyle: "italic", fontSize: fs + 1, color: "#1F2937" }}>Rajesh Kumar</div>
          <div style={{ color: "#9CA3AF" }}>MG Road, Bengaluru</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "#6B7280", marginBottom: 2, fontSize: fs - 2, letterSpacing: 1 }}>DETAILS</div>
          <div>Due: <span style={{ fontStyle: "italic" }}>31 May 2024</span></div>
          <div>Mode: Cash</div>
        </div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${c}` }}>
            {["Item","Qty","Rate","Amount"].map(h => (
              <th key={h} style={{ padding: "4px 6px", textAlign: h === "Item" ? "left" : "right",
                fontSize: fs - 2, fontWeight: 700, letterSpacing: 1, color: "#6B7280" }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: rowBg(i, config.tableStyle, c) }}>
              <td style={{ padding: "5px 6px", fontSize: fs - 1, fontStyle: i === 1 ? "italic" : "normal" }}>{it.name}</td>
              <td style={{ padding: "5px 6px", fontSize: fs - 1, textAlign: "right" }}>{it.qty}</td>
              <td style={{ padding: "5px 6px", fontSize: fs - 1, textAlign: "right" }}>₹{it.rate}</td>
              <td style={{ padding: "5px 6px", fontSize: fs - 1, textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <div style={{ minWidth: 180 }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #E5E7EB", paddingTop: 6, fontWeight: 700, fontSize: fs }}>
            <span style={{ color: "#374151" }}>Total</span><span style={{ color: c }}>₹2,891</span>
          </div>
        </div>
      </div>
      {config.showTerms && <div style={{ fontSize: fs - 2, color: "#9CA3AF", fontStyle: "italic", borderTop: "1px solid #E5E7EB", paddingTop: 6 }}>{config.termsText.split("\n")[0]}</div>}
      <div style={{ textAlign: "center", marginTop: 8, fontSize: fs - 1, color: "#9CA3AF", fontStyle: "italic" }}>{config.footerText}</div>
    </div>
  );
}

// ── 03 Premium: dark navy header band, white text, stark contrast ──
function TplPremium({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const navy = "#0F172A";
  const bnFs = config.businessNameSize === "large" ? fs + 7 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#fff", fontFamily: config.fontFamily, minHeight: 560, overflow: "hidden" }}>
      {/* Full-width navy header band */}
      <div style={{ background: navy, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {config.showLogo && (
            <div style={{ width: 44, height: 44, borderRadius: 8, background: c,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: 22 }}>
              {(profile.storeName || "O").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: bnFs, letterSpacing: 1 }}>{(profile.storeName || "PREMIUM CORP").toUpperCase()}</div>
            <div style={{ color: "#94A3B8", fontSize: fs - 2 }}>{profile.address || "Premium Business Solutions"}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: c, fontWeight: 900, fontSize: fs + 4, letterSpacing: 2 }}>INVOICE</div>
          <div style={{ color: "#94A3B8", fontSize: fs - 1 }}>INV-2024-0123</div>
          <div style={{ color: "#94A3B8", fontSize: fs - 1 }}>24 May 2024</div>
        </div>
      </div>
      {/* Accent stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${c}, #fff)` }} />
      {/* Body */}
      <div style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: fs - 1 }}>
          <div style={{ background: "#F8FAFC", border: `1px solid ${navy}20`, borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontWeight: 700, color: navy, marginBottom: 4, fontSize: fs - 2, letterSpacing: 1 }}>BILLED TO</div>
            <div style={{ fontWeight: 700, fontSize: fs + 1 }}>Rajesh Kumar</div>
            <div style={{ color: "#64748B" }}>MG Road, Bengaluru</div>
            <div style={{ color: "#64748B" }}>+91 98765 12345</div>
          </div>
          <div style={{ background: navy, borderRadius: 8, padding: "8px 12px", color: "#fff", textAlign: "right" }}>
            <div style={{ fontSize: fs - 2, color: "#94A3B8", marginBottom: 4 }}>PAYMENT INFO</div>
            <div>Due: <strong>31 May 2024</strong></div>
            <div>Mode: <strong>UPI</strong></div>
            <div style={{ marginTop: 4, color: c, fontWeight: 700 }}>UNPAID</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr style={{ background: navy, color: "#fff" }}>
              {["#","Item","Qty","Rate","Amt"].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: h === "#" || h === "Item" ? "left" : "right", fontSize: fs - 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((it, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F1F5F9", borderBottom: rowBorder(config.tableStyle, navy) }}>
                <td style={{ padding: "5px 8px", fontSize: fs - 1 }}>{i + 1}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1 }}>{it.name}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right" }}>{it.qty}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right" }}>₹{it.rate}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right", fontWeight: 700 }}>₹{it.qty * it.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: navy, color: "#fff", borderRadius: 8, padding: "8px 14px", minWidth: 180 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, marginBottom: 2 }}>
              <span style={{ color: "#94A3B8" }}>Subtotal</span><span>₹2,450</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, borderTop: "1px solid #334155", paddingTop: 4, fontWeight: 900 }}>
              <span>TOTAL</span><span style={{ color: c }}>₹2,891</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: navy, padding: "6px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#94A3B8", fontSize: fs - 1, fontStyle: "italic" }}>{config.footerText}</div>
        {config.showQR && <div style={{ width: 36, height: 36, border: "1px solid #334155", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: "#1E293B", fontSize: 8, color: "#94A3B8" }}>QR</div>}
      </div>
    </div>
  );
}
