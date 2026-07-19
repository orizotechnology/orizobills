// eslint-disable-next-line @typescript-eslint/no-require-imports
import prisma from "./db";

// =============================================================
// PRODUCT SERVICE
// =============================================================

export interface ProductResult {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  description: string | null;
  hsn: string | null;
  mrp: number;
  discPctOnMrp: number;
  salePrice: number;
  purchasePrice: number;
  discountType: string;
  saleDiscount: number;
  taxPct: number;
  taxRate: string | null;
  taxInclusive: boolean;
  unit: string;
  secondaryUnit: string | null;
  conversionRate: number | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function toResult(p: Record<string, unknown>): ProductResult {
  return {
    id:             String(p.id),
    name:           String(p.name),
    code:           String(p.code),
    barcode:        p.barcode        ? String(p.barcode)        : null,
    description:    p.description   ? String(p.description)    : null,
    hsn:            p.hsn            ? String(p.hsn)            : null,
    mrp:            parseFloat(String(p.mrp)),
    discPctOnMrp:   parseFloat(String(p.discPctOnMrp   ?? 0)),
    salePrice:      parseFloat(String(p.salePrice)),
    purchasePrice:  parseFloat(String(p.purchasePrice  ?? 0)),
    discountType:   String(p.discountType ?? "Discount %"),
    saleDiscount:   parseFloat(String(p.saleDiscount   ?? 0)),
    taxPct:         parseFloat(String(p.taxPct)),
    taxRate:        p.taxRate        ? String(p.taxRate)        : null,
    taxInclusive:   Boolean(p.taxInclusive),
    unit:           String(p.unit),
    secondaryUnit:  p.secondaryUnit  ? String(p.secondaryUnit)  : null,
    conversionRate: p.conversionRate != null ? parseFloat(String(p.conversionRate)) : null,
    location:       p.location       ? String(p.location)       : null,
    isActive:       Boolean(p.isActive),
    createdAt:      p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
    updatedAt:      p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt ?? ""),
  };
}

/**
 * Look up a product by barcode OR product code.
 * Used by the POS barcode scanner.
 */
export async function findByBarcode(query: string): Promise<ProductResult | null> {
  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [
        { barcode: query.trim() },
        { code: query.trim() },
      ],
    },
  });
  return product ? toResult(product) : null;
}

export async function searchProducts(query: string, limit = 10): Promise<ProductResult[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name:    { contains: query } },
        { code:    { contains: query } },
        { barcode: { contains: query } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
  });
  return products.map(toResult);
}

/**
 * List all products (paginated), with optional active filter.
 */
export async function listProducts(
  page = 1,
  pageSize = 20,
  filter: "all" | "active" | "inactive" = "active"
): Promise<{ data: ProductResult[]; total: number }> {
  const where =
    filter === "all"      ? {}                  :
    filter === "inactive" ? { isActive: false } :
                            { isActive: true };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.product.count({ where }),
  ]);
  return { data: data.map(toResult), total };
}

/**
 * Create a new product.
 */
export async function createProduct(data: {
  name: string;
  code: string;
  barcode?: string;
  description?: string;
  hsn?: string;
  mrp: number;
  discPctOnMrp?: number;
  salePrice: number;
  purchasePrice?: number;
  discountType?: string;
  saleDiscount?: number;
  taxPct?: number;
  taxRate?: string;
  taxInclusive?: boolean;
  unit?: string;
  secondaryUnit?: string;
  conversionRate?: number;
  location?: string;
}): Promise<ProductResult> {
  const product = await prisma.product.create({ data });
  return toResult(product);
}

/**
 * Update a product by ID.
 */
export async function updateProduct(id: string, data: Partial<{
  name: string;
  code: string;
  barcode: string;
  description: string;
  hsn: string;
  mrp: number;
  discPctOnMrp: number;
  salePrice: number;
  purchasePrice: number;
  discountType: string;
  saleDiscount: number;
  taxPct: number;
  taxRate: string;
  taxInclusive: boolean;
  unit: string;
  secondaryUnit: string;
  conversionRate: number;
  location: string;
  isActive: boolean;
}>): Promise<ProductResult> {
  const product = await prisma.product.update({ where: { id }, data });
  return toResult(product);
}

/**
 * Soft delete a product by ID.
 */
export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.update({ where: { id }, data: { isActive: false } });
}
