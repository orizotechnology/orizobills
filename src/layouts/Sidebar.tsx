import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Receipt,
  BarChart2,
  Settings,
  ChevronsLeft,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { useUIStore } from "@/store";
import { useAuthStore } from "@/store/auth.store";
import { ProfileDrawer } from "@/components/profile/ProfileDrawer";
import type { LucideIcon } from "lucide-react";

// =============================================================
// NAV STRUCTURE
// =============================================================

interface SubItem {
  label: string;
  to: string;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  children?: SubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/app/dashboard" },
  {
    label: "Sales",
    icon: TrendingUp,
    to: "/app/sales",
    children: [
      { label: "Sale Invoices",             to: "/app/sales/invoices"   },
      { label: "Payment-In",                to: "/app/sales/payment-in" },
      { label: "Sale Order",                to: "/app/sales/orders"     },
      { label: "Delivery Challan",          to: "/app/sales/challan"    },
      { label: "Sale Return / Credit Note", to: "/app/sales/returns"    },
    ],
  },
  {
    label: "Products",
    icon: Package,
    to: "/app/products",
    children: [
      { label: "All Products",     to: "/app/products/all"        },
      { label: "Categories",       to: "/app/products/categories" },
      { label: "Low Stock",        to: "/app/products/low-stock"  },
      { label: "Product Transfer", to: "/app/products/transfer"   },
    ],
  },
  { label: "Purchase",  icon: ShoppingCart, to: "/app/purchase",
    children: [
      { label: "All Purchases",   to: "/app/purchase/all"    },
      { label: "Purchase Return", to: "/app/purchase/return" },
    ],
  },
  { label: "Inventory", icon: Package,      to: "/app/inventory" },
  { label: "Customers", icon: Users,        to: "/app/customers" },
  { label: "Suppliers", icon: Truck,        to: "/app/suppliers" },
  { label: "Expenses",  icon: Receipt,      to: "/app/expenses"  },
  { label: "Utilities", icon: Wrench,       to: "/app/utilities",
    children: [
      { label: "Import Data",       to: "/app/utilities/import"   },
      { label: "Export Data",       to: "/app/utilities/export"   },
      { label: "Barcode Generator", to: "/app/utilities/barcode"  },
      { label: "Calculator",        to: "/app/utilities/calculator" },
      { label: "Cash Register",     to: "/app/utilities/cash-register" },
      { label: "Expenses Tracker",  to: "/app/utilities/expenses" },
    ],
  },
  { label: "Reports",   icon: BarChart2,    to: "/app/reports"   },
  { label: "Settings",  icon: Settings, to: "/app/settings",
    children: [
      { label: "General",             to: "/app/settings/general"     },
      { label: "Transaction",         to: "/app/settings/transaction"  },
      { label: "Print",               to: "/app/settings/print"        },
      { label: "Taxes & GST",         to: "/app/settings/taxes"        },
      { label: "Transaction Message", to: "/app/settings/messages"     },
      { label: "Party",               to: "/app/settings/party"        },
      { label: "Product",             to: "/app/settings/product"      },
      { label: "Service Reminders",   to: "/app/settings/reminders"    },
      { label: "Accounting",          to: "/app/settings/accounting"   },
      { label: "Officer Management",  to: "/app/settings/officers"     },
    ],
  },
];

// =============================================================
// NAV ENTRY — renders one item (expandable or plain link)
// =============================================================

interface NavEntryProps {
  item: NavItem;
  expanded: Record<string, boolean>;
  sidebarCollapsed: boolean;
  location: ReturnType<typeof useLocation>;
  onToggle: (to: string) => void;
}

