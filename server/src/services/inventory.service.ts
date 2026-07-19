import prisma from "./db";

// =============================================================
// INVENTORY SERVICE
// One InventoryItem row per Product.
// stockIn  += qty when a purchase is confirmed
// stockOut += qty when a sale is confirmed
// currentStock = openingStock + stockIn - stockOut
// =============================================================

export interface InventoryResult {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  currentStock: number;
  lowStockAlert: number;
  stockValue: number;   // currentStock * salePrice
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(row: any): InventoryResult {
  const opening = parseFloat(row.openingStock);
  const stockIn  = parseFloat(row.stockIn);
  const stockOut = parseFloat(row.stockOut);
  const current  = opening + stockIn - stockOut;
  const low      = parseFloat(row.lowStockAlert);
  const salePrice = parseFloat(row.product?.salePrice ?? "0");
  return {
    id:            row.id,
    productId:     row.productId,
    productName:   row.product?.name ?? "",
    productCode:   row.product?.code ?? "",
    unit:          row.product?.unit ?? "Nos",
    openingStock:  opening,
    stockIn,
    stockOut,
    currentStock:  current,
    lowStockAlert: low,
    stockValue:    parseFloat((current * salePrice).toFixed(2)),
    status:
      current <= 0 ? "OUT_OF_STOCK"
      : current <= low ? "LOW_STOCK"
      : "IN_STOCK",
  };
}

/** Ensure an inventory row exists for a product (upsert). */
export async function ensureInventoryItem(productId: string): Promise<void> {
  await prisma.inventoryItem.upsert({
    where: { productId },
    create: { productId, openingStock: 0, stockIn: 0, stockOut: 0 },
    update: {},
  });
}

/** Increase stockIn (called on purchase confirmation). */
export async function addStockIn(productId: string, qty: number): Promise<void> {
  await ensureInventoryItem(productId);
  await prisma.inventoryItem.update({
    where: { productId },
    data: { stockIn: { increment: qty } },
  });
}

/** Decrease stockIn (called on purchase return). */
export async function subtractStockIn(productId: string, qty: number): Promise<void> {
  await ensureInventoryItem(productId);
  await prisma.inventoryItem.update({
    where: { productId },
    data: { stockIn: { decrement: qty } },
  });
}

/** Increase stockOut (called on sale confirmation). */
export async function addStockOut(productId: string, qty: number): Promise<void> {
  await ensureInventoryItem(productId);
  await prisma.inventoryItem.update({
    where: { productId },
    data: { stockOut: { increment: qty } },
  });
}

/** Decrease stockOut (called on sale return — stock comes back). */
export async function subtractStockOut(productId: string, qty: number): Promise<void> {
  await ensureInventoryItem(productId);
  await prisma.inventoryItem.update({
    where: { productId },
    data: { stockOut: { decrement: qty } },
  });
}

/** List all inventory items with product info. */
export async function listInventory(): Promise<{
  items: InventoryResult[];
  summary: { total: number; inStock: number; lowStock: number; outOfStock: number; totalValue: number };
}> {
  const rows = await prisma.inventoryItem.findMany({
    include: { product: { select: { name: true, code: true, unit: true, salePrice: true, isActive: true } } },
    orderBy: { product: { name: "asc" } },
  });

  const items = rows
    .filter((r: { product: { isActive: boolean } }) => r.product?.isActive)
    .map(toResult);

  const summary = {
    total:        items.length,
    inStock:      items.filter((i: InventoryResult) => i.status === "IN_STOCK").length,
    lowStock:     items.filter((i: InventoryResult) => i.status === "LOW_STOCK").length,
    outOfStock:   items.filter((i: InventoryResult) => i.status === "OUT_OF_STOCK").length,
    totalValue:   parseFloat(items.reduce((s: number, i: InventoryResult) => s + i.stockValue, 0).toFixed(2)),
  };

  return { items, summary };
}

/** Update opening stock for a product (manual adjustment). */
export async function adjustOpeningStock(productId: string, openingStock: number): Promise<void> {
  await ensureInventoryItem(productId);
  await prisma.inventoryItem.update({
    where: { productId },
    data: { openingStock },
  });
}
