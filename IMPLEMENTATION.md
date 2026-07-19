# Orizo Bills — Full Backend & Frontend Implementation

## Overview

This document describes everything implemented in this session: the complete
database schema, all backend services and API routes, all frontend pages wired
to live data, and the inventory stock-movement rules.

---

## 1. Database Schema (`server/prisma/schema.prisma`)

The schema was expanded from 2 models (Branch, Product) to **16 models** covering
the full ERP workflow.

### Models added

| Model | Table | Purpose |
|---|---|---|
| `InventoryItem` | `inventory_items` | One row per product, tracks openingStock / stockIn / stockOut |
| `Customer` | `customers` | Customer master with GSTIN and balance tracking |
| `Supplier` | `suppliers` | Supplier master with GSTIN and balance tracking |
| `PurchaseInvoice` | `purchase_invoices` | Purchase bills from suppliers |
| `PurchaseInvoiceItem` | `purchase_invoice_items` | Line items on purchase bills |
| `PurchaseReturn` | `purchase_returns` | Returns sent back to suppliers |
| `SaleInvoice` | `sale_invoices` | Sales to customers (POS or manual) |
| `SaleInvoiceItem` | `sale_invoice_items` | Line items on sale invoices |
| `PaymentIn` | `payments_in` | Payments received from customers |
| `SaleOrder` | `sale_orders` | Pre-sale orders |
| `SaleOrderItem` | `sale_order_items` | Line items on orders |
| `DeliveryChallan` | `delivery_challans` | Dispatch / delivery notes |
| `DeliveryChallanItem` | `delivery_challan_items` | Items on challans |
| `SaleReturn` | `sale_returns` | Returns from customers / credit notes |
| `SaleReturnItem` | `sale_return_items` | Line items on sale returns |
| `Expense` | `expenses` | Business expenses with category tracking |

### Product model additions

Two new fields added to the existing `Product` model:
- `purchasePrice` — recorded on purchase for margin tracking
- Relations to all transactional item tables

---

## 2. Stock Movement Rules

Every stock change goes through `server/src/services/inventory.service.ts`.

```
currentStock = openingStock + stockIn - stockOut
```

| Event | Stock Effect |
|---|---|
| Purchase confirmed | `stockIn += qty` |
| Purchase cancelled | `stockIn -= qty` (reversed) |
| Purchase return | `stockIn -= qty` (goods leave warehouse) |
| Sale confirmed (POS or manual) | `stockOut += qty` |
| Sale cancelled | `stockOut -= qty` (reversed) |
| Sale return / credit note | `stockOut -= qty` (goods come back) |
| Manual opening stock adjust | `openingStock = newValue` |

Status thresholds:
- `OUT_OF_STOCK` — currentStock ≤ 0
- `LOW_STOCK` — currentStock ≤ lowStockAlert (default: 5)
- `IN_STOCK` — currentStock > lowStockAlert

---

## 3. Backend Services

All services live in `server/src/services/`.

| File | Responsibilities |
|---|---|
| `db.ts` | Singleton Prisma client shared by all services |
| `counter.service.ts` | Sequential invoice number generation (PUR0001, INV0001, etc.) |
| `inventory.service.ts` | `addStockIn`, `subtractStockIn`, `addStockOut`, `subtractStockOut`, `listInventory`, `adjustOpeningStock` |
| `customer.service.ts` | CRUD + `adjustCustomerBalance` |
| `supplier.service.ts` | CRUD + `adjustSupplierBalance` |
| `purchase.service.ts` | `listPurchases`, `createPurchase` (with stock), `cancelPurchase` (reverses stock), `listPurchaseReturns`, `createPurchaseReturn` |
| `sale.service.ts` | `listSales`, `createSale` (with stock), `cancelSale`, `listSaleReturns`, `createSaleReturn`, `listSaleOrders`, `createSaleOrder`, `listChallans`, `createChallan` |
| `payment.service.ts` | `listPaymentsIn`, `createPaymentIn` (adjusts customer balance + invoice paid amount) |
| `expense.service.ts` | `listExpenses`, `createExpense`, `updateExpense`, `deleteExpense` |

---

## 4. API Routes

All routes registered in `server/src/app.ts` under `/api/*`.

### Products — `/api/products`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (paginated) or search |
| GET | `/barcode/:code` | Barcode / code lookup (used by POS scanner) |
| POST | `/` | Create product |
| PUT | `/:id` | Update product (supports `isActive` toggle) |
| DELETE | `/:id` | Soft-delete |

