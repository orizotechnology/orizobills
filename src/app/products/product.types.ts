// Shared product types — imported by ProductsPage, ProductEditDialog, EditProductPage

export interface Product {
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
