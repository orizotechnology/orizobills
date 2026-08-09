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
  logoUrl?: string;
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

// ── 10 Minimal: pure black and white, no color, ultra clean ──
function TplMinimal({ fs, config, profile }: { fs: number; config: PrintConfig; profile: ProfileArg }) {
  const bnFs = config.businessNameSize === "large" ? fs + 7 : config.businessNameSize === "small" ? fs + 2 : fs + 4;
  return (
    <div style={{ background: "#fff", fontFamily: config.fontFamily, minHeight: 560, padding: "20px 24px", color: "#000" }}>
      {/* Minimal header: left biz, right INVOICE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          {config.showLogo && (
            <div style={{ width: 40, height: 40, background: "#000", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 20, marginBottom: 6 }}>
              {(profile.storeName || "O").charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontWeight: 900, fontSize: bnFs }}>{profile.storeName || "Your Business"}</div>
          <div style={{ fontSize: fs - 1, color: "#555" }}>{profile.address || "123 Main St, City"}</div>
          <div style={{ fontSize: fs - 1, color: "#555" }}>{profile.phone}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900, fontSize: fs + 10, letterSpacing: -1, color: "#000" }}>INVOICE</div>
          <div style={{ fontSize: fs - 1, color: "#777" }}>INV-2024-0123</div>
          <div style={{ fontSize: fs - 1, color: "#777" }}>24 May 2024</div>
        </div>
      </div>
      {/* Single-pixel horizontal rule */}
      <div style={{ borderTop: "1px solid #000", marginBottom: 12 }} />
      {/* Bill To row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: fs - 1 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>BILL TO</div>
          <div>Rajesh Kumar</div>
          <div style={{ color: "#777" }}>MG Road, Bengaluru</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>DUE</div>
          <div>31 May 2024</div>
          <div style={{ color: "#777" }}>Net 7</div>
        </div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: fs - 1 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            {["Item","Qty","Rate","Amount"].map(h => (
              <th key={h} style={{ padding: "5px 6px", textAlign: h === "Item" ? "left" : "right",
                fontWeight: 700, fontSize: fs - 2, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #E5E7EB" }}>
              <td style={{ padding: "5px 6px" }}>{it.name}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>{it.qty}</td>
              <td style={{ padding: "5px 6px", textAlign: "right" }}>₹{it.rate}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 200, fontSize: fs - 1 }}>
          {[["Subtotal","₹2,450"],["GST (18%)","₹441"]].map(([k,v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: "#777" }}>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderTop: "2px solid #000", paddingTop: 5, fontSize: fs + 1 }}>
            <span>TOTAL</span><span>₹2,891</span>
          </div>
        </div>
      </div>
      {config.showAmountInWords && <div style={{ fontSize: fs - 1, color: "#777", marginBottom: 6 }}>Two Thousand Eight Hundred Ninety One Rupees Only</div>}
      <div style={{ borderTop: "1px solid #000", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: fs - 1, color: "#777" }}>{config.footerText}</div>
        {config.showSignature && <div style={{ fontSize: fs - 1, color: "#777", textAlign: "right" }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 4, minWidth: 100 }}>Signature</div>
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// THERMAL TEMPLATE RENDERERS  (width ≈ 260 px)
// ═══════════════════════════════════════════════════════════════

function ThermalBase({ c, fs, config, profile, children, headerVariant }: {
  c: string; fs: number; config: PrintConfig; profile: ProfileArg;
  children: React.ReactNode;
  headerVariant?: "centered" | "leftright" | "boxed";
}) {
  const hv = headerVariant ?? "centered";
  return (
    <div style={{ width: 260, background: "#fff", fontFamily: config.fontFamily, fontSize: fs,
      color: "#1E293B", padding: `${config.marginTop}px ${config.marginRight}px ${config.marginBottom}px ${config.marginLeft}px`,
      minHeight: 300 }}>
      {/* Header */}
      {hv === "centered" && (
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          {config.showLogo && (
            profile.logoUrl ? (
              <img src={profile.logoUrl} alt="logo"
                style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, margin: "0 auto 5px", display: "block" }} />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: c,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 900, fontSize: fs + 8,
                margin: "0 auto 5px",
                boxShadow: `0 2px 8px ${c}60`,
              }}>
                {(profile.storeName || "S").charAt(0).toUpperCase()}
              </div>
            )
          )}
          <div style={{ fontWeight: 900, fontSize: fs + 3, color: c }}>{(profile.storeName || "SHOP").toUpperCase()}</div>
          <div style={{ fontSize: fs - 2, color: "#64748B" }}>{profile.address}</div>
          <div style={{ fontSize: fs - 2, color: "#64748B" }}>{profile.phone}</div>
        </div>
      )}
      {hv === "leftright" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {config.showLogo && (
              profile.logoUrl ? (
                <img src={profile.logoUrl} alt="logo"
                  style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: 6, background: c,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 900, fontSize: fs + 4, flexShrink: 0,
                }}>
                  {(profile.storeName || "S").charAt(0).toUpperCase()}
                </div>
              )
            )}
            <div>
              <div style={{ fontWeight: 900, color: c, fontSize: fs + 2 }}>{profile.storeName || "SHOP"}</div>
              <div style={{ fontSize: fs - 2, color: "#64748B" }}>{profile.phone}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: fs - 2, color: "#64748B" }}>
            <div>INV-0123</div><div>24-May-24</div>
          </div>
        </div>
      )}
      {hv === "boxed" && (
        <div style={{ border: `2px solid ${c}`, padding: "6px 8px", marginBottom: 6, textAlign: "center" }}>
          {config.showLogo && (
            profile.logoUrl ? (
              <img src={profile.logoUrl} alt="logo"
                style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, margin: "0 auto 4px", display: "block" }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 6, background: c,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 900, fontSize: fs + 6,
                margin: "0 auto 4px",
              }}>
                {(profile.storeName || "S").charAt(0).toUpperCase()}
              </div>
            )
          )}
          <div style={{ fontWeight: 900, fontSize: fs + 3, color: c }}>{profile.storeName || "SHOP"}</div>
          <div style={{ fontSize: fs - 2 }}>{profile.phone} · {profile.address}</div>
        </div>
      )}
      {children}
      {/* Footer */}
      <div style={{ borderTop: "1px dashed #94A3B8", paddingTop: 4, marginTop: 6, textAlign: "center", fontSize: fs - 2, color: "#64748B" }}>
        {config.footerText}
      </div>
    </div>
  );
}

