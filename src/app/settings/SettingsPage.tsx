import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Trash2, ToggleLeft, ToggleRight, UserCog, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

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

// ── Officer Management (admin-only) ──────────────────────────

function OfficerManagement() {
  const { session, officers, addOfficer, removeOfficer, toggleOfficer } = useAuthStore();
  const isAdmin = session?.role === "admin";

  const [showForm,  setShowForm]  = useState(false);
  const [name,      setName]      = useState("");
  const [mobile,    setMobile]    = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [formError, setFormError] = useState("");
  const [success,   setSuccess]   = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setSuccess("");
    if (!name.trim() || name.trim().length < 2) { setFormError("Name must be at least 2 characters."); return; }
    if (!/^[6-9]\d{9}$/.test(mobile.replace(/\s/g, ""))) { setFormError("Enter a valid 10-digit mobile number."); return; }
    if (!password || password.length < 6) { setFormError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const result = await addOfficer(name.trim(), mobile.replace(/\s/g, ""), password);
    setLoading(false);
    if (result.ok) {
      setSuccess(`Officer "${name.trim()}" added successfully.`);
      setName(""); setMobile(""); setPassword(""); setShowForm(false);
    } else {
      setFormError(result.error ?? "Failed to add officer.");
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <ShieldCheck size={40} color="#E2E8F0" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>Admin access required</div>
        <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>Only the admin can manage officers.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Officers</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{officers.length} officer{officers.length !== 1 ? "s" : ""} registered</div>
        </div>
        <button onClick={() => { setShowForm(p => !p); setFormError(""); setSuccess(""); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} /> Add Officer
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534" }}>
          ✓ {success}
        </div>
      )}

      {/* Add officer form */}
      {showForm && (
        <div style={{ background: "#fff", border: "1.5px solid #F97316", borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <UserCog size={15} color="#F97316" /> New Officer
          </div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl2}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Officer name" style={inp2} />
              </div>
              <div>
                <label style={lbl2}>Mobile Number</label>
                <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} maxLength={10} placeholder="10-digit mobile" style={inp2} />
              </div>
            </div>
            <div>
              <label style={lbl2}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={{ ...inp2, paddingRight: 36, width: "100%", boxSizing: "border-box" as const }} />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {formError && <div style={{ fontSize: 12, color: "#E11D48", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 7, padding: "8px 12px" }}>⚠️ {formError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "8px 0", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: "8px 0", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Adding…" : "Add Officer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Officers list */}
      {officers.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "40px", textAlign: "center" }}>
          <UserCog size={36} color="#E2E8F0" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>No officers yet</div>
          <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>Add officers to let staff access the app</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Name", "Mobile", "Status", "Added", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {officers.map((o, idx) => (
                <tr key={o.id} style={{ borderBottom: idx < officers.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{o.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#64748B" }}>{o.mobile}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", background: o.isActive ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.15)", color: o.isActive ? "#16A34A" : "#94A3B8" }}>
                      {o.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#94A3B8" }}>
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => toggleOfficer(o.id)} title={o.isActive ? "Deactivate" : "Activate"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: o.isActive ? "#F97316" : "#94A3B8", display: "flex", padding: 4, borderRadius: 6 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        {o.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => removeOfficer(o.id)} title="Remove"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", display: "flex", padding: 4, borderRadius: 6 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "#FFF1F2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const lbl2: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 };
const inp2: React.CSSProperties = { border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#F8FAFC", width: "100%" };

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
  "/app/settings/officers":    { key: "officers",     label: "Officer Management",   content: <OfficerManagement /> },
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
