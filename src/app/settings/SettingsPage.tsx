import { useState } from "react";
import { useLocation } from "react-router-dom";

// =============================================================
// SETTINGS PAGE
// No internal left panel — sidebar handles navigation.
// Just renders the correct settings section based on route.
// =============================================================

// ── Shared helpers ────────────────────────────────────────────

function SettingRow({ label, description, children }: { label: string; description?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0", borderBottom: "1px solid #F8FAFC",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)} style={{
      width: 40, height: 22, borderRadius: 11,
      background: on ? "#F97316" : "#E2E8F0",
      border: "none", cursor: "pointer", outline: "none",
      position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3, width: 16, height: 16,
        borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 18px" }}>
        {children}
      </div>
    </div>
  );
}

// ── Setting sections ─────────────────────────────────────────

function GeneralSettings() {
  return (
    <>
      <Section title="Business Info">
        <SettingRow label="Business Name" description="Shown on invoices and reports"><input style={inp} placeholder="Enter business name" /></SettingRow>
        <SettingRow label="Business Type" description="Retail, Wholesale, Services..."><select style={inp}><option>Retail</option><option>Wholesale</option><option>Services</option><option>Manufacturing</option></select></SettingRow>
        <SettingRow label="Financial Year Start" description="Month your financial year begins"><select style={inp}><option>April</option><option>January</option></select></SettingRow>
      </Section>
      <Section title="Currency & Language">
        <SettingRow label="Currency" description="Default currency for all transactions"><select style={inp}><option>INR (₹)</option><option>USD ($)</option></select></SettingRow>
        <SettingRow label="Date Format"><select style={inp}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></SettingRow>
      </Section>
    </>
  );
}

function TransactionSettings() {
  return (
    <Section title="Transaction Defaults">
      <SettingRow label="Auto-generate Invoice Numbers" description="Automatically increment invoice numbers"><Toggle defaultOn /></SettingRow>
      <SettingRow label="Invoice Prefix" description="e.g. INV, BILL, OB"><input style={inp} placeholder="OB" /></SettingRow>
      <SettingRow label="Enable Stock Check on Sale" description="Warn when stock falls below minimum"><Toggle /></SettingRow>
      <SettingRow label="Allow Negative Stock" description="Allow sales even when stock is 0"><Toggle /></SettingRow>
      <SettingRow label="Round Off Total" description="Round bill total to nearest rupee"><Toggle defaultOn /></SettingRow>
    </Section>
  );
}

function PrintSettings() {
  return (
    <>
      <Section title="Invoice Print">
        <SettingRow label="Print Size"><select style={inp}><option>A4</option><option>A5</option><option>Thermal 80mm</option><option>Thermal 58mm</option></select></SettingRow>
        <SettingRow label="Show Logo on Print"><Toggle defaultOn /></SettingRow>
        <SettingRow label="Show Signature Line"><Toggle /></SettingRow>
        <SettingRow label="Show Bank Details"><Toggle /></SettingRow>
      </Section>
      <Section title="Thermal Print">
        <SettingRow label="Enable Thermal Printer"><Toggle /></SettingRow>
        <SettingRow label="Auto Print on Save"><Toggle /></SettingRow>
        <SettingRow label="Print Copies"><input style={{ ...inp, width: 60 }} type="number" defaultValue={1} /></SettingRow>
      </Section>
    </>
  );
}

function TaxSettings() {
  return (
    <Section title="GST Configuration">
      <SettingRow label="GSTIN" description="Your GST Identification Number"><input style={inp} placeholder="22AAAAA0000A1Z5" /></SettingRow>
      <SettingRow label="State" description="State of business registration"><select style={inp}><option>Karnataka</option><option>Maharashtra</option><option>Tamil Nadu</option></select></SettingRow>
      <SettingRow label="Composition Scheme" description="Are you under GST composition scheme?"><Toggle /></SettingRow>
      <SettingRow label="Inclusive Tax Pricing" description="Show prices inclusive of GST by default"><Toggle /></SettingRow>
      <SettingRow label="Default GST Rate"><select style={inp}><option>0%</option><option>5%</option><option>12%</option><option>18%</option><option>28%</option></select></SettingRow>
    </Section>
  );
}

function MessageSettings() {
  return (
    <Section title="Custom Messages">
      <SettingRow label="Invoice Footer Message" description="Printed at bottom of every invoice"><textarea style={{ ...inp, height: 64, resize: "none" }} placeholder="Thank you for your business!" /></SettingRow>
      <SettingRow label="Payment Reminder Message" description="Sent with payment reminder"><textarea style={{ ...inp, height: 64, resize: "none" }} placeholder="Dear {name}, your balance is ₹{amount}..." /></SettingRow>
      <SettingRow label="WhatsApp Message Template" description="Template for WhatsApp invoice sharing"><textarea style={{ ...inp, height: 64, resize: "none" }} placeholder="Invoice {invoice_no} for ₹{amount} is attached." /></SettingRow>
    </Section>
  );
}