function ThermalItems({ c, fs, config }: { c: string; fs: number; config: PrintConfig }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 6 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${c}` }}>
          {["Item","Qty","Rate","Amt"].map(h => (
            <th key={h} style={{ padding: "2px 3px", textAlign: h === "Item" ? "left" : "right", fontSize: fs - 2, color: c }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SAMPLE_ITEMS.map((it, i) => (
          <tr key={i} style={{ borderBottom: rowBorder(config.tableStyle, c) }}>
            <td style={{ padding: "2px 3px" }}>{it.name}</td>
            <td style={{ padding: "2px 3px", textAlign: "right" }}>{it.qty}</td>
            <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.rate}</td>
            <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThermalTotals({ c, fs, config }: { c: string; fs: number; config: PrintConfig }) {
  return (
    <div style={{ fontSize: fs - 1, marginBottom: 6 }}>
      {[["Subtotal","₹2,450"],["GST","₹441"]].map(([k,v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#64748B" }}>{k}</span><span>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: fs,
        borderTop: `1px solid ${c}`, paddingTop: 3, marginTop: 2 }}>
        <span>TOTAL</span><span style={{ color: c }}>₹2,891</span>
      </div>
    </div>
  );
}

// ── Thermal: th-retail ────────────────────────────────────────
function TplThRetail({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="centered">
      <div style={{ textAlign: "center", fontSize: fs - 1, marginBottom: 4 }}>
        <div>** RETAIL RECEIPT **</div>
        <div style={{ color: "#64748B" }}>Cust: Rajesh Kumar | INV-0123 | 24 May 2024</div>
      </div>
      <ThermalItems c={c} fs={fs} config={config} />
      <ThermalTotals c={c} fs={fs} config={config} />
      {config.showQR && <div style={{ textAlign: "center" }}><div style={{ display: "inline-block", width: 44, height: 44, border: "1px solid #E2E8F0", fontSize: 8, color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", margin: "4px auto" }}>QR</div></div>}
    </ThermalBase>
  );
}

// ── Thermal: th-grocery ───────────────────────────────────────
function TplThGrocery({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="boxed">
      <div style={{ fontSize: fs - 1, marginBottom: 4, borderBottom: `1px dashed ${c}`, paddingBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Bill No: INV-0123</span><span>24 May 2024</span>
        </div>
        <div>Customer: Rajesh Kumar</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Rice 1kg",qty:2,rate:55},{name:"Atta 5kg",qty:1,rate:210},{name:"Dal 500g",qty:3,rate:90}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>{it.qty}×{it.rate}</td>
              <td style={{ padding: "2px 3px", textAlign: "right", fontWeight: 700, color: c }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontWeight: 900, fontSize: fs + 1, textAlign: "right", color: c }}>Total: ₹490</div>
      <div style={{ fontSize: fs - 2, color: "#64748B", textAlign: "center", marginTop: 4 }}>Items: 6 | Savings: ₹24</div>
    </ThermalBase>
  );
}

// ── Thermal: th-restaurant ────────────────────────────────────
function TplThRestaurant({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="centered">
      <div style={{ textAlign: "center", marginBottom: 6, borderTop: `1px dashed ${c}`, borderBottom: `1px dashed ${c}`, padding: "3px 0" }}>
        <div style={{ fontWeight: 700, color: c }}>TABLE 5 | DINE IN</div>
        <div style={{ fontSize: fs - 2 }}>KOT: 0456 | 24 May 8:30 PM | Server: Amit</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Paneer Butter Masala",qty:1,rate:280},{name:"Garlic Naan ×2",qty:2,rate:45},{name:"Lassi",qty:1,rate:80}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>{it.qty}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: fs - 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Food</span><span>₹450</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Service (10%)</span><span>₹45</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: c, borderTop: `1px solid ${c}`, paddingTop: 2, marginTop: 2 }}><span>TOTAL</span><span>₹495</span></div>
      </div>
      <div style={{ textAlign: "center", fontSize: fs - 2, color: "#64748B", marginTop: 4 }}>GST No: 29ABCDE1234F1Z5</div>
    </ThermalBase>
  );
}

// ── Thermal: th-pharmacy ──────────────────────────────────────
function TplThPharmacy({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="boxed">
      <div style={{ fontSize: fs - 2, marginBottom: 4, color: "#64748B", textAlign: "center" }}>
        Lic. No: MH-12345 | DL: AB-678
      </div>
      <div style={{ fontSize: fs - 1, borderBottom: `1px dashed ${c}`, paddingBottom: 4, marginBottom: 4 }}>
        <div>Patient: <strong>Rajesh Kumar</strong></div>
        <div style={{ color: "#64748B" }}>Rx: Dr. Sharma | 24 May 2024</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Paracetamol 500mg",qty:10,rate:2.5},{name:"Azithromycin 500mg",qty:5,rate:18},{name:"Vitamin C",qty:1,rate:85}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}><div>{it.name}</div><div style={{ fontSize: fs - 3, color: "#94A3B8" }}>Qty: {it.qty} @ ₹{it.rate}</div></td>
              <td style={{ padding: "2px 3px", textAlign: "right", fontWeight: 700 }}>₹{(it.qty * it.rate).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontWeight: 900, textAlign: "right", fontSize: fs, color: c }}>TOTAL: ₹195</div>
      <div style={{ fontSize: fs - 2, color: "#64748B", marginTop: 4, borderTop: "1px dashed #E2E8F0", paddingTop: 3 }}>Store medicines in cool dry place</div>
    </ThermalBase>
  );
}

// ── Thermal: th-fashion ───────────────────────────────────────
function TplThFashion({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="centered">
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontSize: fs - 1, color: c, letterSpacing: 3 }}>— RECEIPT —</div>
        <div style={{ fontSize: fs - 2, color: "#64748B" }}>Priya Sharma | Member #PM-456</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Silk Kurti (M)",qty:1,rate:1200},{name:"Cotton Scarf",qty:2,rate:350},{name:"Jute Bag",qty:1,rate:450}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "center" }}>{it.qty}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: fs - 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>MRP</span><span>₹2,350</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>Member 10% off</span><span style={{ color: c }}>- ₹235</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: c, borderTop: `1px solid ${c}`, paddingTop: 2, marginTop: 2 }}><span>YOU PAY</span><span>₹2,115</span></div>
      </div>
      <div style={{ textAlign: "center", fontSize: fs - 2, color: "#94A3B8", marginTop: 4, fontStyle: "italic" }}>Exchange within 7 days with receipt</div>
    </ThermalBase>
  );
}

// ── Thermal: th-electronics ───────────────────────────────────
function TplThElectronics({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="leftright">
      <div style={{ fontSize: fs - 1, marginBottom: 4, display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${c}`, paddingBottom: 3 }}>
        <span>IMEI: 356-XXX-XXX</span><span>Warranty: 1yr</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Smartphone X12",qty:1,rate:18999},{name:"Screen Guard",qty:2,rate:149},{name:"Cover Case",qty:1,rate:299}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: fs - 1, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>Sub</span><span>₹19,596</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>GST</span><span>₹1,727</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: c, borderTop: `1px solid ${c}`, paddingTop: 2, marginTop: 2 }}><span>TOTAL</span><span>₹21,323</span></div>
      </div>
      <div style={{ fontSize: fs - 2, color: "#64748B" }}>Serial: SN-TECH-20240524</div>
    </ThermalBase>
  );
}