### Customers — `/api/customers`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List or search |
| GET | `/:id` | Get by ID |
| POST | `/` | Create |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Soft-delete |

### Suppliers — `/api/suppliers`
Same shape as customers.

### Purchases — `/api/purchases`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (paginated) |
| GET | `/next-number` | Next PUR#### number |
| GET | `/:id` | Get with line items |
| POST | `/` | Create + increment stockIn |
| DELETE | `/:id` | Cancel + reverse stockIn |
| GET | `/returns` | List purchase returns |
| POST | `/returns` | Create return + decrement stockIn |

### Sales — `/api/sales`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (paginated) |
| GET | `/next-number` | Next INV#### number |
| GET | `/:id` | Get with line items |
| POST | `/` | Create + increment stockOut |
| DELETE | `/:id` | Cancel + reverse stockOut |
| GET | `/returns` | List sale returns |
| POST | `/returns` | Create return + decrement stockOut |
| GET | `/orders` | List sale orders |
| POST | `/orders` | Create sale order |
| GET | `/challans` | List delivery challans |
| POST | `/challans` | Create challan |

### Payments — `/api/payments`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (paginated) |
| POST | `/` | Record payment, reduce customer balance, update invoice status |

### Expenses — `/api/expenses`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (paginated) |
| POST | `/` | Create |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Hard delete |

### Inventory — `/api/inventory`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Full stock list + summary (total, inStock, lowStock, outOfStock, totalValue) |
| PUT | `/:productId/adjust` | Manual opening stock adjustment |

---

## 5. Frontend Pages — What Changed

Every page now fetches live data from the backend via `src/lib/axios.ts`.

| Page | Before | After |
|---|---|---|
| **Products** | Live (already done) | Richer table + `isActive`, `createdAt`, status badge; `ProductEditDialog` with all fields + Active/Inactive toggle |
| **Sale Invoices** | `rows=[]` empty shell | Live list from `/api/sales`, cancel mutation, status badges, pagination |
| **Payment-In** | Empty shell | Live list from `/api/payments`, inline Add Payment dialog |
| **Sale Orders** | Empty shell | Live list from `/api/sales/orders`, status badges, pagination |
| **Delivery Challan** | Empty shell | Live list from `/api/sales/challans`, status badges, pagination |
| **Sale Returns** | Empty shell | Live list from `/api/sales/returns`, pagination |
| **All Purchases** | Empty shell | Live list from `/api/purchases`, cancel mutation reverses stock, pagination |
| **Purchase Return** | Empty shell | Live list from `/api/purchases/returns`, pagination |
| **Customers** | Empty shell | Live CRUD — list, search, Add/Edit dialog, soft-delete, balance display |
| **Suppliers** | Empty shell | Live CRUD — list, search, Add/Edit dialog, soft-delete |
| **Expenses** | Empty shell | Live CRUD — list, Add/Edit dialog, category filter, delete, total display |
| **Inventory** | Hardcoded zeros | Live stock from `/api/inventory`, summary cards, clickable filter, stock-in/out columns, stock value, Adjust Opening Stock dialog |
| **POS** | Save did nothing | Save (F2) calls `POST /api/sales`, persists invoice, deducts stockOut per item, opens fresh bill tab |

---

## 6. POS Save Flow

When `Save (F2)` is pressed in the POS:

1. Validates at least one item with qty > 0
2. Builds payload from bill state (rows, customer, payment mode, discount)
3. POSTs to `POST /api/sales`
4. Backend:
   - Generates next `INV####` number
   - Creates `SaleInvoice` + `SaleInvoiceItem` rows
   - For each item with a `productId`: calls `addStockOut(productId, qty)`
   - If customer on credit: calls `adjustCustomerBalance(customerId, balanceDue)`
5. Frontend:
   - Invalidates `["sales"]` and `["inventory"]` React Query caches
   - Shows success toast with invoice number
   - After 1.4 s, opens a fresh bill tab (via `addBill()`)

Items scanned via `BarcodeScanDialog` carry a `productId` field (from the product
lookup response) which is passed through the bill row into the save payload.

---

## 7. Profile & Business Store

Two Zustand stores added:

- **`business.store.ts`** — persists storeName, address, phone, email, upiId, website to localStorage
- **`auth.store.ts`** — gained `updateName()` and `updatePassword()` (bcrypt-verified)

