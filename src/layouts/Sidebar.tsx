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
  FileText,
  CreditCard,
  ClipboardList,
  PackageCheck,
  RotateCcw,
  List,
  Tag,
  AlertTriangle,
  ArrowRightLeft,
  Upload,
  Download,
  ScanLine,
  Calculator,
  Wallet,
  PiggyBank,
  Sliders,
  Printer,
  Percent,
  MessageSquare,
  Users2,
  Box,
  Bell,
  BookOpen,
  UserCog,
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
  icon: LucideIcon;
  isSubChild?: boolean;
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
    label: "Sales", icon: TrendingUp, to: "/app/sales",
    children: [
      { label: "Sale Invoices",             icon: FileText,      to: "/app/sales/invoices"   },
      { label: "Payment-In",                icon: CreditCard,    to: "/app/sales/payment-in" },
      { label: "Sale Order",                icon: ClipboardList, to: "/app/sales/orders"     },
      { label: "Delivery Challan",          icon: PackageCheck,  to: "/app/sales/challan"    },
      { label: "Sale Return / Credit Note", icon: RotateCcw,     to: "/app/sales/returns"    },
    ],
  },
  {
    label: "Products", icon: Package, to: "/app/products",
    children: [
      { label: "All Products",     icon: List,           to: "/app/products/all"        },
      { label: "Categories",       icon: Tag,            to: "/app/products/categories" },
      { label: "Low Stock",        icon: AlertTriangle,  to: "/app/products/low-stock"  },
      { label: "Product Transfer", icon: ArrowRightLeft, to: "/app/products/transfer"   },
    ],
  },
  { label: "Purchase", icon: ShoppingCart, to: "/app/purchase",
    children: [
      { label: "All Purchases",   icon: ShoppingCart, to: "/app/purchase/all"    },
      { label: "Purchase Return", icon: RotateCcw,    to: "/app/purchase/return" },
    ],
  },
  { label: "Inventory", icon: Package,   to: "/app/inventory" },
  { label: "Customers", icon: Users,     to: "/app/customers" },
  { label: "Suppliers", icon: Truck,     to: "/app/suppliers" },
  { label: "Expenses",  icon: Receipt,   to: "/app/expenses"  },
  { label: "Utilities", icon: Wrench,    to: "/app/utilities",
    children: [
      { label: "Import Data",       icon: Upload,    to: "/app/utilities/import"        },
      { label: "Export Data",       icon: Download,  to: "/app/utilities/export"        },
      { label: "Barcode Generator", icon: ScanLine,  to: "/app/utilities/barcode"       },
      { label: "Calculator",        icon: Calculator,to: "/app/utilities/calculator"    },
      { label: "Cash Register",     icon: Wallet,    to: "/app/utilities/cash-register" },
      { label: "Expenses Tracker",  icon: PiggyBank, to: "/app/utilities/expenses"      },
    ],
  },
  { label: "Reports",  icon: BarChart2,  to: "/app/reports"   },
  { label: "Settings", icon: Settings,  to: "/app/settings",
    children: [
      { label: "General",             icon: Sliders,    to: "/app/settings/general"     },
      { label: "Transaction",         icon: Receipt,    to: "/app/settings/transaction"  },
      { label: "Print",               icon: Printer,    to: "/app/settings/print"        },
      { label: "Taxes & GST",         icon: Percent,    to: "/app/settings/taxes"        },
      { label: "Transaction Message", icon: MessageSquare, to: "/app/settings/messages"  },
      { label: "Party",               icon: Users2,     to: "/app/settings/party"        },
      { label: "Product",             icon: Box,        to: "/app/settings/product"      },
      { label: "Service Reminders",   icon: Bell,       to: "/app/settings/reminders"    },
      { label: "Accounting",          icon: BookOpen,   to: "/app/settings/accounting"   },
      { label: "Officer Management",  icon: UserCog,    to: "/app/settings/officers"     },
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
              const isActive = location.pathname === child.to ||
                (child.isSubChild && location.pathname.startsWith(child.to));
              const indent = child.isSubChild ? 50 : 36;
              const Icon = child.icon;
              return (
                <NavLink key={child.to} to={child.to}
                  style={{ textDecoration: "none", display: "block" }}>
                  <div
                    style={{
                      display: "flex", alignItems: "center",
                      padding: `7px 10px 7px ${indent}px`,
                      borderRadius: 7,
                      background: isActive ? "rgba(249,115,22,0.10)" : "transparent",
                      cursor: "pointer", marginBottom: 1,
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    {/* Icon */}
                    <span style={{ display: "flex", flexShrink: 0, marginRight: 7,
                      color: isActive ? "#F97316" : "#94A3B8" }}>
                      <Icon size={13} strokeWidth={1.8} />
                    </span>
                    {child.isSubChild && (
                      <span style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isActive ? "#F97316" : "#CBD5E1",
                        display: "inline-block", marginRight: 5, flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#F97316" : child.isSubChild ? "#94A3B8" : "#64748B",
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis", flex: 1,
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

      {/* ── Collapsed: show sub-item icons as icon-only links ── */}
      {hasChildren && sidebarCollapsed && (
        <div style={{ marginBottom: 2 }}>
          {item.children!.map((child) => {
            const isActive = location.pathname === child.to ||
              (child.isSubChild && location.pathname.startsWith(child.to));
            const Icon = child.icon;
            return (
              <NavLink key={child.to} to={child.to}
                title={child.label}
                style={{ textDecoration: "none", display: "block" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 30, borderRadius: 7, marginBottom: 1,
                  background: isActive ? "rgba(249,115,22,0.10)" : "transparent",
                  cursor: "pointer", transition: "background 0.12s",
                }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}>
                  <Icon size={14} strokeWidth={1.8}
                    color={isActive ? "#F97316" : "#94A3B8"} />
                </div>
              </NavLink>
            );
          })}
        </div>
      )}
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
        height: "100%",          /* fill flex parent, not full viewport */
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowX: "hidden",
        overflowY: "hidden",
        borderRight: "1px solid #F1F5F9",
        boxShadow: "1px 0 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Logo + collapse arrow ──────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: sidebarCollapsed ? "center" : "flex-start",
        padding: sidebarCollapsed ? "0" : "0 12px 0 14px",
        height: 52,
        flexShrink: 0,
        overflow: "hidden",
        borderBottom: "1px solid #F1F5F9",
      }}>

        {/* When expanded: logo + name + arrow */}
        {!sidebarCollapsed && (
          <>
            {/* Logo */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#F97316", flexShrink: 0, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <img src="/logo.png" alt="Orizo Bills"
                style={{ width: 32, height: 32, objectFit: "contain" }}
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  if (el.parentElement)
                    el.parentElement.innerHTML = `<span style="color:#fff;font-weight:800;font-size:14px">O</span>`;
                }} />
            </div>

            {/* Brand name */}
            <span style={{
              color: "#0F172A", fontWeight: 700, fontSize: 14,
              whiteSpace: "nowrap", overflow: "hidden",
              marginLeft: 9, flex: 1,
            }}>
              Orizo Bills
            </span>

            {/* Collapse arrow — right side */}
            <button onClick={toggleSidebarCollapsed}
              title="Collapse sidebar"
              style={{
                width: 26, height: 26, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "none", border: "1px solid #E2E8F0",
                borderRadius: 6, cursor: "pointer", outline: "none",
                marginLeft: 6, transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#F97316";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "none";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
              }}>
              <ChevronsLeft size={14} color="#94A3B8" />
            </button>
          </>
        )}

        {/* When collapsed: just the expand arrow, perfectly centered */}
        {sidebarCollapsed && (
          <button onClick={toggleSidebarCollapsed}
            title="Expand sidebar"
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "1px solid #E2E8F0",
              borderRadius: 8, cursor: "pointer", outline: "none",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#F97316";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
            }}>
            {/* Arrow points right when collapsed = expand */}
            <ChevronsLeft size={16} color="#94A3B8"
              style={{ transform: "rotate(180deg)" }} />
          </button>
        )}
      </div>

      {/* ── Nav — scrollable, takes all remaining space ─── */}
      <nav style={{
        flex: 1,
        minHeight: 0,          /* critical: allows flex child to shrink + scroll */
        overflowY: "auto",
        overflowX: "hidden",
        padding: "10px 10px 6px",
        scrollbarWidth: "none",
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
          padding: "14px 14px 16px",
          borderTop: "1px solid #F1F5F9",
          flexShrink: 0,
          minHeight: 60,
          overflow: "visible",
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
        border: !isActive && hovered ? "1.5px solid #F97316" : "1.5px solid transparent",
        // Expanded: full orange fill when active (original behaviour)
        // Collapsed: transparent — the icon box below handles the highlight
        background: isActive && !collapsed ? "#F97316" : "transparent",
        cursor: "pointer",
        fontFamily: "inherit", outline: "none",
        marginBottom: 1,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Collapsed + active: icon gets orange border box */}
      {collapsed && isActive ? (
        <span style={{
          display: "flex", flexShrink: 0,
          width: 30, height: 30,
          alignItems: "center", justifyContent: "center",
          borderRadius: 7,
          border: "2px solid #F97316",
          background: "rgba(249,115,22,0.10)",
          color: "#F97316",
        }}>
          <item.icon size={16} strokeWidth={2.2} />
        </span>
      ) : (
        <span style={{
          display: "flex", flexShrink: 0,
          color: isActive && !collapsed ? "#fff" : "#64748B",
        }}>
          <item.icon size={17} strokeWidth={1.8} />
        </span>
      )}
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
            border: !isActive && hovered ? "1.5px solid #F97316" : "1.5px solid transparent",
            // Expanded: full orange fill; Collapsed: transparent (icon box handles it)
            background: isActive && !collapsed ? "#F97316" : "transparent",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          {/* Collapsed + active: orange bordered icon box */}
          {collapsed && isActive ? (
            <span style={{
              display: "flex", flexShrink: 0,
              width: 30, height: 30,
              alignItems: "center", justifyContent: "center",
              borderRadius: 7,
              border: "2px solid #F97316",
              background: "rgba(249,115,22,0.10)",
              color: "#F97316",
            }}>
              <Icon size={16} strokeWidth={2.2} />
            </span>
          ) : (
            <span style={{
              display: "flex", flexShrink: 0,
              color: isActive && !collapsed ? "#fff" : "#64748B",
            }}>
              <Icon size={17} strokeWidth={1.8} />
            </span>
          )}
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