// ── Thermal: th-cafe ──────────────────────────────────────────
function TplThCafe({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="centered">
      <div style={{ textAlign: "center", fontSize: fs - 1, marginBottom: 4, borderBottom: `1px dashed ${c}`, paddingBottom: 3 }}>
        <div style={{ fontWeight: 700, color: c }}>☕ ORDER RECEIPT</div>
        <div style={{ fontSize: fs - 2, color: "#64748B" }}>Order #456 | Takeaway | 10:30 AM</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"Cappuccino",qty:2,rate:120},{name:"Croissant",qty:1,rate:80},{name:"Iced Latte",qty:1,rate:140}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "center", color: "#64748B" }}>x{it.qty}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontWeight: 900, textAlign: "right", fontSize: fs + 1, color: c, marginBottom: 2 }}>₹460</div>
      <div style={{ textAlign: "center", fontSize: fs - 2, color: "#64748B" }}>Paid: UPI | Txn: 7890XY</div>
      <div style={{ textAlign: "center", fontSize: fs - 2, marginTop: 4, color: c, fontStyle: "italic" }}>Enjoy your coffee! ☕</div>
    </ThermalBase>
  );
}

// ── Thermal: th-hardware ──────────────────────────────────────
function TplThHardware({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="leftright">
      <div style={{ fontSize: fs - 1, marginBottom: 4, borderBottom: `1px dashed ${c}`, paddingBottom: 3 }}>
        <div>Cust: Rajesh Kumar</div>
        <div style={{ color: "#64748B", fontSize: fs - 2 }}>Vehicle: MH-12-AB-3456 | Job: #789</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 4 }}>
        <tbody>
          {[{name:"M10 Bolt ×50",qty:1,rate:120},{name:"PVC Pipe 2m",qty:3,rate:85},{name:"Elbow Joint",qty:6,rate:18}].map((it,i) => (
            <tr key={i} style={{ borderBottom: "1px dotted #E2E8F0" }}>
              <td style={{ padding: "2px 3px" }}>{it.name}</td>
              <td style={{ padding: "2px 3px", textAlign: "right" }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: fs - 1, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>Parts</span><span>₹483</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748B" }}>Labour</span><span>₹200</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: c, borderTop: `1px solid ${c}`, paddingTop: 2, marginTop: 2 }}><span>TOTAL</span><span>₹683</span></div>
      </div>
      <div style={{ fontSize: fs - 2, color: "#64748B" }}>Warranty: Parts 30 days</div>
    </ThermalBase>
  );
}

// ── Thermal: th-services ──────────────────────────────────────
function TplThServices({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <ThermalBase c={c} fs={fs} config={config} profile={profile} headerVariant="boxed">
      <div style={{ textAlign: "center", fontSize: fs - 1, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, color: c }}>SERVICE RECEIPT</div>
        <div style={{ fontSize: fs - 2, color: "#64748B" }}>INV-0123 | 24 May 2024</div>
      </div>
      <div style={{ fontSize: fs - 1, marginBottom: 4, borderBottom: `1px dashed ${c}`, paddingBottom: 3 }}>
        <div>Client: <strong>Rajesh Kumar</strong></div>
        <div style={{ color: "#64748B" }}>Service: AC Repair + Cleaning</div>
      </div>
      {[{desc:"Repair Labour",amt:800},{desc:"Refrigerant Gas",amt:450},{desc:"Cleaning Charge",amt:250}].map((s,i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: fs - 1, paddingLeft: 8,
          borderLeft: `2px solid ${i < 2 ? `${c}40` : c}`, marginBottom: 4 }}>
          <span>{s.desc}</span><span>₹{s.amt}</span>
        </div>
      ))}
      <div style={{ fontWeight: 900, textAlign: "right", fontSize: fs, color: c, borderTop: `1px solid ${c}`, paddingTop: 3, marginTop: 2 }}>TOTAL: ₹1,500</div>
      <div style={{ textAlign: "center", fontSize: fs - 2, color: "#64748B", marginTop: 4 }}>Next service due: 24 Nov 2024</div>
    </ThermalBase>
  );
}

// ── Thermal: th-minimal ───────────────────────────────────────
function TplThMinimal({ c, fs, config, profile }: { c: string; fs: number; config: PrintConfig; profile: ProfileArg }) {
  return (
    <div style={{ width: 260, background: "#fff", fontFamily: config.fontFamily, fontSize: fs,
      color: "#000", padding: "14px 16px", minHeight: 280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {config.showLogo && (
          profile.logoUrl ? (
            <img src={profile.logoUrl} alt="logo"
              style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 4, background: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: fs + 4, flexShrink: 0 }}>
              {(profile.storeName || "S").charAt(0).toUpperCase()}
            </div>
          )
        )}
        <div style={{ fontWeight: 900, fontSize: fs + 2 }}>{profile.storeName || "STORE"}</div>
      </div>
      <div style={{ fontSize: fs - 2, color: "#555", marginBottom: 6 }}>{profile.phone} · INV-0123 · 24 May 2024</div>
      <div style={{ borderTop: "1px solid #000", marginBottom: 6 }} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs - 1, marginBottom: 6 }}>
        <tbody>
          {SAMPLE_ITEMS.map((it, i) => (
            <tr key={i}>
              <td style={{ padding: "2px 0" }}>{it.name}</td>
              <td style={{ textAlign: "right" }}>{it.qty}×{it.rate}</td>
              <td style={{ textAlign: "right", fontWeight: 700, paddingLeft: 6 }}>₹{it.qty * it.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: fs + 1 }}>
        <span>TOTAL</span><span>₹2,891</span>
      </div>
      <div style={{ marginTop: 8, fontSize: fs - 2, color: "#555", textAlign: "center" }}>{config.footerText}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INVOICE PREVIEW DISPATCHER
// Picks the correct layout based on template.id
// ═══════════════════════════════════════════════════════════════

function InvoicePreview({ config, template, profile }: {
  config: PrintConfig;
  template: Template;
  profile: ProfileArg;
}) {
  const c = config.primaryColor;
  const fs = config.fontSize === "small" ? 10 : config.fontSize === "large" ? 13 : 11;
  const isTherm = template.type === "Thermal";
  const w = isTherm ? 260 : (config.paperType === "A5" ? 380 : 480);

  const wrapStyle: React.CSSProperties = {
    width: w,
    background: "#fff",
    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
    borderRadius: 4,
    overflow: "hidden",
    fontFamily: config.fontFamily,
  };

  const renderContent = () => {
    const props = { c, fs, config, profile };
    switch (template.id) {
      case "modern":      return <TplModern      {...props} />;
      case "elegant":     return <TplElegant     {...props} />;
      case "premium":     return <TplPremium     {...props} />;
      case "pharmacy":    return <TplPharmacy    {...props} />;
      case "restaurant":  return <TplRestaurant  {...props} />;
      case "boutique":    return <TplBoutique    {...props} />;
      case "electronics": return <TplElectronics {...props} />;
      case "wholesale":   return <TplWholesale   {...props} />;
      case "services":    return <TplServices    {...props} />;
      case "minimal":     return <TplMinimal     c={c} fs={fs} config={config} profile={profile} />;
      case "th-retail":      return <TplThRetail      {...props} />;
      case "th-grocery":     return <TplThGrocery     {...props} />;
      case "th-restaurant":  return <TplThRestaurant  {...props} />;
      case "th-pharmacy":    return <TplThPharmacy    {...props} />;
      case "th-fashion":     return <TplThFashion     {...props} />;
      case "th-electronics": return <TplThElectronics {...props} />;
      case "th-cafe":        return <TplThCafe        {...props} />;
      case "th-hardware":    return <TplThHardware    {...props} />;
      case "th-services":    return <TplThServices    {...props} />;
      case "th-minimal":     return <TplThMinimal     {...props} />;
      default:            return <TplModern      {...props} />;
    }
  };

  return <div style={wrapStyle}>{renderContent()}</div>;
}

// ═══════════════════════════════════════════════════════════════
// SVG THUMBNAILS — each template gets a unique miniature layout
// ═══════════════════════════════════════════════════════════════

function TemplateThumbnail({ tpl }: { tpl: Template }) {
  const c = tpl.color;
  const W = 80, H = 70;
  switch (tpl.id) {
    case "modern": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="0" y="0" width="5" height="70" fill={c}/>
        <rect x="10" y="8" width="30" height="6" rx="2" fill={c} opacity="0.8"/>
        <rect x="10" y="17" width="22" height="3" rx="1" fill="#E2E8F0"/>
        <rect x="10" y="22" width="16" height="3" rx="1" fill="#E2E8F0"/>
        <rect x="55" y="8" width="18" height="3" rx="1" fill="#CBD5E1"/>
        <rect x="55" y="14" width="12" height="3" rx="1" fill="#CBD5E1"/>
        <rect x="8" y="30" width="64" height="3" rx="1" fill={c}/>
        <rect x="8" y="37" width="64" height="5" rx="1" fill={c} opacity="0.15"/>
        {[0,1,2].map(i=><rect key={i} x="8" y={45+i*6} width="64" height="4" rx="1" fill={i%2===0?"#F8FAFC":"#fff"} stroke="#E2E8F0" strokeWidth="0.5"/>)}
        <rect x="45" y="62" width="27" height="5" rx="2" fill={c}/>
      </svg>
    );
    case "elegant": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#FAFAFA"/>
        <circle cx="40" cy="10" r="6" fill="none" stroke={c} strokeWidth="1.5"/>
        <rect x="20" y="19" width="40" height="4" rx="2" fill="#374151" opacity="0.7"/>
        <rect x="25" y="25" width="30" height="2" rx="1" fill="#9CA3AF"/>
        <rect x="5" y="30" width="70" height="1" fill="#E5E7EB"/>
        <rect x="5" y="33" width="70" height="1" fill="#E5E7EB"/>
        {[0,1,2].map(i=><rect key={i} x="8" y={38+i*7} width="64" height="5" rx="1" fill="#fff" stroke="#F3F4F6" strokeWidth="0.5"/>)}
        <rect x="5" y="62" width="70" height="1" fill={c} opacity="0.5"/>
      </svg>
    );
    case "premium": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="0" y="0" width="80" height="18" fill="#0F172A"/>
        <rect x="6" y="5" width="20" height="8" rx="2" fill={c} opacity="0.9"/>
        <rect x="30" y="6" width="22" height="4" rx="1" fill="#fff" opacity="0.8"/>
        <rect x="30" y="12" width="14" height="3" rx="1" fill="#94A3B8"/>
        <rect x="60" y="4" width="14" height="5" rx="1" fill={c} opacity="0.7"/>
        <rect x="0" y="18" width="80" height="3" fill={c} opacity="0.6"/>
        <rect x="6" y="26" width="28" height="14" rx="2" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5"/>
        <rect x="46" y="26" width="28" height="14" rx="2" fill="#0F172A"/>
        {[0,1,2].map(i=><rect key={i} x="6" y={45+i*6} width="68" height="4" rx="1" fill={i%2===0?"#F1F5F9":"#fff"}/>)}
        <rect x="50" y="63" width="24" height="5" rx="2" fill="#0F172A"/>
      </svg>
    );
    case "pharmacy": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="0" y="0" width="80" height="16" fill={c}/>
        <rect x="4" y="4" width="8" height="8" rx="4" fill="#fff"/>
        <rect x="16" y="5" width="24" height="4" rx="1" fill="#fff" opacity="0.9"/>
        <rect x="16" y="11" width="16" height="2" rx="1" fill="#BAE6FD"/>
        <rect x="60" y="5" width="14" height="6" rx="1" fill="#fff" opacity="0.3"/>
        <line x1="48" y1="20" x2="48" y2="68" stroke={`${c}40`} strokeWidth="1" strokeDasharray="2,2"/>
        <rect x="4" y="22" width="40" height="40" fill="transparent"/>
        {[0,1,2].map(i=><rect key={i} x="4" y={28+i*8} width="40" height="6" rx="1" fill={i%2===0?"#EFF6FF":"#fff"} stroke="#DBEAFE" strokeWidth="0.5"/>)}
        <rect x="52" y="22" width="24" height="24" rx="3" fill={`${c}15`} stroke={c} strokeWidth="1.5"/>
        <text x="64" y="38" textAnchor="middle" fontSize="8" fontWeight="900" fill={c}>BILL</text>
      </svg>
    );
    case "restaurant": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="0" y="0" width="80" height="70" fill="none" stroke={c} strokeWidth="5"/>
        <circle cx="40" cy="14" r="8" fill={c} opacity="0.9"/>
        <rect x="22" y="25" width="36" height="5" rx="2" fill="#1F2937" opacity="0.8"/>
        <rect x="28" y="32" width="24" height="3" rx="1" fill="#9CA3AF"/>
        <rect x="4" y="38" width="72" height="2" fill={c} opacity="0.4"/>
        <rect x="4" y="42" width="72" height="2" fill={c} opacity="0.4"/>
        {[0,1,2].map(i=><rect key={i} x="8" y={47+i*6} width="64" height="4" rx="1" fill={i%2===0?"#fff":"#FFF1F2"} stroke="#FFE4E6" strokeWidth="0.5"/>)}
        <rect x="25" y="64" width="30" height="4" rx="2" fill={c}/>
      </svg>
    );
    default: return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill={`${c}10`}/>
        <rect x="4" y="4" width="72" height="8" rx="2" fill={c} opacity="0.7"/>
        <rect x="4" y="16" width="44" height="3" rx="1" fill="#E2E8F0"/>
        <rect x="4" y="22" width="32" height="3" rx="1" fill="#E2E8F0"/>
        {[0,1,2].map(i=><rect key={i} x="4" y={30+i*8} width="72" height="6" rx="1" fill={i%2===0?"#fff":"#F8FAFC"} stroke={`${c}20`} strokeWidth="0.5"/>)}
        <rect x="48" y="58" width="28" height="8" rx="2" fill={c}/>
      </svg>
    );
  }
}

