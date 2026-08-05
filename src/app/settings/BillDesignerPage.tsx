import { useState } from "react";
import {
  ChevronDown, ChevronRight, Monitor, Smartphone,
  Copy, Trash2, RefreshCw, Star, Printer,
  HelpCircle, Upload, Download, Eye, Save, Plus,
} from "lucide-react";
import { useBusinessStore } from "@/store/business.store";

// =============================================================
// BILL DESIGNER PAGE
// Full invoice template designer — 3-column layout:
//   LEFT  : template library (A4 / Thermal)
//   CENTER: live preview canvas
//   RIGHT : properties panel + paper settings
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
  paperType:    "A4" | "A5" | "Thermal 80mm" | "Thermal 58mm";
  orientation:  "portrait" | "landscape";
  marginTop:    number;
  marginBottom: number;
  marginLeft:   number;
  marginRight:  number;
  showLogo:     boolean;
  showSignature:boolean;
  showBankDetails: boolean;
  showQR:       boolean;
  showTerms:    boolean;
  showAmountInWords: boolean;
  fontSize:     "small" | "medium" | "large";
  primaryColor: string;
  fontFamily:   string;
  copies:       number;
  autoPrint:    boolean;
  footerText:   string;
  termsText:    string;
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
};

const TEMPLATES: Template[] = [
  // ── A4 (10 templates) ──────────────────────────────────────
  { id: "modern",      name: "01 Modern",      type: "A4",      color: "#F97316", isDefault: true },
  { id: "elegant",     name: "02 Elegant",      type: "A4",      color: "#8B5CF6" },
  { id: "premium",     name: "03 Premium",      type: "A4",      color: "#0F172A" },
  { id: "pharmacy",    name: "04 Pharmacy",     type: "A4",      color: "#0EA5E9" },
  { id: "restaurant",  name: "05 Restaurant",   type: "A4",      color: "#DC2626" },
  { id: "boutique",    name: "06 Boutique",     type: "A4",      color: "#9333EA" },
  { id: "electronics", name: "07 Electronics",  type: "A4",      color: "#0284C7" },
  { id: "wholesale",   name: "08 Wholesale",    type: "A4",      color: "#0F766E" },
  { id: "services",    name: "09 Services",     type: "A4",      color: "#D97706" },
  { id: "minimal",     name: "10 Minimal",      type: "A4",      color: "#475569" },

  // ── Thermal (10 templates) ─────────────────────────────────
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
const FONT_SIZES    = [{ v: "small", l: "Small (10px)" }, { v: "medium", l: "Medium (12px)" }, { v: "large", l: "Large (14px)" }];

// ── Collapsible property section ──────────────────────────────
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

// ── Toggle ─────────────────────────────────────────────────────
function Tog({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width: 36, height: 20, borderRadius: 10, background: value ? "#F97316" : "#E2E8F0",
        border: "none", cursor: "pointer", outline: "none", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

// ── Property row ───────────────────────────────────────────────
function PR({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
      {children}
    </div>
  );
}

// ── Small select ───────────────────────────────────────────────
const sel: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px",
  fontSize: 12, color: "#1E293B", background: "#F8FAFC", outline: "none", fontFamily: "inherit", cursor: "pointer",
};

// ── Small number input ─────────────────────────────────────────
const numInp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 6px",
  fontSize: 12, color: "#1E293B", background: "#F8FAFC", outline: "none",
  fontFamily: "inherit", width: 52, textAlign: "right",
};

// ── Invoice Preview ────────────────────────────────────────────
function InvoicePreview({ config, template, profile }: {
  config: PrintConfig;
  template: Template;
  profile: { storeName: string; address: string; phone: string; email: string; upiId: string; gstin?: string };
}) {
  const c = config.primaryColor;
  const fs = config.fontSize === "small" ? 10 : config.fontSize === "large" ? 13 : 11;
  const isTherm = config.paperType.startsWith("Thermal");
  const w = isTherm ? 260 : 480;

  return (
    <div style={{ width: w, background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      borderRadius: 4, padding: `${config.marginTop}px ${config.marginRight}px ${config.marginBottom}px ${config.marginLeft}px`,
      fontFamily: config.fontFamily, fontSize: fs, color: "#1E293B", minHeight: isTherm ? 300 : 560 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: isTherm ? "center" : "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {config.showLogo && (
            <div style={{ width: isTherm ? 36 : 48, height: isTherm ? 36 : 48, borderRadius: 8,
              background: c, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: isTherm ? 14 : 18 }}>
              {(profile.storeName || "O").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: isTherm ? fs + 2 : fs + 4, color: c }}>
              {profile.storeName || "Your Business"}
            </div>
            {!isTherm && <div style={{ fontSize: fs - 1, color: "#64748B", fontStyle: "italic" }}>
              Innovate · Integrate · Inspire
            </div>}
          </div>
        </div>
        {!isTherm && (
          <div style={{ textAlign: "right", fontSize: fs - 1, color: "#64748B" }}>
            <div style={{ fontWeight: 600, color: "#1E293B", marginBottom: 2 }}>{profile.storeName || "Orizo Technologies Pvt. Ltd."}</div>
            <div>{profile.address || "No.123, 2nd Floor, Tech Park"}</div>
            <div>Phone: {profile.phone || "+91 98765 43210"}</div>
            <div>{profile.email || "info@example.com"}</div>
            {profile.gstin && <div>GSTIN: {profile.gstin}</div>}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: c, marginBottom: 10, borderRadius: 1 }} />

      {/* Bill To + Invoice Info */}
      {!isTherm ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: fs - 1, fontWeight: 700, color: c, marginBottom: 4 }}>BILL TO</div>
            <div style={{ fontWeight: 600 }}>Rajesh Kumar</div>
            <div style={{ color: "#64748B" }}>No. 45, MG Road, Bengaluru</div>
            <div style={{ color: "#64748B" }}>Karnataka - 560001</div>
            <div style={{ color: "#64748B" }}>Phone: +91 98765 12345</div>
            <div style={{ color: "#64748B" }}>GSTIN: 29ABCDE1234F1Z5</div>
          </div>
          <div style={{ fontSize: fs - 1 }}>
            {[["Invoice No.", "INV-2024-000123"], ["Invoice Date", "24 May 2024"],
              ["Due Date", "31 May 2024"], ["Payment Mode", "UPI"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                <span style={{ color: "#64748B", minWidth: 90 }}>{k}</span>
                <span style={{ fontWeight: 600 }}>: {v}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Invoice: INV-2024-000123</div>
          <div style={{ color: "#64748B", fontSize: fs - 1 }}>24 May 2024 | Cash</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>Customer: Rajesh Kumar</div>
        </div>
      )}

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <thead>
          <tr style={{ background: c, color: "#fff" }}>
            {isTherm
              ? ["Item", "Qty", "Rate", "Amt"].map(h => <th key={h} style={{ padding: "4px 6px", textAlign: h === "Item" ? "left" : "right", fontSize: fs - 1 }}>{h}</th>)
              : ["#", "Item Name", "HSN/SAC", "Qty", "Rate", "Discount", "Amount"].map(h => <th key={h} style={{ padding: "5px 8px", textAlign: h === "#" || h === "Item Name" || h === "HSN/SAC" ? "left" : "right", fontSize: fs - 1 }}>{h}</th>)
            }
          </tr>
        </thead>
        <tbody>
          {[
            ["Wireless Mouse", "84716060", "1", "850.00", "0.00", "850.00"],
            ["Keyboard",       "84716040", "1", "1,250.00", "0.00", "1,250.00"],
            ["USB Type C Cable","85444290","2", "350.00", "0.00", "700.00"],
          ].map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
              {isTherm
                ? [row[0], row[2], row[3], row[5]].map((v, j) => <td key={j} style={{ padding: "3px 6px", textAlign: j === 0 ? "left" : "right", fontSize: fs - 1 }}>{v}</td>)
                : [String(i+1), row[0], row[1], row[2], row[3], row[4], row[5]].map((v, j) => <td key={j} style={{ padding: "4px 8px", textAlign: j <= 2 ? "left" : "right", fontSize: fs - 1 }}>{v}</td>)
              }
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: isTherm ? "center" : "flex-end", marginBottom: 10 }}>
        <div style={{ minWidth: isTherm ? "100%" : 200 }}>
          {[["Sub Total", "₹10,250.00"], ["Discount", "₹500.00"], ["CGST (9%)", "₹877.50"], ["SGST (9%)", "₹877.50"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: fs - 1, marginBottom: 2 }}>
              <span style={{ color: "#64748B" }}>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", background: c, color: "#fff",
            padding: "5px 8px", borderRadius: 4, fontWeight: 700, marginTop: 4 }}>
            <span>Grand Total</span><span>₹10,645.00</span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      {config.showAmountInWords && !isTherm && (
        <div style={{ fontSize: fs - 1, color: "#64748B", marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: c }}>Amount in Words: </span>
          Ten Thousand Six Hundred Forty Five Rupees Only
        </div>
      )}

      {/* Terms */}
      {config.showTerms && (
        <div style={{ fontSize: fs - 1, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: c, marginBottom: 3 }}>Terms & Conditions</div>
          {config.termsText.split("\n").map((l, i) => <div key={i} style={{ color: "#64748B" }}>• {l}</div>)}
        </div>
      )}

      {/* Footer + QR */}
      <div style={{ borderTop: `1px solid ${c}`, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontStyle: "italic", color: c, fontWeight: 600, fontSize: fs }}>{config.footerText}</div>
          {!isTherm && profile.upiId && (
            <div style={{ fontSize: fs - 1, color: "#64748B", marginTop: 4 }}>
              {profile.email && <span style={{ marginRight: 10 }}>🌐 {profile.email}</span>}
            </div>
          )}
        </div>
        {config.showQR && profile.upiId && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: isTherm ? 48 : 56, height: isTherm ? 48 : 56, border: "1px solid #E2E8F0",
              borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
              background: "#F8FAFC", fontSize: 8, color: "#94A3B8" }}>QR</div>
            <div style={{ fontSize: fs - 2, color: "#94A3B8", marginTop: 2 }}>Scan to Pay</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function BillDesignerPage() {
  const { profile } = useBusinessStore();
  const [activeTab,      setActiveTab]      = useState<"A4" | "Thermal">("A4");
  const [selectedId,     setSelectedId]     = useState("modern");
  const [rightTab,       setRightTab]       = useState<"properties" | "arrange">("properties");
  const [zoom,           setZoom]           = useState(100);
  const [showPreview,    setShowPreview]    = useState(false);
  const [config,         setConfig]         = useState<PrintConfig>(DEFAULT_CONFIG);
  const [saved,          setSaved]          = useState(false);

  const C = (patch: Partial<PrintConfig>) => setConfig(p => ({ ...p, ...patch }));

  const filtered = TEMPLATES.filter(t => t.type === activeTab || (activeTab === "A4" && t.type === "A4") || (activeTab === "Thermal" && t.type === "Thermal"));
  const visibleTemplates = activeTab === "A4"
    ? TEMPLATES.filter(t => t.type === "A4")
    : TEMPLATES.filter(t => t.type === "Thermal");

  const selectedTpl = TEMPLATES.find(t => t.id === selectedId) ?? TEMPLATES[0];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestPrint = () => {
    window.print();
  };

  const handleExport = () => {
    const data = JSON.stringify({ templateId: selectedId, config }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `invoice-template-${selectedId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const inp = document.createElement("input");
    inp.type   = "file";
    inp.accept = ".json";
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          if (parsed.templateId) setSelectedId(parsed.templateId);
          if (parsed.config)     setConfig({ ...DEFAULT_CONFIG, ...parsed.config });
        } catch { /* ignore bad file */ }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  const scaleStyle = { transform: `scale(${zoom / 100})`, transformOrigin: "top center", transition: "transform 0.15s" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F8FAFC", overflow: "hidden" }}>

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
            style={{ display: "flex", alignItems: "center", gap: 6, background: saved ? "#22C55E" : "#F97316",
              color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none",
              transition: "background 0.2s" }}>
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
            {/* A4 / Thermal tabs */}
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 3, marginBottom: 10 }}>
              {(["A4", "Thermal"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
                    background: activeTab === t ? "#F97316" : "transparent",
                    color: activeTab === t ? "#fff" : "#64748B",
                    fontSize: 12, fontWeight: activeTab === t ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                  {t} Templates
                </button>
              ))}
            </div>
            {/* Search */}
            <input placeholder="Search templates..."
              style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 10px",
                fontSize: 12, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>

          {/* Template grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 14px", scrollbarWidth: "none" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {visibleTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => {
                    setSelectedId(tpl.id);
                    setActiveTab(tpl.type === "Thermal" ? "Thermal" : "A4");
                    C({
                      primaryColor: tpl.color,
                      // Auto-switch paper type to match template category
                      paperType: tpl.type === "Thermal" ? "Thermal 80mm" : "A4",
                    });
                  }}
                  style={{ cursor: "pointer", borderRadius: 8,
                    border: `2px solid ${selectedId === tpl.id ? "#F97316" : "#E2E8F0"}`,
                    overflow: "hidden", background: "#fff", position: "relative",
                    transition: "border-color 0.15s" }}>
                  {/* Template thumbnail */}
                  <div style={{ height: 80, background: `linear-gradient(135deg, ${tpl.color}18, ${tpl.color}08)`,
                    display: "flex", flexDirection: "column", padding: 6, gap: 3 }}>
                    <div style={{ height: 3, background: tpl.color, borderRadius: 1, width: "60%" }} />
                    <div style={{ height: 2, background: "#E2E8F0", borderRadius: 1, width: "90%" }} />
                    <div style={{ height: 2, background: "#E2E8F0", borderRadius: 1, width: "75%" }} />
                    <div style={{ flex: 1, border: `1px solid ${tpl.color}40`, borderRadius: 3, marginTop: 2 }} />
                    <div style={{ height: 5, background: tpl.color, borderRadius: 1, width: "50%", alignSelf: "flex-end" }} />
                  </div>
                  <div style={{ padding: "5px 6px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#1E293B" }}>{tpl.name}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8" }}>{tpl.type}</div>
                  </div>
                  {selectedId === tpl.id && (
                    <div style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16,
                      borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center",
                      justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* New blank template */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
            background: "#fff", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
            <button style={iconBtnS} title="Desktop view"><Monitor size={15} color="#F97316" /></button>
            <button style={iconBtnS} title="Mobile view"><Smartphone size={15} color="#94A3B8" /></button>
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={iconBtnS}>−</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 44, textAlign: "center" }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} style={iconBtnS}>+</button>
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
            <button onClick={() => setZoom(100)} style={{ ...iconBtnS, fontSize: 12, color: "#94A3B8" }}>↺</button>
            <button onClick={() => setZoom(100)} style={{ ...iconBtnS, fontSize: 12, color: "#94A3B8" }}>↻</button>
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", display: "flex",
            alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", scrollbarWidth: "none" }}>
            <div style={scaleStyle}>
              <InvoicePreview config={config} template={selectedTpl}
                profile={{ storeName: profile.storeName, address: profile.address,
                  phone: profile.phone, email: profile.email, upiId: profile.upiId }} />
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            background: "#fff", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
            <BotBtn icon={<Copy size={13} />}      label="Duplicate" onClick={() => {}} />
            <BotBtn icon={<Trash2 size={13} />}    label="Delete"    onClick={() => {}} danger />
            <BotBtn icon={<RefreshCw size={13} />} label="Reset"     onClick={() => setConfig(DEFAULT_CONFIG)} />
            <BotBtn icon={<Star size={13} />}      label="Set as Default" onClick={() => {}} orange />
            <div style={{ flex: 1 }} />
            <button onClick={handleTestPrint}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff",
                border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              <Printer size={13} /> Test Print
            </button>
          </div>
        </div>

        {/* ── RIGHT: Properties panel ─────────────────────── */}
        <div style={{ background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
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

                <PropSection title="Company Details" icon={<span>🏢</span>}>
                  <PR label="Show Logo"><Tog value={config.showLogo} onChange={v => C({ showLogo: v })} /></PR>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                    Company name, address and contact pulled from Profile settings.
                  </div>
                </PropSection>

                <PropSection title="Invoice Details" icon={<span>📄</span>}>
                  <PR label="Amount in Words"><Tog value={config.showAmountInWords} onChange={v => C({ showAmountInWords: v })} /></PR>
                  <PR label="Show Signature Line"><Tog value={config.showSignature} onChange={v => C({ showSignature: v })} /></PR>
                  <PR label="Show Bank Details"><Tog value={config.showBankDetails} onChange={v => C({ showBankDetails: v })} /></PR>
                </PropSection>

                <PropSection title="Table / Items" icon={<span>📋</span>}>
                  <PR label="Show HSN/SAC Column"><Tog value={true} onChange={() => {}} /></PR>
                  <PR label="Show Discount Column"><Tog value={true} onChange={() => {}} /></PR>
                  <PR label="Show Tax Column"><Tog value={true} onChange={() => {}} /></PR>
                </PropSection>

                <PropSection title="Totals & Taxes" icon={<span>💰</span>}>
                  <PR label="Show CGST / SGST"><Tog value={true} onChange={() => {}} /></PR>
                  <PR label="Show Round Off"><Tog value={false} onChange={() => {}} /></PR>
                </PropSection>

                <PropSection title="Footer Settings" icon={<span>📝</span>}>
                  <PR label="Show Terms"><Tog value={config.showTerms} onChange={v => C({ showTerms: v })} /></PR>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Footer Message</div>
                    <textarea value={config.footerText}
                      onChange={e => C({ footerText: e.target.value })}
                      rows={2}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 8px",
                        fontSize: 11, color: "#1E293B", background: "#F8FAFC", outline: "none",
                        fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Terms & Conditions</div>
                    <textarea value={config.termsText}
                      onChange={e => C({ termsText: e.target.value })}
                      rows={3}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 8px",
                        fontSize: 11, color: "#1E293B", background: "#F8FAFC", outline: "none",
                        fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                  </div>
                </PropSection>

                <PropSection title="QR Code & Barcode" icon={<span>⬛</span>}>
                  <PR label="Show QR Code"><Tog value={config.showQR} onChange={v => C({ showQR: v })} /></PR>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    QR uses UPI ID from Profile settings.
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

            {/* Paper & Print Settings */}
            <div style={{ margin: "0 14px 14px", borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>Paper & Print Settings</div>
              <PR label="Paper Type">
                <select value={config.paperType} onChange={e => C({ paperType: e.target.value as PrintConfig["paperType"] })} style={{ ...sel, minWidth: 120 }}>
                  <option>A4</option><option>A5</option><option>Thermal 80mm</option><option>Thermal 58mm</option>
                </select>
              </PR>
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
                {(["marginTop", "marginBottom", "marginLeft", "marginRight"] as const).map((k) => (
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
              <button
                onClick={() => window.print()}
                style={{ width: "100%", padding: "9px 0", background: "#F97316", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", outline: "none", marginTop: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Printer size={14} /> More Print Settings
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
        borderRadius: 8,
        background: orange ? "#FFF7ED" : "#fff",
        color: danger ? "#EF4444" : orange ? "#F97316" : "#475569",
        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
      {icon}{label}
    </button>
  );
}

const iconBtnS: React.CSSProperties = {
  width: 28, height: 28, border: "1px solid #E2E8F0", borderRadius: 6,
  background: "#fff", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", outline: "none",
};
