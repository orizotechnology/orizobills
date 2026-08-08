import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts";

function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Lazy imports
const DashboardPage       = lazy(() => import("@/app/dashboard/DashboardPage"));
const PosPage             = lazy(() => import("@/app/pos/PosPage"));
const ProductsPage        = lazy(() => import("@/app/products/ProductsPage"));
const CategoriesPage      = lazy(() => import("@/app/products/CategoriesPage"));
const LowStockPage        = lazy(() => import("@/app/products/LowStockPage"));
const ProductTransferPage = lazy(() => import("@/app/products/ProductTransferPage"));
const TransferPage        = lazy(() => import("@/app/products/transfer/TransferPage"));
const TransferredPage     = lazy(() => import("@/app/products/transfer/TransferredPage"));
const ReceivedPage        = lazy(() => import("@/app/products/transfer/ReceivedPage"));
const SaleInvoicesPage    = lazy(() => import("@/app/sales/invoices/SaleInvoicesPage"));
const PaymentInPage       = lazy(() => import("@/app/sales/payment-in/PaymentInPage"));
const SaleOrderPage       = lazy(() => import("@/app/sales/orders/SaleOrderPage"));
const DeliveryChallanPage = lazy(() => import("@/app/sales/challan/DeliveryChallanPage"));
const SaleReturnPage      = lazy(() => import("@/app/sales/returns/SaleReturnPage"));
const AllPurchasesPage    = lazy(() => import("@/app/purchase/all/AllPurchasesPage"));
const PurchaseReturnPage  = lazy(() => import("@/app/purchase/return/PurchaseReturnPage"));
const PurchaseEntryPage   = lazy(() => import("@/app/purchase/entry/PurchaseEntryPage"));
const InventoryPage       = lazy(() => import("@/app/inventory/InventoryPage"));
const CustomersPage       = lazy(() => import("@/app/customers/CustomersPage"));
const SuppliersPage       = lazy(() => import("@/app/suppliers/SuppliersPage"));
const ExpensesPage        = lazy(() => import("@/app/expenses/ExpensesPage"));
const ReportsPage         = lazy(() => import("@/app/reports/ReportsPage"));
const SettingsPage        = lazy(() => import("@/app/settings/SettingsPage"));

// Utilities
const BarcodeGeneratorPage = lazy(() => import("@/app/utilities/barcode/BarcodeGeneratorPage"));
const CalculatorPage       = lazy(() => import("@/app/utilities/calculator/CalculatorPage"));
const ImportPage           = lazy(() => import("@/app/utilities/import/ImportPage"));
const ExportPage           = lazy(() => import("@/app/utilities/export/ExportPage"));
const CashRegisterPage     = lazy(() => import("@/app/utilities/cash-register/CashRegisterPage"));
const ExpensesUtilPage     = lazy(() => import("@/app/utilities/expenses/ExpensesUtilPage"));

function W({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

        {/* Core */}
        <Route path="/app/dashboard"        element={<W><DashboardPage /></W>} />
        <Route path="/app/pos"              element={<PosPage />} />

        {/* Products */}
        <Route path="/app/products"                    element={<Navigate to="/app/products/all" replace />} />
        <Route path="/app/products/all"                element={<W><ProductsPage /></W>} />
        <Route path="/app/products/categories"         element={<W><CategoriesPage /></W>} />
        <Route path="/app/products/low-stock"          element={<W><LowStockPage /></W>} />
        <Route path="/app/products/transfer"           element={<W><TransferPage /></W>} />
        <Route path="/app/products/transfer/sent"      element={<W><TransferredPage /></W>} />
        <Route path="/app/products/transfer/received"  element={<W><ReceivedPage /></W>} />

        {/* Sales */}
        <Route path="/app/sales/invoices"   element={<W><SaleInvoicesPage /></W>} />
        <Route path="/app/sales/payment-in" element={<W><PaymentInPage /></W>} />
        <Route path="/app/sales/orders"     element={<W><SaleOrderPage /></W>} />
        <Route path="/app/sales/challan"    element={<W><DeliveryChallanPage /></W>} />
        <Route path="/app/sales/returns"    element={<W><SaleReturnPage /></W>} />
        <Route path="/app/sales"            element={<Navigate to="/app/sales/invoices" replace />} />

        {/* Purchase */}
        <Route path="/app/purchase/all"     element={<W><AllPurchasesPage /></W>} />
        <Route path="/app/purchase/new"     element={<W><PurchaseEntryPage /></W>} />
        <Route path="/app/purchase/return"  element={<W><PurchaseReturnPage /></W>} />
        <Route path="/app/purchase"         element={<Navigate to="/app/purchase/all" replace />} />

        {/* Other modules */}
        <Route path="/app/inventory"        element={<W><InventoryPage /></W>} />
        <Route path="/app/customers"        element={<W><CustomersPage /></W>} />
        <Route path="/app/customers/*"      element={<W><CustomersPage /></W>} />
        <Route path="/app/suppliers"        element={<W><SuppliersPage /></W>} />
        <Route path="/app/suppliers/*"      element={<W><SuppliersPage /></W>} />
        <Route path="/app/expenses"         element={<W><ExpensesPage /></W>} />
        <Route path="/app/expenses/*"       element={<W><ExpensesPage /></W>} />
        <Route path="/app/reports/*"        element={<W><ReportsPage /></W>} />

        {/* Settings — all sub-routes handled inside SettingsPage */}
        <Route path="/app/settings/*"       element={<W><SettingsPage /></W>} />
        <Route path="/app/settings"         element={<Navigate to="/app/settings/general" replace />} />

        {/* Utilities */}
        <Route path="/app/utilities/import"         element={<W><ImportPage /></W>} />
        <Route path="/app/utilities/export"         element={<W><ExportPage /></W>} />
        <Route path="/app/utilities/barcode"        element={<W><BarcodeGeneratorPage /></W>} />
        <Route path="/app/utilities/calculator"     element={<W><CalculatorPage /></W>} />
        <Route path="/app/utilities/cash-register"  element={<W><CashRegisterPage /></W>} />
        <Route path="/app/utilities/expenses"       element={<W><ExpensesUtilPage /></W>} />
        <Route path="/app/utilities"                element={<Navigate to="/app/utilities/import" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