// More thermal thumbnails for TemplateThumbnail
function ThermalThumbnail({ tpl }: { tpl: Template }) {
  const c = tpl.color;
  const W = 80, H = 70;
  switch (tpl.id) {
    case "th-retail": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="10" y="4" width="60" height="6" rx="3" fill={c} opacity="0.8"/>
        <rect x="15" y="12" width="50" height="3" rx="1" fill="#CBD5E1"/>
        <rect x="15" y="17" width="40" height="2" rx="1" fill="#E2E8F0"/>
        {[0,1,2].map(i=><rect key={i} x="4" y={24+i*8} width="72" height="6" rx="1" fill={i%2===0?"#F8FAFC":"#fff"} stroke="#E2E8F0" strokeWidth="0.5"/>)}
        <rect x="4" y="52" width="72" height="1" stroke={c} strokeWidth="1" strokeDasharray="3,2"/>
        <rect x="55" y="56" width="21" height="6" rx="2" fill={c}/>
      </svg>
    );
    case "th-grocery": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="4" y="4" width="72" height="12" rx="2" fill="none" stroke={c} strokeWidth="2"/>
        <rect x="12" y="7" width="56" height="5" rx="1" fill={c} opacity="0.3"/>
        {[0,1,2].map(i=><rect key={i} x="4" y={22+i*9} width="72" height="7" rx="1" fill="#fff" stroke="#E5E7EB" strokeWidth="0.5"/>)}
        <rect x="4" y="55" width="72" height="1" fill="#E5E7EB"/>
        <rect x="40" y="60" width="36" height="6" rx="2" fill={c} opacity="0.8"/>
      </svg>
    );
    case "th-restaurant": return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="20" y="4" width="40" height="7" rx="3" fill={c} opacity="0.8"/>
        <rect x="10" y="14" width="60" height="1" stroke={c} strokeWidth="1" strokeDasharray="3,2"/>
        <rect x="10" y="17" width="60" height="1" stroke={c} strokeWidth="1" strokeDasharray="3,2"/>
        {[0,1,2].map(i=><rect key={i} x="6" y={24+i*9} width="68" height="7" rx="1" fill={i%2===0?"#fff":"#FFF1F2"} stroke="#FFE4E6" strokeWidth="0.5"/>)}
        <rect x="30" y="62" width="20" height="5" rx="2" fill={c}/>
      </svg>
    );
    default: return (
      <svg width={W} height={H} viewBox="0 0 80 70">
        <rect width="80" height="70" fill="#fff"/>
        <rect x="15" y="4" width="50" height="8" rx="2" fill={c} opacity="0.7"/>
        <rect x="8" y="15" width="64" height="2" rx="1" fill="#E2E8F0"/>
        {[0,1,2].map(i=><rect key={i} x="4" y={22+i*9} width="72" height="7" rx="1" fill={i%2===0?"#F8FAFC":"#fff"} stroke="#E2E8F0" strokeWidth="0.5"/>)}
        <rect x="30" y="59" width="20" height="7" rx="3" fill={c} opacity="0.8"/>
      </svg>
    );
  }
}

