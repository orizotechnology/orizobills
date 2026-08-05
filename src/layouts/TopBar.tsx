import { useState, useRef, useEffect } from "react";
import {
  Bell, HelpCircle, Search, ChevronDown, Plus, FileText,
  ShoppingCart, Receipt, X, CheckCircle2, ChevronRight,
  AlertTriangle, Package, FileWarning,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BranchSelector } from "@/components/branches/BranchSelector";
import { http } from "@/lib/axios";

// =============================================================
// TYPES
// =============================================================

interface InventoryItem {
  id: string;
  productName: string;
  currentStock: number;
  lowStockAlert: number;
  status: string;
}

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  balanceDue: number;
  status: string;
}

// =============================================================
// SEARCH INDEX
// =============================================================

const SEARCH_INDEX = [
  { label: "Dashboard",          to: "/app/dashboard",              category: "Pages"     },
  { label: "POS / Quick Sale",   to: "/app/pos",                    category: "Pages"     },
  { label: "Sale Invoices",      to: "/app/sales/invoices",         category: "Sales"     },
  { label: "Payment In",         to: "/app/sales/payment-in",       category: "Sales"     },
  { label: "Sale Orders",        to: "/app/sales/orders",           category: "Sales"     },
  { label: "Delivery Challan",   to: "/app/sales/challan",          category: "Sales"     },
  { label: "Sale Return",        to: "/app/sales/returns",          category: "Sales"     },
  { label: "All Purchases",      to: "/app/purchase/all",           category: "Purchases" },
  { label: "New Purchase",       to: "/app/purchase/new",           category: "Purchases" },
  { label: "Purchase Return",    to: "/app/purchase/return",        category: "Purchases" },
  { label: "Products",           to: "/app/products",               category: "Products"  },
  { label: "Inventory",          to: "/app/inventory",              category: "Products"  },
  { label: "Customers",          to: "/app/customers",              category: "Contacts"  },
  { label: "Suppliers",          to: "/app/suppliers",              category: "Contacts"  },
  { label: "Expenses",           to: "/app/expenses",               category: "Finance"   },
  { label: "Reports",            to: "/app/reports",                category: "Finance"   },
  { label: "Import Data",        to: "/app/utilities/import",       category: "Utilities" },
  { label: "Export Data",        to: "/app/utilities/export",       category: "Utilities" },
  { label: "Barcode Generator",  to: "/app/utilities/barcode",      category: "Utilities" },
  { label: "Calculator",         to: "/app/utilities/calculator",   category: "Utilities" },
  { label: "Cash Register",      to: "/app/utilities/cash-register",category: "Utilities" },
  { label: "Settings",           to: "/app/settings/general",       category: "Settings"  },
  { label: "Officer Management", to: "/app/settings/officers",      category: "Settings"  },
  { label: "Taxes & GST",        to: "/app/settings/taxes",         category: "Settings"  },
  { label: "Print Settings",     to: "/app/settings/print",         category: "Settings"  },
];

// =============================================================
// HELP CONTENT
// =============================================================

const HELP_SECTIONS = [
  {
    title: "Getting Started",
    body: "After logging in, start by setting up your business profile in Settings → General. Add your store name, address, and tax information. Then add your products under the Products section, set up customers and suppliers, and you're ready to create your first invoice.",
  },
  {
    title: "Sales",
    body: "Create sale invoices from Sales → Invoices → New Invoice. For quick cash sales, use POS / Quick Sale. Record customer payments under Payment In. Manage pre-confirmed orders in Sale Orders, generate delivery notes via Delivery Challan, and handle returns with Sale Return.",
  },
  {
    title: "Purchases",
    body: "Record stock purchases under Purchase → All Purchases → New Purchase. Fill in supplier details, items, quantities, and amounts. For goods returned to suppliers, use Purchase Return to reduce your payable balance and adjust inventory.",
  },
  {
    title: "Products",
    body: "Add products from the Products page — set name, SKU, category, selling price, purchase price, and tax. Manage current stock levels and set low-stock thresholds in Inventory so the system alerts you when stock runs low.",
  },
  {
    title: "Customers & Suppliers",
    body: "Add customers in the Customers section with contact details and opening balance. Suppliers are managed similarly under Suppliers. Both pages show outstanding balances and full transaction history for each contact.",
  },
  {
    title: "Expenses",
    body: "Record business expenses (rent, utilities, wages, etc.) in the Expenses section. Choose a category, enter the amount, date, and notes. Expenses appear in reports so you can track profitability accurately.",
  },
  {
    title: "Reports",
    body: "Access financial summaries, profit & loss, stock reports, customer/supplier ledgers, tax reports, and more from the Reports section. Use filters to narrow by date range, party, or product.",
  },
  {
    title: "Import Data",
    body: "Bulk-import products, customers, or suppliers using Excel files. Download the template from Utilities → Import Data, fill in your data following the column format, then upload the file. The system will validate and import all valid rows.",
  },
  {
    title: "Settings",
    body: "Configure your business in Settings → General. Add user accounts with role-based access in Officer Management. Set up GST slabs and tax rates in Taxes & GST. Customise invoice and receipt print layout in Print Settings.",
  },
  {
    title: "Need Help?",
    body: "Email us at support@orizobills.com for any queries. You can also reach us on WhatsApp — tap the link below to start a chat. We typically respond within a few hours on business days.",
    contact: true,
  },
];