`ProfileDrawer` component slides in from the sidebar's profile strip, with sections
for Account (name, password change) and Business Details. All edits write through
to the stores and reflect in the sidebar name/avatar instantly.

---

## 8. Database Setup

### First-time setup

```bash
cd server

# 1. Copy env
cp .env.example .env
# Edit DATABASE_URL in .env

# 2. Install dependencies
npm install

# 3. Push schema and seed
npm run db:setup
# This runs: prisma db push + seeds default branch + backfills inventory rows

# 4. Generate Prisma client (if not auto-run)
npm run db:generate

# 5. Start dev server
npm run dev
```

### Re-running after schema changes

```bash
# Push latest schema (add --accept-data-loss only for dev)
npm run db:push

# Or use full migration with history
npm run db:migrate
# (prompts for migration name)
```

### Production

```bash
npm run db:migrate:prod   # prisma migrate deploy — runs existing migrations only
```

---

## 9. Invoice Number Format

| Prefix | Module | Example |
|---|---|---|
| `INV` | Sale Invoice | INV0001 |
| `PUR` | Purchase Bill | PUR0001 |
| `PAY` | Payment-In | PAY0001 |
| `ORD` | Sale Order | ORD0001 |
| `CHN` | Delivery Challan | CHN0001 |
| `RET` | Sale Return | RET0001 |
| `PRN` | Purchase Return | PRN0001 |
| `EXP` | Expense | EXP0001 |

Numbers are generated by counting existing rows + 1, zero-padded to 4 digits.

---

## 10. File Map — New / Changed Files

### Backend (server/)
```
server/
  prisma/
    schema.prisma                ← REPLACED — 16 models
  src/
    app.ts                       ← REPLACED — all routes registered
    services/
      db.ts                      ← NEW — singleton Prisma client
      counter.service.ts         ← NEW — invoice number generation
      inventory.service.ts       ← NEW — stock movement logic
      customer.service.ts        ← NEW
      supplier.service.ts        ← NEW
      purchase.service.ts        ← NEW — creates purchase + stockIn
      sale.service.ts            ← NEW — creates sale + stockOut
      payment.service.ts         ← NEW
      expense.service.ts         ← NEW
      product.service.ts         ← UPDATED — isActive field in update
    routes/
      product.routes.ts          ← UPDATED — isActive in PUT schema
      customer.routes.ts         ← NEW
      supplier.routes.ts         ← NEW
      purchase.routes.ts         ← NEW
      sale.routes.ts             ← NEW
      payment.routes.ts          ← NEW
      expense.routes.ts          ← NEW
      inventory.routes.ts        ← NEW
    scripts/
      migrate.ts                 ← NEW — db push + seed + backfill
  package.json                   ← UPDATED — db:setup script added
```

### Frontend (src/)
```
src/
  store/
    business.store.ts            ← NEW — business profile
    auth.store.ts                ← UPDATED — updateName, updatePassword
    index.ts                     ← UPDATED — exports business store
  components/
    profile/
      ProfileDrawer.tsx          ← NEW — slide-in profile editor
  layouts/
    Sidebar.tsx                  ← UPDATED — Utilities section, profile click
  app/
    pos/
      PosPage.tsx                ← UPDATED — Save (F2) calls /api/sales
    products/
      ProductsPage.tsx           ← REPLACED — live data, richer table
      components/
        ProductEditDialog.tsx    ← NEW — full edit dialog
    sales/
      invoices/SaleInvoicesPage.tsx     ← REPLACED — live data
      payment-in/PaymentInPage.tsx      ← REPLACED — live data
      orders/SaleOrderPage.tsx          ← REPLACED — live data
      challan/DeliveryChallanPage.tsx   ← REPLACED — live data
      returns/SaleReturnPage.tsx        ← REPLACED — live data
    purchase/
      all/AllPurchasesPage.tsx          ← REPLACED — live data
      return/PurchaseReturnPage.tsx     ← REPLACED — live data
    customers/CustomersPage.tsx         ← REPLACED — live CRUD
    suppliers/SuppliersPage.tsx         ← REPLACED — live CRUD
    expenses/ExpensesPage.tsx           ← REPLACED — live CRUD
    inventory/InventoryPage.tsx         ← REPLACED — live stock data
  routes/index.tsx               ← UPDATED — utility routes added
```