function TemplateThumbnailWrapper({ tpl }: { tpl: Template }) {
  if (tpl.type === "Thermal") return <ThermalThumbnail tpl={tpl} />;
  return <TemplateThumbnail tpl={tpl} />;
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function BillDesignerPage() {
  const { profile, updateProfile } = useBusinessStore();
  const [activeTab,   setActiveTab]   = useState<"A4" | "Thermal">("A4");
  const [selectedId,  setSelectedId]  = useState("modern");
  const [rightTab,    setRightTab]    = useState<"properties" | "arrange">("properties");
  const [zoom,        setZoom]        = useState(100);
  const [showPreview, setShowPreview] = useState(false);
  const [config,      setConfig]      = useState<PrintConfig>(DEFAULT_CONFIG);
  const [saved,       setSaved]       = useState(false);
  const [isDesktop,   setIsDesktop]   = useState(true);
  const [defaultMsg,  setDefaultMsg]  = useState("");

  const handleLogoUpload = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) updateProfile({ logoUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  };

  const handleLogoRemove = () => updateProfile({ logoUrl: "" });

  const C = useCallback((patch: Partial<PrintConfig>) => setConfig(p => ({ ...p, ...patch })), []);


  // Escape key closes full-screen preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPreview(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const visibleTemplates = TEMPLATES.filter(t => t.type === activeTab);
  const selectedTpl = TEMPLATES.find(t => t.id === selectedId) ?? TEMPLATES[0];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const data = JSON.stringify({ templateId: selectedId, config }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `invoice-template-${selectedId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json";
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (parsed.templateId) setSelectedId(parsed.templateId as string);
          if (parsed.config)     setConfig({ ...DEFAULT_CONFIG, ...(parsed.config as Partial<PrintConfig>) });
        } catch { /* ignore bad file */ }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  const handleDuplicate = () => {
    alert(`Template "${selectedTpl.name}" duplicated (saved as a copy).`);
  };

  const handleDelete = () => {
    setConfig(DEFAULT_CONFIG);
    alert("Template reset to defaults.");
  };

  const handleSetDefault = () => {
    setDefaultMsg("Set as default ✓");
    setTimeout(() => setDefaultMsg(""), 2000);
  };

  const previewWidth = isDesktop ? 480 : 340;
  const scaleStyle: React.CSSProperties = {
    transform: `scale(${zoom / 100})`,
    transformOrigin: "top center",
    transition: "transform 0.15s",
  };

  const profileArg: ProfileArg = {
    storeName: profile.storeName,
    address:   profile.address,
    phone:     profile.phone,
    email:     profile.email,
    upiId:     profile.upiId,
    logoUrl:   profile.logoUrl,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", overflow: "hidden" }}>

      {/* ── Full-screen preview overlay ──────────────────── */}
      {showPreview && (
        <div onClick={() => setShowPreview(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "auto" }}>
          {/* Exit button */}
          <button onClick={() => setShowPreview(false)}
            style={{ position: "fixed", top: 16, right: 16, zIndex: 10000,
              background: "#EF4444", color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 20px", fontSize: 15, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(239,68,68,0.5)" }}>
            ✕ Exit Preview
          </button>
          {/* Invoice at actual size */}
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 8, overflow: "hidden",
              boxShadow: "0 8px 48px rgba(0,0,0,0.4)", maxHeight: "90vh", overflowY: "auto" }}>
            <InvoicePreview config={config} template={selectedTpl} profile={profileArg} />
          </div>
        </div>
      )}

      {/* ── Top bar ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52, background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Bill Designer</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>Design and customize your invoice templates</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TopBtn icon={<HelpCircle size={14} />}  label="Help"    onClick={() => {}} />
          <TopBtn icon={<Upload size={14} />}       label="Import"  onClick={handleImport} />
          <TopBtn icon={<Download size={14} />}     label="Export"  onClick={handleExport} />
          <TopBtn icon={<Eye size={14} />}          label="Preview" onClick={() => setShowPreview(p => !p)} active={showPreview} />
          <button onClick={handleSave}
            style={{ display: "flex", alignItems: "center", gap: 6,
              background: saved ? "#22C55E" : "#F97316", color: "#fff",
              border: "none", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              outline: "none", transition: "background 0.2s" }}>
            <Save size={14} /> {saved ? "Saved!" : "Save Template"}
          </button>
        </div>
      </div>

      {/* ── Body: 3 columns ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 300px", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT: Template library ─────────────────────── */}
        <div style={{ background: "#fff", borderRight: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px 8px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Choose Template</span>
            </div>
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 3, marginBottom: 10 }}>
              {(["A4", "Thermal"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                    background: activeTab === t ? "#F97316" : "transparent",
                    color: activeTab === t ? "#fff" : "#64748B",
                    fontSize: 12, fontWeight: activeTab === t ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                  {t}
                </button>
              ))}
            </div>
            <input placeholder="Search templates..."
              style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 10px",
                fontSize: 12, color: "#475569", background: "#F8FAFC", outline: "none",
                fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 14px", scrollbarWidth: "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {visibleTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => {
                    setSelectedId(tpl.id);
                    C({ primaryColor: tpl.color, paperType: tpl.type === "Thermal" ? "Thermal 80mm" : "A4" });
                  }}
                  style={{ cursor: "pointer", borderRadius: 8,
                    border: `2px solid ${selectedId === tpl.id ? "#F97316" : "#E2E8F0"}`,
                    overflow: "hidden", background: "#fff", position: "relative",
                    transition: "border-color 0.15s" }}>
                  <div style={{ height: 70, overflow: "hidden" }}>
                    <TemplateThumbnailWrapper tpl={tpl} />
                  </div>
                  <div style={{ padding: "5px 6px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#1E293B" }}>{tpl.name}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8" }}>{tpl.type}</div>
                  </div>
                  {selectedId === tpl.id && (
                    <div style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16,
                      borderRadius: "50%", background: "#F97316",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
            <button style={{ width: "100%", padding: "8px 0", border: "1.5px dashed #E2E8F0", borderRadius: 8,
              background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", outline: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={13} /> New Blank Template
            </button>
          </div>
        </div>

        {/* ── CENTER: Preview canvas ──────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#F1F5F9" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
            <button onClick={() => setIsDesktop(true)} style={{ ...iconBtnS, border: `1px solid ${isDesktop ? "#F97316" : "#E2E8F0"}`, background: isDesktop ? "#FFF7ED" : "#fff" }} title="Desktop view">
              <Monitor size={15} color={isDesktop ? "#F97316" : "#94A3B8"} />
            </button>
            <button onClick={() => setIsDesktop(false)} style={{ ...iconBtnS, border: `1px solid ${!isDesktop ? "#F97316" : "#E2E8F0"}`, background: !isDesktop ? "#FFF7ED" : "#fff" }} title="Mobile view">
              <Smartphone size={15} color={!isDesktop ? "#F97316" : "#94A3B8"} />
            </button>
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={iconBtnS}>−</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 44, textAlign: "center" }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} style={iconBtnS}>+</button>
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
            <button onClick={() => setZoom(100)} style={{ ...iconBtnS, fontSize: 14, color: "#94A3B8" }}>↺</button>
            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>
              {isDesktop ? `Desktop (${previewWidth}px)` : `Mobile (${previewWidth}px)`}
            </span>
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", display: "flex",
            alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", scrollbarWidth: "none" }}>
            <div style={{ ...scaleStyle, width: previewWidth }}>
              <InvoicePreview config={config} template={selectedTpl} profile={profileArg} />
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: "#fff", borderTop: "1px solid #E2E8F0", flexShrink: 0, flexWrap: "wrap" }}>
            <BotBtn icon={<Copy size={13} />}      label="Duplicate"     onClick={handleDuplicate} />
            <BotBtn icon={<Trash2 size={13} />}    label="Delete"        onClick={handleDelete} danger />
            <BotBtn icon={<RefreshCw size={13} />} label="Reset"         onClick={() => setConfig(DEFAULT_CONFIG)} />
            <BotBtn icon={<Star size={13} />}      label={defaultMsg || "Set as Default"} onClick={handleSetDefault} orange />
            <div style={{ flex: 1 }} />
            <button onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff",
                border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              <Printer size={13} /> Test Print
            </button>
          </div>
        </div>

        {/* ── RIGHT: Properties panel ─────────────────────── */}
        <div style={{ background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
            {(["properties", "arrange"] as const).map(t => (
              <button key={t} onClick={() => setRightTab(t)}
                style={{ flex: 1, padding: "10px 0", border: "none",
                  borderBottom: rightTab === t ? "2px solid #F97316" : "2px solid transparent",
                  background: "none", cursor: "pointer", fontFamily: "inherit", outline: "none",
                  fontSize: 12, fontWeight: rightTab === t ? 700 : 500,
                  color: rightTab === t ? "#F97316" : "#64748B", transition: "all 0.15s" }}>
                {t === "properties" ? "🎨 Properties" : "Aa Arrange"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
            {rightTab === "properties" ? (
              <>
                <PropSection title="Template Settings" icon={<span>⚙</span>} defaultOpen>
                  <PR label="Paper Size">
                    <select value={config.paperType} onChange={e => C({ paperType: e.target.value as PrintConfig["paperType"] })} style={sel}>
                      <option>A4</option><option>A5</option><option>Thermal 80mm</option><option>Thermal 58mm</option>
                    </select>
                  </PR>
                  <PR label="Primary Color">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="color" value={config.primaryColor}
                        onChange={e => C({ primaryColor: e.target.value })}
                        style={{ width: 28, height: 28, border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                      <span style={{ fontSize: 11, color: "#64748B" }}>{config.primaryColor}</span>
                    </div>
                  </PR>
                  <PR label="Font">
                    <select value={config.fontFamily} onChange={e => C({ fontFamily: e.target.value })} style={sel}>
                      {FONT_FAMILIES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </PR>
                  <PR label="Font Size">
                    <select value={config.fontSize} onChange={e => C({ fontSize: e.target.value as PrintConfig["fontSize"] })} style={sel}>
                      {FONT_SIZES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                  </PR>
                </PropSection>

                <PropSection title="Layout & Style" icon={<span>🖼</span>} defaultOpen>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Header Alignment</div>
                    <TriBtn options={[{v:"left",l:"Left"},{v:"center",l:"Center"},{v:"right",l:"Right"}]} value={config.headerAlign} onChange={v => C({ headerAlign: v })} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Layout Style</div>
                    <TriBtn options={[{v:"compact",l:"Compact"},{v:"standard",l:"Standard"},{v:"spacious",l:"Spacious"}]} value={config.layoutStyle} onChange={v => C({ layoutStyle: v })} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Table Style</div>
                    <TriBtn options={[{v:"striped",l:"Striped"},{v:"bordered",l:"Bordered"},{v:"minimal",l:"Minimal"}]} value={config.tableStyle} onChange={v => C({ tableStyle: v })} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Business Name Size</div>
                    <TriBtn options={[{v:"small",l:"S"},{v:"medium",l:"M"},{v:"large",l:"L"}]} value={config.businessNameSize} onChange={v => C({ businessNameSize: v })} />
                  </div>
                </PropSection>

                <PropSection title="Show / Hide Elements" icon={<span>👁</span>} defaultOpen>
                  <PR label="Show Logo">          <Tog value={config.showLogo}          onChange={v => C({ showLogo: v })} /></PR>
                  {/* Logo upload — shown when Show Logo is on */}
                  {config.showLogo && (
                    <div style={{ padding: "6px 0 8px 0" }}>
                      {profile.logoUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img src={profile.logoUrl} alt="logo"
                            style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6,
                              border: "1px solid #E2E8F0", background: "#F8FAFC", padding: 3 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <button onClick={handleLogoUpload}
                              style={{ fontSize: 11, padding: "3px 10px", border: "1px solid #E2E8F0",
                                borderRadius: 6, background: "#fff", color: "#475569",
                                cursor: "pointer", fontFamily: "inherit" }}>
                              Change
                            </button>
                            <button onClick={handleLogoRemove}
                              style={{ fontSize: 11, padding: "3px 10px", border: "1px solid #FECDD3",
                                borderRadius: 6, background: "#fff", color: "#EF4444",
                                cursor: "pointer", fontFamily: "inherit" }}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleLogoUpload}
                          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%",
                            padding: "7px 10px", border: "1.5px dashed #CBD5E1", borderRadius: 8,
                            background: "#F8FAFC", color: "#64748B", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit" }}>
                          <Upload size={13} /> Upload Logo (PNG / JPG / SVG)
                        </button>
                      )}
                    </div>
                  )}
                  <PR label="Signature Line">     <Tog value={config.showSignature}     onChange={v => C({ showSignature: v })} /></PR>
                  <PR label="Bank Details">       <Tog value={config.showBankDetails}   onChange={v => C({ showBankDetails: v })} /></PR>
                  <PR label="QR Code">            <Tog value={config.showQR}            onChange={v => C({ showQR: v })} /></PR>
                  <PR label="Terms & Conditions"> <Tog value={config.showTerms}         onChange={v => C({ showTerms: v })} /></PR>
                  <PR label="Amount in Words">    <Tog value={config.showAmountInWords} onChange={v => C({ showAmountInWords: v })} /></PR>
                </PropSection>

                <PropSection title="Footer Settings" icon={<span>📝</span>}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Footer Message</div>
                    <textarea value={config.footerText} onChange={e => C({ footerText: e.target.value })} rows={2}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 8px",
                        fontSize: 11, color: "#1E293B", background: "#F8FAFC", outline: "none",
                        fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Terms & Conditions</div>
                    <textarea value={config.termsText} onChange={e => C({ termsText: e.target.value })} rows={3}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 8px",
                        fontSize: 11, color: "#1E293B", background: "#F8FAFC", outline: "none",
                        fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                  </div>
                </PropSection>
              </>
            ) : (
              <div style={{ padding: "14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 12 }}>Appearance</div>
                <PR label="Font">
                  <select value={config.fontFamily} onChange={e => C({ fontFamily: e.target.value })} style={sel}>
                    {FONT_FAMILIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </PR>
                <PR label="Font Size">
                  <select value={config.fontSize} onChange={e => C({ fontSize: e.target.value as PrintConfig["fontSize"] })} style={sel}>
                    {FONT_SIZES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                  </select>
                </PR>
                <PR label="Color">
                  <input type="color" value={config.primaryColor} onChange={e => C({ primaryColor: e.target.value })}
                    style={{ width: 28, height: 28, border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                </PR>
              </div>
            )}

            {/* Paper & Print Settings (always visible at bottom) */}
            <div style={{ margin: "0 14px 14px", borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>Paper & Print</div>
              <PR label="Orientation">
                <div style={{ display: "flex", gap: 6 }}>
                  {(["portrait", "landscape"] as const).map(o => (
                    <button key={o} onClick={() => C({ orientation: o })}
                      style={{ width: 30, height: 30, borderRadius: 6,
                        border: `1.5px solid ${config.orientation === o ? "#F97316" : "#E2E8F0"}`,
                        background: config.orientation === o ? "#FFF7ED" : "#fff",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        outline: "none", fontSize: 14 }}>
                      {o === "portrait" ? "□" : "▭"}
                    </button>
                  ))}
                </div>
              </PR>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Margin (mm)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["marginTop","marginBottom","marginLeft","marginRight"] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 3, textTransform: "capitalize" }}>
                      {k.replace("margin", "")}
                    </div>
                    <input type="number" value={config[k] as number}
                      onChange={e => C({ [k]: parseInt(e.target.value) || 0 })}
                      style={{ ...numInp, width: "100%" }} />
                  </div>
                ))}
              </div>
              <PR label="Copies">
                <input type="number" value={config.copies}
                  onChange={e => C({ copies: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={numInp} />
              </PR>
              <PR label="Auto Print on Save">
                <Tog value={config.autoPrint} onChange={v => C({ autoPrint: v })} />
              </PR>
              <button onClick={() => window.print()}
                style={{ width: "100%", padding: "9px 0", background: "#F97316", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", outline: "none", marginTop: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Printer size={14} /> Print Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small button helpers ───────────────────────────────────────
function TopBtn({ icon, label, onClick, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
        border: `1px solid ${active ? "#F97316" : "#E2E8F0"}`,
        borderRadius: 8, background: active ? "#FFF7ED" : "#fff",
        color: active ? "#F97316" : "#475569", fontSize: 12, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
      {icon}{label}
    </button>
  );
}

function BotBtn({ icon, label, onClick, danger, orange }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; orange?: boolean;
}) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
        border: `1px solid ${danger ? "#FECDD3" : orange ? "#F97316" : "#E2E8F0"}`,
        borderRadius: 8, background: orange ? "#FFF7ED" : "#fff",
        color: danger ? "#EF4444" : orange ? "#F97316" : "#475569",
        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
      {icon}{label}
    </button>
  );
}