function PartySettings() {
  return (
    <Section title="Customer / Supplier Defaults">
      <SettingRow label="Default Credit Limit" description="Default credit limit for new customers"><input style={inp} type="number" placeholder="0" /></SettingRow>
      <SettingRow label="Default Credit Days" description="Payment due period in days"><input style={inp} type="number" placeholder="30" /></SettingRow>
      <SettingRow label="Show Party Balance on POS"><Toggle defaultOn /></SettingRow>
      <SettingRow label="Mandatory Mobile Number"><Toggle /></SettingRow>
      <SettingRow label="Mandatory GSTIN for Business"><Toggle /></SettingRow>
    </Section>
  );
}

function ProductSettings() {
  return (
    <Section title="Product Defaults">
      <SettingRow label="Default Unit"><select style={inp}><option>Nos</option><option>Kg</option><option>Litre</option><option>Box</option></select></SettingRow>
      <SettingRow label="Low Stock Alert Threshold"><input style={inp} type="number" placeholder="10" /></SettingRow>
      <SettingRow label="Enable Batch Tracking"><Toggle /></SettingRow>
      <SettingRow label="Enable Expiry Date Tracking"><Toggle /></SettingRow>
      <SettingRow label="Show MRP on Invoice"><Toggle defaultOn /></SettingRow>
      <SettingRow label="Allow Price Edit on POS"><Toggle defaultOn /></SettingRow>
    </Section>
  );
}

function ReminderSettings() {
  return (
    <Section title="Service Reminder Configuration">
      <SettingRow label="Enable Service Reminders"><Toggle /></SettingRow>
      <SettingRow label="Reminder Days Before Due"><input style={inp} type="number" placeholder="3" /></SettingRow>
      <SettingRow label="Send WhatsApp Reminder"><Toggle /></SettingRow>
      <SettingRow label="Send SMS Reminder"><Toggle /></SettingRow>
      <SettingRow label="Reminder Repeat Interval" description="Days between repeated reminders"><input style={inp} type="number" placeholder="1" /></SettingRow>
    </Section>
  );
}

function AccountingSettings() {
  return (
    <Section title="Accounting Setup">
      <SettingRow label="Enable Double-Entry Accounting"><Toggle /></SettingRow>
      <SettingRow label="Cash Account Name"><input style={inp} placeholder="Cash" /></SettingRow>
      <SettingRow label="Bank Account Name"><input style={inp} placeholder="HDFC Bank" /></SettingRow>
      <SettingRow label="Opening Balance Date"><input style={inp} type="date" /></SettingRow>
      <SettingRow label="Auto-create Journal Entries" description="Create journal entries for each transaction"><Toggle /></SettingRow>
    </Section>
  );
}

// ── Route → key map ──────────────────────────────────────────

const ROUTE_MAP: Record<string, { key: string; label: string; content: React.ReactNode }> = {
  "/app/settings/general":     { key: "general",     label: "General",             content: <GeneralSettings /> },
  "/app/settings/transaction": { key: "transaction",  label: "Transaction",          content: <TransactionSettings /> },
  "/app/settings/print":       { key: "print",        label: "Print",                content: <PrintSettings /> },
  "/app/settings/taxes":       { key: "taxes",        label: "Taxes & GST",          content: <TaxSettings /> },
  "/app/settings/messages":    { key: "messages",     label: "Transaction Message",  content: <MessageSettings /> },
  "/app/settings/party":       { key: "party",        label: "Party",                content: <PartySettings /> },
  "/app/settings/product":     { key: "product",      label: "Product",              content: <ProductSettings /> },
  "/app/settings/reminders":   { key: "reminders",    label: "Service Reminders",    content: <ReminderSettings /> },
  "/app/settings/accounting":  { key: "accounting",   label: "Accounting",           content: <AccountingSettings /> },
};

// ── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { pathname } = useLocation();

  const match = Object.entries(ROUTE_MAP).find(([route]) => pathname.startsWith(route));
  const current = match?.[1] ?? ROUTE_MAP["/app/settings/general"];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#F8FAFC" }}>
      <div style={{ padding: "24px 28px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{current.label}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
              Configure {current.label.toLowerCase()} settings for your business
            </div>
          </div>
          <button style={{
            background: "#F97316", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "9px 20px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", outline: "none",
          }}>
            Save Changes
          </button>
        </div>

        {/* Settings content */}
        {current.content}
      </div>
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────

const inp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 7,
  padding: "7px 10px", fontSize: 13, color: "#1E293B",
  outline: "none", fontFamily: "inherit",
  background: "#F8FAFC", minWidth: 160,
};
