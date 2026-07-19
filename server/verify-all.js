// Full API verification against MySQL backend
const http = require("http");

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost", port: 5000, path, method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function pass(label) { console.log(`  ✅ ${label}`); }
function fail(label, msg) { console.log(`  ❌ ${label}: ${msg}`); }
function section(title) { console.log(`\n── ${title} ─────────────────────────`); }

async function run() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   ORIZO BILLS — Full API Verification  ║");
  console.log("╚════════════════════════════════════════╝");

  // HEALTH
  section("Health");
  const h = await req("GET", "/api/health");
  h.body?.status === "ok" ? pass("GET /api/health → ok") : fail("health", JSON.stringify(h.body));

  // BRANCHES
  section("Branches");
  const branches = await req("GET", "/api/branches");
  branches.body?.success ? pass(`GET /api/branches → ${branches.body.data.length} branch(es)`) : fail("list branches", branches.body?.error?.message);

  // Create a product
  section("Products");
  const prod = await req("POST", "/api/products", {
    name: "Test Widget", code: "TW-001", mrp: 100, salePrice: 90, purchasePrice: 70,
    taxPct: 18, taxRate: "GST@18%", unit: "Pcs", location: "Store A", hsn: "8471",
  });
  prod.body?.success ? pass(`POST /api/products → id:${prod.body.data.id.slice(0,8)}`) : fail("create product", prod.body?.error?.message);
  const productId = prod.body?.data?.id;

  const list = await req("GET", "/api/products?filter=all");
  list.body?.success ? pass(`GET /api/products → total:${list.body.data.total}`) : fail("list products", list.body?.error?.message);

  const barcode = await req("GET", "/api/products/barcode/TW-001");
  barcode.body?.success ? pass("GET /api/products/barcode/:code") : fail("barcode lookup", barcode.body?.error?.message);

  // Import products
  const imp = await req("POST", "/api/import/products", {
    rows: [
      { name: "Import A", code: "IMP-A", mrp: 50, salePrice: 45, purchasePrice: 30, openingStock: 100, lowStockAlert: 10, taxRate: "GST@12%", unit: "Box" },
      { name: "Import B", code: "IMP-B", mrp: 80, salePrice: 75, purchasePrice: 60, openingStock: 50,  lowStockAlert: 5,  taxRate: "Exempt",  unit: "Nos" },
    ],
    batches: [
      { name: "Import A", size: "S", openingStock: 60 },
      { name: "Import A", size: "L", openingStock: 40 },
    ],
  });
  imp.body?.data?.inserted === 2 ? pass(`POST /api/import/products → inserted:${imp.body.data.inserted}`) : fail("import products", JSON.stringify(imp.body?.data));

  // Customer
  section("Customers");
  const cust = await req("POST", "/api/customers", { name: "Raj Kumar", phone: "9990001111", email: "raj@test.com", gstin: "27AABCU9603R1ZX", balance: 500 });
  cust.body?.success ? pass(`POST /api/customers → id:${cust.body.data.id.slice(0,8)}`) : fail("create customer", cust.body?.error?.message);
  const custId = cust.body?.data?.id;

  const custList = await req("GET", "/api/customers");
  custList.body?.success ? pass(`GET /api/customers → ${custList.body.data.length} customer(s)`) : fail("list customers", custList.body?.error?.message);

  // Supplier
  section("Suppliers");
  const supp = await req("POST", "/api/suppliers", { name: "ABC Traders", phone: "8880001111", gstin: "07AAACG7107R1ZJ", balance: 2000 });
  supp.body?.success ? pass(`POST /api/suppliers → id:${supp.body.data.id.slice(0,8)}`) : fail("create supplier", supp.body?.error?.message);
  const suppId = supp.body?.data?.id;

  // Purchase
  section("Purchases");
  const purNum = await req("GET", "/api/purchases/next-number");
  purNum.body?.success ? pass(`GET /api/purchases/next-number → ${purNum.body.data.number}`) : fail("next purchase number", purNum.body?.error?.message);

  const purchase = await req("POST", "/api/purchases", {
    supplierName: "ABC Traders", supplierId: suppId,
    billDate: "2026-07-18", paymentMethod: "Cash", discountPct: 0, taxType: "GST",
    items: [{ itemName: "Test Widget", itemCode: "TW-001", productId, quantity: 10, unit: "Pcs", mrp: 100, unitPrice: 70, discountPct: 0, discountAmt: 0, taxPercent: 18, taxAmount: 126, totalAmount: 826 }],
  });
  purchase.body?.success ? pass(`POST /api/purchases → ${purchase.body.data.invoiceNumber}`) : fail("create purchase", purchase.body?.error?.message ?? JSON.stringify(purchase.body));

  // Sale
  section("Sales");
  const saleNum = await req("GET", "/api/sales/next-number");
  saleNum.body?.success ? pass(`GET /api/sales/next-number → ${saleNum.body.data.number}`) : fail("next sale number", saleNum.body?.error?.message);

  const sale = await req("POST", "/api/sales", {
    customerName: "Raj Kumar", customerId: custId,
    invoiceDate: "2026-07-18", paymentMethod: "Cash", discountPct: 0, paidAmt: 106.2,
    items: [{ itemName: "Test Widget", itemCode: "TW-001", productId, quantity: 1, unit: "Pcs", mrp: 100, unitPrice: 90, discountPct: 0, discountAmt: 0, taxPercent: 18, taxAmount: 16.2, totalAmount: 106.2 }],
  });
  sale.body?.success ? pass(`POST /api/sales → ${sale.body.data.invoiceNumber}`) : fail("create sale", sale.body?.error?.message ?? JSON.stringify(sale.body));
  const invoiceId = sale.body?.data?.id;

  // Payment
  section("Payments");
  const payment = await req("POST", "/api/payments", {
    customerName: "Raj Kumar", customerId: custId, invoiceId,
    amount: 50, paymentMethod: "UPI", paymentDate: "2026-07-18",
  });
  payment.body?.success ? pass(`POST /api/payments → ${payment.body.data.paymentNumber}`) : fail("create payment", payment.body?.error?.message);

  // Expense
  section("Expenses");
  const exp = await req("POST", "/api/expenses", { category: "Rent", amount: 15000, paymentMethod: "Bank Transfer", expenseDate: "2026-07-01" });
  exp.body?.success ? pass(`POST /api/expenses → ${exp.body.data.expenseNumber}`) : fail("create expense", exp.body?.error?.message);

  // Inventory
  section("Inventory");
  const inv = await req("GET", "/api/inventory");
  inv.body?.success ? pass(`GET /api/inventory → ${inv.body.data.summary.total} item(s), value:₹${inv.body.data.summary.totalValue}`) : fail("get inventory", inv.body?.error?.message);

  // Sales sub-routes
  section("Sales sub-routes");
  const orders = await req("GET", "/api/sales/orders");
  orders.body?.success ? pass("GET /api/sales/orders") : fail("list orders", orders.body?.error?.message);
  const challans = await req("GET", "/api/sales/challans");
  challans.body?.success ? pass("GET /api/sales/challans") : fail("list challans", challans.body?.error?.message);
  const saleReturns = await req("GET", "/api/sales/returns");
  saleReturns.body?.success ? pass("GET /api/sales/returns") : fail("list sale returns", saleReturns.body?.error?.message);

  // Purchase sub-routes
  const purReturns = await req("GET", "/api/purchases/returns");
  purReturns.body?.success ? pass("GET /api/purchases/returns") : fail("list purchase returns", purReturns.body?.error?.message);

  // Import customers & expenses
  section("Import (other modules)");
  const impCust = await req("POST", "/api/import/customers", { rows: [{ name: "Import Cust", phone: "7770001234", balance: 100 }] });
  impCust.body?.data?.inserted === 1 ? pass("POST /api/import/customers") : fail("import customers", JSON.stringify(impCust.body?.data));

  const impExp = await req("POST", "/api/import/expenses", { rows: [{ category: "Utilities", amount: 3500, paymentMethod: "Cash", expenseDate: "2026-07-05" }] });
  impExp.body?.data?.inserted === 1 ? pass("POST /api/import/expenses") : fail("import expenses", JSON.stringify(impExp.body?.data));

  console.log("\n════════════════════════════════════════\n");
}

run().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