function NavEntry({ item, expanded, sidebarCollapsed, location, onToggle }: NavEntryProps) {
  const hasChildren   = !!item.children?.length;
  const isExpanded    = expanded[item.to];
  const isParentActive = location.pathname.startsWith(item.to + "/") || location.pathname === item.to;

  return (
    <div>
      {hasChildren ? (
        <ExpandableNavItem
          item={item}
          isActive={isParentActive}
          isExpanded={isExpanded}
          collapsed={sidebarCollapsed}
          onToggle={() => onToggle(item.to)}
        />
      ) : (
        <SidebarItem item={item} collapsed={sidebarCollapsed} />
      )}

      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && !sidebarCollapsed && (
          <motion.div
            key="sub"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", marginBottom: 2 }}
          >
            {item.children!.map((child) => {
              const isActive = location.pathname === child.to;
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "7px 10px 7px 36px",
                      borderRadius: 7,
                      background: isActive ? "rgba(249,115,22,0.10)" : "transparent",
                      cursor: "pointer",
                      marginBottom: 1,
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#F97316" : "#64748B",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}>
                      {child.label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================
// SIDEBAR
// =============================================================

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { session } = useAuthStore();
  const location = useLocation();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    return { "/app/sales": location.pathname.startsWith("/app/sales") };
  });
  const [profileOpen, setProfileOpen] = useState(false);

  const toggleExpand = (to: string) => {
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));
  };

  return (
    <motion.div
      animate={{ width: sidebarCollapsed ? 64 : 200 }}
      initial={false}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      style={{
        background: "#FFFFFF",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        borderRight: "1px solid #F1F5F9",
        boxShadow: "1px 0 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", height: 64, flexShrink: 0,
        overflow: "hidden", borderBottom: "1px solid #F8FAFC",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "#F97316",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}>
          <img
            src="/logo.png"
            alt="Orizo Bills"
            style={{ width: 36, height: 36, objectFit: "contain" }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              if (el.parentElement) {
                el.parentElement.innerHTML = `<span style="color:#fff;font-weight:800;font-size:16px">O</span>`;
              }
            }}
          />
        </div>
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.span key="brand"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ color: "#0F172A", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}
            >
              Orizo Bills
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "10px 10px 6px", scrollbarWidth: "none",
      }}>
        {/* No global CSS hover — handled per-item with state */}

        {NAV_ITEMS.map((item) => (
          <NavEntry
            key={item.to}
            item={item}
            expanded={expanded}
            sidebarCollapsed={sidebarCollapsed}
            location={location}
            onToggle={(to) => { if (!sidebarCollapsed) toggleExpand(to); }}
          />
        ))}
      </nav>

      {/* ── User profile ──────────────────────────────────── */}
      <button
        onClick={() => setProfileOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px",
          borderTop: "1px solid #F1F5F9",
          flexShrink: 0, overflow: "hidden",
          width: "100%", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
        title={sidebarCollapsed ? "Profile" : undefined}
      >
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "#F97316", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 13, fontWeight: 700,
          border: "2px solid #FED7AA",
        }}>
          {session?.name?.charAt(0)?.toUpperCase() ?? "U"}
        </div>
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div key="userinfo"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                flex: 1, minWidth: 0, overflow: "hidden",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: "#0F172A", fontSize: 12, fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {session?.name ?? "User"}
                </div>
                <div style={{ color: "#94A3B8", fontSize: 11 }}>
                  {session?.role === "admin" ? "Admin" : "Officer"}
                </div>
              </div>
              <ChevronDown size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* ── Profile drawer ────────────────────────────────── */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* ── Collapse button ───────────────────────────────── */}
      <button
        onClick={toggleSidebarCollapsed}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: 36, width: "100%",
          background: "transparent", border: "none",
          borderTop: "1px solid #F1F5F9",
          cursor: "pointer", flexShrink: 0,
          transition: "background 0.15s",
          gap: 6,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        aria-label="Toggle sidebar"
      >
        <motion.div
          animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <ChevronsLeft size={15} color="#94A3B8" />
        </motion.div>
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.span key="colLabel"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}
            >
              Collapse
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

// =============================================================
// EXPANDABLE NAV ITEM (has children — uses hover state)
// =============================================================

interface ExpandableNavItemProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

function ExpandableNavItem({ item, isActive, isExpanded, collapsed, onToggle }: ExpandableNavItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => { if (!isActive) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 10px", borderRadius: 8,
        border: `1.5px solid ${!isActive && hovered ? "#F97316" : "transparent"}`,
        background: isActive ? "#F97316" : "transparent",
        cursor: "pointer",
        fontFamily: "inherit", outline: "none",
        marginBottom: 1,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span style={{ display: "flex", flexShrink: 0, color: isActive ? "#fff" : "#64748B" }}>
        <item.icon size={17} strokeWidth={1.8} />
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span key="lbl"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              flex: 1, textAlign: "left",
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isActive ? "#fff" : "#475569",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div key="chev"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: "flex", flexShrink: 0 }}
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={13} color={isActive ? "#fff" : "#94A3B8"} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

// =============================================================
// REGULAR NAV ITEM (no children)
// =============================================================

interface SidebarItemProps {
  item: NavItem;
  collapsed: boolean;
}

function SidebarItem({ item, collapsed }: SidebarItemProps) {
  const Icon = item.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      style={{ textDecoration: "none", display: "block", marginBottom: 1 }}
    >
      {({ isActive }) => (
        <div
          onMouseEnter={() => { if (!isActive) setHovered(true); }}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: "relative",
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 8,
            border: `1.5px solid ${!isActive && hovered ? "#F97316" : "transparent"}`,
            background: isActive ? "#F97316" : "transparent",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <span style={{ display: "flex", flexShrink: 0, color: isActive ? "#fff" : "#64748B" }}>
            <Icon size={17} strokeWidth={1.8} />
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="lbl"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "#475569",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}
    </NavLink>
  );
}