// =============================================================
// CREATE ITEMS
// =============================================================

const CREATE_ITEMS = [
  { label: "Sale Invoice",     icon: FileText,     to: "/app/sales/invoices" },
  { label: "POS / Quick Sale", icon: Plus,         to: "/app/pos"            },
  { label: "Purchase Bill",    icon: ShoppingCart, to: "/app/purchase/new"   },
  { label: "Expense",          icon: Receipt,      to: "/app/expenses"       },
];

// =============================================================
// TOP BAR
// =============================================================

export function TopBar() {
  const navigate = useNavigate();

  // ── Create dropdown ─────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // ── Notifications ───────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef   = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);

  // ── Help ────────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // ── Search ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen,  setSearchOpen]  = useState(false);
  const searchRef     = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Data: inventory & sales ─────────────────────────────────
  const { data: inventoryData } = useQuery({
    queryKey: ["topbar-inventory"],
    queryFn:  async () => {
      const res = await http.get<{ success: boolean; data: { items: InventoryItem[] } }>("/inventory");
      return res.data?.items ?? [];
    },
    staleTime: 60_000,
  });

  const { data: salesData } = useQuery({
    queryKey: ["topbar-sales"],
    queryFn:  async () => {
      const res = await http.get<{ success: boolean; data: { data: SaleInvoice[]; total: number } }>("/sales?page=1&pageSize=100");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const lowStockItems  = (inventoryData ?? []).filter(
    (i) => i.status === "LOW_STOCK" || i.status === "OUT_OF_STOCK"
  );
  const unpaidInvoices = (salesData ?? []).filter(
    (s) => s.status === "UNPAID" || s.status === "PARTIAL"
  );
  const totalNotifCount = lowStockItems.length + unpaidInvoices.length;

  // ── Outside-click handlers ───────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
    };
    if (createOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [createOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        notifRef.current && !notifRef.current.contains(e.target as Node) &&
        bellBtnRef.current && !bellBtnRef.current.contains(e.target as Node)
      ) setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    if (helpOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [helpOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    if (searchOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // ── Search results ───────────────────────────────────────────
  const filtered = SEARCH_INDEX.filter((item) =>
    searchQuery === "" || item.label.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  const grouped = filtered.reduce<Record<string, typeof SEARCH_INDEX>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center",
        height: 56, padding: "0 20px",
        background: "#fff", borderBottom: "1px solid #E2E8F0",
        flexShrink: 0, gap: 12, position: "relative", zIndex: 100,
      }}>
        {/* Branch Selector */}
        <BranchSelector />

        <div style={{ flex: 1 }} />

        {/* ── Search ── */}
        <div ref={searchRef} style={{ position: "relative", width: 260 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search anything..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={(e) => { setSearchOpen(true); e.currentTarget.style.borderColor = "#F97316"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC"; }}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); searchInputRef.current?.blur(); } }}
            style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 12px 7px 32px", fontSize: 13, color: "#475569", background: "#F8FAFC", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s", boxSizing: "border-box" }}
          />

          <AnimatePresence>
            {searchOpen && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                  zIndex: 600, overflow: "hidden", maxHeight: 360, overflowY: "auto",
                }}
              >
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                      {cat.toUpperCase()}
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.to}
                        onMouseDown={() => { navigate(item.to); setSearchOpen(false); setSearchQuery(""); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
                      >
                        <Search size={13} color="#CBD5E1" style={{ flexShrink: 0 }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ flex: 1 }} />

        {/* ── Right actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

          {/* Bell */}
          <div style={{ position: "relative" }}>
            <button
              ref={bellBtnRef}
              onClick={() => setNotifOpen((p) => !p)}
              title="Notifications"
              style={{ position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#64748B", outline: "none", transition: "background 0.12s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.8} />
              {totalNotifCount > 0 && (
                <span style={{ position: "absolute", top: 5, right: 5, background: "#F97316", color: "#fff", fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
                  {totalNotifCount > 99 ? "99+" : totalNotifCount}
                </span>
              )}
            </button>
          </div>

          {/* Help */}
          <button
            onClick={() => setHelpOpen((p) => !p)}
            title="Help"
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: 8, cursor: "pointer", color: "#64748B", outline: "none", transition: "background 0.12s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            aria-label="Help"
          >
            <HelpCircle size={18} strokeWidth={1.8} />
          </button>

          {/* Create dropdown */}
          <div ref={createRef} style={{ position: "relative", marginLeft: 4 }}>
            <button
              onClick={() => setCreateOpen((p) => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#F97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", transition: "background 0.12s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EA580C"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F97316"; }}
            >
              <Plus size={15} strokeWidth={2.5} />
              Create
              <ChevronDown size={13} strokeWidth={2.2} style={{ transition: "transform 0.15s", transform: createOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>

            {createOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 200, zIndex: 500, overflow: "hidden", padding: "4px 0" }}>
                <div style={{ padding: "8px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F1F5F9", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>QUICK CREATE</span>
                  <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", display: "flex", padding: 2 }}><X size={12} /></button>
                </div>
                {CREATE_ITEMS.map(({ label, icon: Icon, to }) => (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setCreateOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", textAlign: "left", transition: "background 0.1s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} color="#F97316" />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notifications Drawer ── */}
      <AnimatePresence>
        {notifOpen && (
          <motion.div
            ref={notifRef}
            key="notif-drawer"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: "fixed",
              top: 62,
              right: 108,
              width: 380,
              maxHeight: "calc(100vh - 80px)",
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
              zIndex: 900,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={15} color="#F97316" strokeWidth={2} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Notifications</span>
                {totalNotifCount > 0 && (
                  <span style={{ background: "#F97316", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99 }}>{totalNotifCount}</span>
                )}
              </div>
              <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, borderRadius: 6, color: "#94A3B8" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              ><X size={14} /></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0", scrollbarWidth: "none" }}>
              {totalNotifCount === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 10 }}>
                  <CheckCircle2 size={32} color="#22C55E" strokeWidth={1.5} />
                  <span style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>All clear! No alerts.</span>
                </div>
              ) : (
                <>
                  {/* Low Stock Alerts */}
                  {lowStockItems.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ padding: "4px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={12} color="#F97316" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em" }}>LOW STOCK ALERTS</span>
                      </div>
                      {lowStockItems.map((item) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid #F8FAFC" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "none"; }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: item.status === "OUT_OF_STOCK" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Package size={15} color={item.status === "OUT_OF_STOCK" ? "#EF4444" : "#F97316"} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.productName}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Stock: {item.currentStock} · Alert at: {item.lowStockAlert}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: item.status === "OUT_OF_STOCK" ? "#FEE2E2" : "#FFF7ED", color: item.status === "OUT_OF_STOCK" ? "#EF4444" : "#F97316", flexShrink: 0 }}>
                            {item.status === "OUT_OF_STOCK" ? "Out of Stock" : "Low Stock"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unpaid Invoices */}
                  {unpaidInvoices.length > 0 && (
                    <div>
                      <div style={{ padding: "4px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                        <FileWarning size={12} color="#EF4444" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em" }}>UNPAID INVOICES</span>
                      </div>
                      {unpaidInvoices.map((inv) => (
                        <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid #F8FAFC", cursor: "pointer" }}
                          onClick={() => { navigate("/app/sales/invoices"); setNotifOpen(false); }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "none"; }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FileWarning size={15} color="#EF4444" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.invoiceNumber}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.customerName}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>₹{inv.balanceDue?.toLocaleString("en-IN") ?? 0}</div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: inv.status === "PARTIAL" ? "#FEF9C3" : "#FEE2E2", color: inv.status === "PARTIAL" ? "#CA8A04" : "#EF4444" }}>
                              {inv.status === "PARTIAL" ? "Partial" : "Unpaid"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Help Dialog (anchored below ? button) ── */}
      <AnimatePresence>
        {helpOpen && (
          <>
            {/* Backdrop — light, no blur */}
            <motion.div
              key="help-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setHelpOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 1100 }}
            />
            {/* Panel anchored below ? button — same as notifications */}
            <motion.div
              key="help-dialog"
              ref={helpRef}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0,   opacity: 1 }}
              exit={{    y: -10, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              style={{
                position: "fixed",
                top: 62,          // just below the 56px TopBar + 6px gap
                right: 64,        // aligned below the ? button
                width: 420,
                maxHeight: "calc(100vh - 80px)",
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 14,
                boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                zIndex: 1200,
                display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(249,115,22,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <HelpCircle size={17} color="#F97316" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Help Center</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>How-to guides & support</div>
                  </div>
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, borderRadius: 6, color: "#94A3B8" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Accordion sections */}
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 0", scrollbarWidth: "none" }}>
                {HELP_SECTIONS.map((section) => (
                  <HelpAccordion key={section.title} section={section} />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================================
// HELP ACCORDION ITEM
// =============================================================

interface HelpSection {
  title: string;
  body: string;
  contact?: boolean;
}

function HelpAccordion({ section }: { section: HelpSection }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", gap: 12 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{section.title}</span>
        <ChevronRight size={15} color="#94A3B8" style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 20px 14px", fontSize: 13, color: "#475569", lineHeight: 1.65 }}>
              {section.body}
              {section.contact && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <a
                    href="mailto:support@orizobills.com"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#F97316", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                  >
                    ✉ support@orizobills.com
                  </a>
                  <a
                    href="https://wa.me/911234567890"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#22C55E", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                  >
                    💬 Chat on WhatsApp
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
