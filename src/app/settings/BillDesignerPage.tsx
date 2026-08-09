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

// ── 04 Pharmacy: blue header, 2-column with big INVOICE stamp ──
function TplPharmacy({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 6 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#fff", fontFamily: config.fontFamily, minHeight: 560 }}>
      {/* Blue header */}
      <div style={{ background: c, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {config.showLogo && (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", color: c, fontWeight: 900, fontSize: 18 }}>
              {(profile.storeName || "P").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: bnFs }}>
              {profile.storeName || "City Pharmacy"}
            </div>
            <div style={{ color: "#BAE6FD", fontSize: fs - 2 }}>Licensed Pharmacy · Dl No. 12-AB-345</div>
          </div>
        </div>
        <div style={{ textAlign: "right", color: "#fff" }}>
          <div style={{ fontSize: fs - 1 }}>{profile.phone}</div>
          <div style={{ fontSize: fs - 1 }}>{profile.address}</div>
        </div>
      </div>
      {/* 2-column body */}
      <div style={{ display: "flex", gap: 0, padding: "12px 16px" }}>
        {/* Left: customer + items */}
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, color: c }}>PATIENT / CUSTOMER</div>
              <div style={{ fontWeight: 600 }}>Rajesh Kumar</div>
              <div style={{ color: "#64748B" }}>Age: 35 | Dr. Sharma</div>
            </div>
            <div style={{ fontSize: fs - 1 }}>
              <div>Date: <strong>24 May 2024</strong></div>
              <div>Bill No: <strong>INV-0123</strong></div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1 }}>
            <thead>
              <tr style={{ background: `${c}18`, borderBottom: `2px solid ${c}` }}>
                {["Medicine","Qty","MRP","Amt"].map(h => (
                  <th key={h} style={{ padding: "4px 6px", textAlign: h === "Medicine" ? "left" : "right", color: c }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[{name:"Paracetamol 500mg",qty:2,rate:45},{name:"Cough Syrup 100ml",qty:1,rate:85},{name:"Vitamin D3 Caps",qty:1,rate:320}].map((it,i) => (
                <tr key={i} style={{ borderBottom: rowBorder(config.tableStyle, c), background: rowBg(i, config.tableStyle, c) }}>
                  <td style={{ padding: "4px 6px" }}>{it.name}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>{it.qty}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>₹{it.rate}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Right: big INVOICE stamp + totals */}
        <div style={{ width: 140, borderLeft: `2px dashed ${c}40`, paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ border: `3px double ${c}`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: fs + 8, fontWeight: 900, color: c, letterSpacing: 2 }}>BILL</div>
            <div style={{ fontSize: fs - 2, color: "#64748B" }}>INV-2024-0123</div>
          </div>
          <div style={{ fontSize: fs - 1 }}>
            {[["Sub","₹535"],["Disc","₹0"],["GST","₹96"],["Total","₹631"]].map(([k,v],idx) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontWeight: idx === 3 ? 700 : 400,
                color: idx === 3 ? c : "#374151", borderTop: idx === 3 ? `1px solid ${c}` : "none",
                paddingTop: idx === 3 ? 4 : 0, marginBottom: 3 }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          {config.showQR && <div style={{ width: "100%", aspectRatio: "1", border: "1px solid #E2E8F0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontSize: 8, color: "#94A3B8" }}>QR Pay</div>}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${c}`, margin: "0 16px", paddingTop: 6, paddingBottom: 8, fontSize: fs - 1, color: "#64748B", textAlign: "center" }}>
        {config.footerText} · {config.showTerms && config.termsText.split("\n")[0]}
      </div>
    </div>
  );
}

// ── 05 Restaurant: red checkered border, centered business name large ──
function TplRestaurant({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 10 : config.businessNameSize === "small" ? fs + 4 : fs + 7;
  return (
    <div style={{ background: "#fff", fontFamily: config.fontFamily, minHeight: 560,
      border: `6px solid ${c}`, outline: `3px solid #fff`, outlineOffset: "-10px" }}>
      <div style={{ padding: "16px 20px" }}>
        {/* Centered large business name */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          {config.showLogo && (
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: c, margin: "0 auto 6px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: 26 }}>
              {(profile.storeName || "R").charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontWeight: 900, fontSize: bnFs, color: c, letterSpacing: 2 }}>
            {(profile.storeName || "LA BELLA CUCINA").toUpperCase()}
          </div>
          <div style={{ fontSize: fs - 1, color: "#9CA3AF", letterSpacing: 1 }}>Fine Dining · Est. 2010</div>
          <div style={{ fontSize: fs - 1, color: "#6B7280" }}>{profile.address} · {profile.phone}</div>
        </div>
        {/* Decorative separator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: c }} />
          <span style={{ color: c, fontSize: fs + 2 }}>✦</span>
          <div style={{ flex: 1, height: 1, background: c }} />
        </div>
        {/* Invoice tag */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: fs - 1 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Table No: <span style={{ color: c }}>12</span></div>
            <div>Guest: Rajesh Kumar</div>
            <div style={{ color: "#9CA3AF" }}>Covers: 3</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, color: c, fontSize: fs + 1 }}>KOT #{" "}0123</div>
            <div>24 May 2024, 8:30 PM</div>
            <div>Server: Amit</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
          <thead>
            <tr style={{ background: c, color: "#fff" }}>
              {["Item","Qty","Price","Total"].map(h => (
                <th key={h} style={{ padding: "5px 8px", textAlign: h === "Item" ? "left" : "right", fontSize: fs - 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[{name:"Grilled Salmon",qty:2,rate:480},{name:"Caesar Salad",qty:1,rate:280},{name:"Tiramisu",qty:2,rate:220}].map((it,i) => (
              <tr key={i} style={{ background: rowBg(i, config.tableStyle, c), borderBottom: rowBorder(config.tableStyle, c) }}>
                <td style={{ padding: "5px 8px", fontSize: fs - 1 }}>{it.name}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right" }}>{it.qty}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right" }}>₹{it.rate}</td>
                <td style={{ padding: "5px 8px", fontSize: fs - 1, textAlign: "right" }}>₹{it.qty * it.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ minWidth: 200 }}>
            {[["Subtotal","₹1,680"],["Service Charge (10%)","₹168"],["CGST (2.5%)","₹46"],["SGST (2.5%)","₹46"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: fs - 1, marginBottom: 2 }}>
                <span style={{ color: "#6B7280" }}>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", background: c, color: "#fff",
              padding: "6px 10px", borderRadius: 4, fontWeight: 700, marginTop: 4, fontSize: fs + 1 }}>
              <span>GRAND TOTAL</span><span>₹1,940</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: fs - 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 4 }}>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ color: c, fontStyle: "italic", fontWeight: 600 }}>{config.footerText}</span>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </div>
          {config.showTerms && <div style={{ fontSize: fs - 2, color: "#9CA3AF" }}>{config.termsText.split("\n")[0]}</div>}
        </div>
      </div>
    </div>
  );
}

// ── 06 Boutique: purple, decorative header [ Business Name ] ──
function TplBoutique({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 7 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#FAF5FF", fontFamily: config.fontFamily, minHeight: 560, padding: "16px 20px" }}>
      {/* Decorative header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: fs - 1, color: c, letterSpacing: 3, marginBottom: 4 }}>✦ ✦ ✦</div>
        {config.showLogo && (
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: c, margin: "0 auto 6px",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>
            {(profile.storeName || "B").charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ color: c, fontSize: bnFs + 2, fontWeight: 300 }}>[</span>
          <span style={{ fontWeight: 800, fontSize: bnFs, color: "#4B0082", letterSpacing: 2 }}>
            {(profile.storeName || "LA BOUTIQUE").toUpperCase()}
          </span>
          <span style={{ color: c, fontSize: bnFs + 2, fontWeight: 300 }}>]</span>
        </div>
        <div style={{ fontSize: fs - 1, color: "#A78BFA", letterSpacing: 1 }}>Couture · Collections · Craftsmanship</div>
        <div style={{ fontSize: fs - 1, color: "#9CA3AF" }}>{profile.address} · {profile.phone}</div>
      </div>
      {/* Thin decorative border */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${c}, transparent)`, marginBottom: 12 }} />
      {/* Invoice info row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: fs - 1 }}>
        <div style={{ background: "#fff", border: `1px solid ${c}40`, borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ fontWeight: 600, color: c, marginBottom: 2 }}>Bill To</div>
          <div style={{ fontWeight: 700 }}>Priya Sharma</div>
          <div style={{ color: "#9CA3AF" }}>Member #PM-0456</div>
        </div>
        <div style={{ textAlign: "right", background: "#fff", border: `1px solid ${c}40`, borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ fontWeight: 700, color: c }}>RECEIPT</div>
          <div>#INV-2024-0123</div>
          <div style={{ color: "#9CA3AF" }}>24 May 2024</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${c}` }}>
            {["Item","Size","Qty","Price","Amount"].map(h => (
              <th key={h} style={{ padding: "5px 7px", textAlign: h === "Item" ? "left" : "right",
                fontSize: fs - 2, color: c, fontWeight: 700, letterSpacing: 1 }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[{name:"Silk Scarf",size:"One size",qty:1,rate:1200},{name:"Linen Kurti",size:"M",qty:2,rate:1800},{name:"Embrd Clutch",size:"Std",qty:1,rate:950}].map((it,i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${c}20`, background: rowBg(i, config.tableStyle, c) }}>
              <td style={{ padding: "5px 7px", fontSize: fs - 1 }}>{it.name}</td>
              <td style={{ padding: "5px 7px", fontSize: fs - 1, textAlign: "right", color: "#9CA3AF" }}>{it.size}</td>
              <td style={{ padding: "5px 7px", fontSize: fs - 1, textAlign: "right" }}>{it.qty}</td>
              <td style={{ padding: "5px 7px", fontSize: fs - 1, textAlign: "right" }}>₹{it.rate}</td>
              <td style={{ padding: "5px 7px", fontSize: fs - 1, textAlign: "right", fontWeight: 600, color: "#4B0082" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ minWidth: 190, background: "#fff", border: `1px solid ${c}40`, borderRadius: 8, padding: "8px 12px" }}>
          {[["Subtotal","₹5,750"],["Member Disc","- ₹575"]].map(([k,v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, marginBottom: 3 }}>
              <span style={{ color: "#9CA3AF" }}>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#4B0082",
            borderTop: `1px solid ${c}40`, paddingTop: 5, fontSize: fs }}>
            <span>Total</span><span>₹5,175</span>
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${c}, transparent)`, marginBottom: 8 }} />
      <div style={{ textAlign: "center", fontSize: fs - 1, color: "#A78BFA", fontStyle: "italic" }}>{config.footerText}</div>
    </div>
  );
}

// ── 07 Electronics: dark tech style, monospace font, cyan accent ──
function TplElectronics({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const mono = "'Courier New', 'Courier', monospace";
  const bnFs = config.businessNameSize === "large" ? fs + 6 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#0D1117", fontFamily: mono, minHeight: 560, padding: "16px 18px", color: "#E6EDF3" }}>
      {/* Terminal-style header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
        <div style={{ flex: 1, textAlign: "center", fontSize: fs - 2, color: "#6E7681" }}>invoice.sys — v1.0</div>
      </div>
      <div style={{ borderBottom: `1px solid ${c}40`, paddingBottom: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: c, fontWeight: 700, fontSize: bnFs }}>
              {config.showLogo && <span style={{ border: `1px solid ${c}`, padding: "0 4px", marginRight: 6, fontSize: fs - 1 }}>&gt;_</span>}
              {(profile.storeName || "TechZone Electronics").toUpperCase()}
            </div>
            <div style={{ color: "#6E7681", fontSize: fs - 2 }}>// {profile.address || "Tech Hub, Bengaluru"}</div>
            <div style={{ color: "#6E7681", fontSize: fs - 2 }}>// {profile.phone}</div>
          </div>
          <div style={{ textAlign: "right", color: "#E6EDF3" }}>
            <div style={{ color: c, fontWeight: 700, fontSize: fs + 2 }}>{"<INVOICE />"}</div>
            <div style={{ fontSize: fs - 1, color: "#6E7681" }}>INV-2024-0123</div>
            <div style={{ fontSize: fs - 1, color: "#6E7681" }}>2024-05-24</div>
          </div>
        </div>
      </div>
      {/* Bill to in code comment style */}
      <div style={{ fontSize: fs - 1, marginBottom: 10, color: "#6E7681" }}>
        <div>{"/* CUSTOMER: Rajesh Kumar"}</div>
        <div>{"   PHONE:    +91 98765 12345"}</div>
        <div>{"   ORDER:    INV-2024-0123  */"}</div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, fontSize: fs - 1 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${c}` }}>
            {["ITEM","QTY","UNIT_PRICE","TOTAL"].map(h => (
              <th key={h} style={{ padding: "4px 7px", textAlign: h === "ITEM" ? "left" : "right", color: c, fontWeight: 700, fontSize: fs - 2 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((it, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${c}20`, background: rowBg(i, config.tableStyle, c) === "#F8FAFC" ? "#161B22" : "#0D1117" }}>
              <td style={{ padding: "4px 7px", color: "#E6EDF3" }}>{it.name}</td>
              <td style={{ padding: "4px 7px", textAlign: "right", color: "#79C0FF" }}>{it.qty}</td>
              <td style={{ padding: "4px 7px", textAlign: "right", color: "#7EE787" }}>₹{it.rate}</td>
              <td style={{ padding: "4px 7px", textAlign: "right", color: c, fontWeight: 700 }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totals in code style */}
      <div style={{ borderTop: `1px solid ${c}40`, paddingTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ fontSize: fs - 1, minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6E7681", marginBottom: 2 }}>
            <span>// subtotal</span><span>₹2,450</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6E7681", marginBottom: 4 }}>
            <span>// gst_18</span><span>₹441</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: c, fontSize: fs }}>
            <span>TOTAL =&gt;</span><span>₹2,891</span>
          </div>
        </div>
      </div>
      {config.showTerms && <div style={{ marginTop: 8, fontSize: fs - 2, color: "#6E7681" }}>{"/* "}{config.termsText.split("\n")[0]}{" */"}</div>}
      <div style={{ marginTop: 8, borderTop: `1px solid ${c}40`, paddingTop: 6, fontSize: fs - 1, color: "#6E7681", display: "flex", justifyContent: "space-between" }}>
        <span>{"// "}{config.footerText}</span>
        {config.showQR && <div style={{ width: 36, height: 36, border: `1px solid ${c}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: c }}>QR</div>}
      </div>
    </div>
  );
}

// ── 08 Wholesale: green, condensed columns, table-focused ─────
function TplWholesale({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 5 : config.businessNameSize === "small" ? fs + 1 : fs + 3;
  return (
    <div style={{ background: "#fff", fontFamily: config.fontFamily, minHeight: 560 }}>
      {/* Compact top strip */}
      <div style={{ background: c, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {config.showLogo && (
            <div style={{ width: 36, height: 36, borderRadius: 4, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", color: c, fontWeight: 900, fontSize: 16 }}>
              {(profile.storeName || "W").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: bnFs }}>{profile.storeName || "Wholesale Mart"}</div>
            <div style={{ color: "#BBF7D0", fontSize: fs - 2 }}>Bulk Supplier · GST Registered</div>
          </div>
        </div>
        <div style={{ color: "#fff", textAlign: "right", fontSize: fs - 2 }}>
          <div style={{ fontWeight: 700, fontSize: fs + 2 }}>TAX INVOICE</div>
          <div>{profile.phone} | {profile.email}</div>
        </div>
      </div>
      {/* Green sub-bar with invoice info */}
      <div style={{ background: `${c}15`, padding: "5px 14px", display: "flex", gap: 20, fontSize: fs - 2, borderBottom: `1px solid ${c}30` }}>
        {[["Invoice#","INV-2024-0123"],["Date","24 May 2024"],["Due","31 May 2024"],["Terms","Net 7"]].map(([k,v]) => (
          <div key={k}><span style={{ color: "#64748B" }}>{k}: </span><strong>{v}</strong></div>
        ))}
      </div>
      <div style={{ padding: "10px 14px" }}>
        {/* Supplier + Buyer in 2 columns */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: fs - 1 }}>
          <div style={{ flex: 1, background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 6, padding: "7px 10px" }}>
            <div style={{ fontWeight: 700, color: c, marginBottom: 3, fontSize: fs - 2 }}>SUPPLIER</div>
            <div style={{ fontWeight: 600 }}>{profile.storeName || "Wholesale Mart"}</div>
            <div style={{ color: "#64748B" }}>{profile.address}</div>
            <div style={{ color: "#64748B" }}>GSTIN: 29ABCDE1234F1Z5</div>
          </div>
          <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "7px 10px" }}>
            <div style={{ fontWeight: 700, color: "#475569", marginBottom: 3, fontSize: fs - 2 }}>BUYER</div>
            <div style={{ fontWeight: 600 }}>Rajesh Kumar Traders</div>
            <div style={{ color: "#64748B" }}>MG Road, Bengaluru</div>
            <div style={{ color: "#64748B" }}>GSTIN: 29XYZAB1234G1Z8</div>
          </div>
        </div>
        {/* Dense items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, fontSize: fs - 2 }}>
          <thead>
            <tr style={{ background: c, color: "#fff" }}>
              {["#","Item / SKU","HSN","Qty","Unit","Rate","Disc%","CGST","SGST","Amount"].map(h => (
                <th key={h} style={{ padding: "4px 5px", textAlign: h === "Item / SKU" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((it, i) => (
              <tr key={i} style={{ background: rowBg(i, config.tableStyle, c), borderBottom: rowBorder(config.tableStyle, c) }}>
                <td style={{ padding: "3px 5px" }}>{i + 1}</td>
                <td style={{ padding: "3px 5px" }}>{it.name}<div style={{ color: "#94A3B8", fontSize: fs - 3 }}>SKU-{1000 + i}</div></td>
                <td style={{ padding: "3px 5px", textAlign: "right" }}>{it.hsn}</td>
                <td style={{ padding: "3px 5px", textAlign: "right" }}>{it.qty * 10}</td>
                <td style={{ padding: "3px 5px", textAlign: "right" }}>pcs</td>
                <td style={{ padding: "3px 5px", textAlign: "right" }}>₹{it.rate}</td>
                <td style={{ padding: "3px 5px", textAlign: "right" }}>0%</td>
                <td style={{ padding: "3px 5px", textAlign: "right", color: "#64748B" }}>₹{Math.round(it.rate * it.qty * 10 * 0.09)}</td>
                <td style={{ padding: "3px 5px", textAlign: "right", color: "#64748B" }}>₹{Math.round(it.rate * it.qty * 10 * 0.09)}</td>
                <td style={{ padding: "3px 5px", textAlign: "right", fontWeight: 700 }}>₹{it.rate * it.qty * 10}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Summary */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 200, fontSize: fs - 1 }}>
            {[["Taxable Amt","₹24,500"],["CGST","₹2,205"],["SGST","₹2,205"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ color: "#64748B" }}>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", background: c, color: "#fff",
              padding: "4px 8px", borderRadius: 4, fontWeight: 700, marginTop: 4 }}>
              <span>NET PAYABLE</span><span>₹28,910</span>
            </div>
          </div>
        </div>
        {config.showBankDetails && (
          <div style={{ marginTop: 8, padding: "6px 10px", background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 6, fontSize: fs - 2 }}>
            <strong style={{ color: c }}>Bank: </strong>SBI · A/C: 1234567890 · IFSC: SBIN0001234
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${c}30`, padding: "5px 14px", fontSize: fs - 2, color: "#64748B", display: "flex", justifyContent: "space-between" }}>
        <span>{config.footerText}</span>
        {config.showTerms && <span>{config.termsText.split("\n")[0]}</span>}
      </div>
    </div>
  );
}

// ── 09 Services: amber, big invoice number callout, timeline ──
function TplServices({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 6 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#FFFBEB", fontFamily: config.fontFamily, minHeight: 560 }}>
      {/* Header */}
      <div style={{ background: c, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {config.showLogo && (
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", color: c, fontWeight: 900, fontSize: 20 }}>
              {(profile.storeName || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: bnFs }}>{profile.storeName || "Pro Services"}</div>
            <div style={{ color: "#FDE68A", fontSize: fs - 2 }}>Professional Services Provider</div>
          </div>
        </div>
        {/* Big invoice number callout */}
        <div style={{ background: "#fff", borderRadius: 8, padding: "6px 14px", textAlign: "center", minWidth: 110 }}>
          <div style={{ fontSize: fs - 2, color: "#92400E", fontWeight: 700, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: fs + 6, fontWeight: 900, color: c, lineHeight: 1 }}>0123</div>
          <div style={{ fontSize: fs - 2, color: "#92400E" }}>24 May 2024</div>
        </div>
      </div>
      <div style={{ padding: "12px 18px" }}>
        {/* Bill to + project info */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: fs - 1 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: c, marginBottom: 3 }}>BILLED TO</div>
            <div style={{ fontWeight: 700, fontSize: fs + 1 }}>Rajesh Kumar</div>
            <div style={{ color: "#6B7280" }}>Startup Hub, Bengaluru</div>
            <div style={{ color: "#6B7280" }}>+91 98765 12345</div>
          </div>
          <div style={{ flex: 1, background: "#fff", border: `2px solid ${c}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontWeight: 700, color: c, marginBottom: 3 }}>PROJECT</div>
            <div style={{ fontWeight: 600 }}>Website Redesign</div>
            <div style={{ color: "#6B7280" }}>Period: May 1–31, 2024</div>
            <div style={{ color: "#6B7280" }}>Due: <span style={{ color: c, fontWeight: 600 }}>31 May 2024</span></div>
          </div>
        </div>
        {/* Timeline-style services */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: c, fontSize: fs - 1, marginBottom: 6, borderBottom: `2px solid ${c}`, paddingBottom: 4 }}>SERVICES RENDERED</div>
          {[
            { week: "Week 1", desc: "Discovery & Wireframing", hrs: 8,  rate: 2500 },
            { week: "Week 2", desc: "UI/UX Design",            hrs: 12, rate: 2500 },
            { week: "Week 3", desc: "Development",             hrs: 20, rate: 2500 },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, paddingLeft: 10,
              borderLeft: `3px solid ${i === 2 ? c : `${c}40`}`, fontSize: fs - 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.desc}</div>
                <div style={{ color: "#6B7280", fontSize: fs - 2 }}>{s.week} · {s.hrs} hrs @ ₹{s.rate}/hr</div>
              </div>
              <div style={{ fontWeight: 700, color: "#1F2937" }}>₹{s.hrs * s.rate}</div>
            </div>
          ))}
        </div>
        {/* Summary */}
        <div style={{ background: "#fff", border: `1px solid ${c}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
          {[["Subtotal","₹1,00,000"],["Tax (18%)","₹18,000"]].map(([k,v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, marginBottom: 3 }}>
              <span style={{ color: "#6B7280" }}>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: fs + 2,
            color: c, borderTop: `2px solid ${c}`, paddingTop: 6, marginTop: 4 }}>
            <span>TOTAL DUE</span><span>₹1,18,000</span>
          </div>
        </div>
        {config.showBankDetails && (
          <div style={{ fontSize: fs - 1, color: "#6B7280", marginBottom: 6 }}>
            <strong>Pay via: </strong>Bank Transfer · A/C: 1234567890 · IFSC: ICIC0001234
          </div>
        )}
        {config.showTerms && <div style={{ fontSize: fs - 1, color: "#6B7280", marginBottom: 4 }}>
          <strong style={{ color: c }}>Terms: </strong>{config.termsText.split("\n")[0]}
        </div>}
        <div style={{ fontSize: fs - 1, color: c, fontStyle: "italic", fontWeight: 600 }}>{config.footerText}</div>
      </div>
    </div>
  );
}
