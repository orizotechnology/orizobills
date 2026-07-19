// Shared product types — imported by both ProductsPage and ProductEditDialog

export interface Product {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  description: string | null;
  mrp: number;
  salePrice: number;
  purchasePrice: number;
  taxPct: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
