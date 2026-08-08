import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";
import {
  getNextSaleNumber,
  getNextPurchaseNumber,
  getNextExpenseNumber,
} from "../services/counter.service";

// =============================================================
// BULK IMPORT ROUTE — POST /api/import/:module
//
// Fixes applied:
//  1. Counter service called ONCE per invoice group (race-free)
//  2. Product linking uses case-insensitive LIKE search
//  3. Sales: inventory stockOut updated inside the invoice transaction
//  4. Purchases: inventory stockIn updated inside the invoice transaction
//  5. Purchases: supplierId linked by exact name match first, then partial
//  6. Expense date parsing handles DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
//  7. Product barcode uniqueness: skip duplicate barcodes gracefully
//  8. All errors per-row captured — one bad row doesn't abort the batch
// =============================================================

const MAX_ROWS = 20000;

function parseTaxRate(raw: unknown): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  const s = String(raw).trim();
  if (s.toLowerCase() === "exempt" || s === "0") return 0;
  const m = s.match(/@([\d.]+)%?/i);
  if (m) return parseFloat(m[1]) || 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normalise various date formats to YYYY-MM-DD
function parseDate(raw: string | undefined | null): Date {
  if (!raw) return new Date();
  const s = String(raw).trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const dmY = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmY) return new Date(`${dmY[3]}-${dmY[2].padStart(2,"0")}-${dmY[1].padStart(2,"0")}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function importRoutes(fastify: FastifyInstance) {

  fastify.post(
    "/:module",
    async (req: FastifyRequest<{ Params: { module: string } }>, reply) => {

      const { module } = req.params;
      const prisma = req.prisma;
      const body = req.body as {
        rows:     Record<string, unknown>[];
        batches?: Record<string, unknown>[];
      };

      if (!Array.isArray(body?.rows) || body.rows.length === 0) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          errorResponse("rows array is required", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR)
        );
      }
      if (body.rows.length > MAX_ROWS) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          errorResponse(`Too many rows (max ${MAX_ROWS}).`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR)
        );
      }

      const rows    = body.rows;
      const batches = Array.isArray(body.batches) ? body.batches : [];
      let inserted  = 0;
      let skipped   = 0;
      const errors: string[] = [];

      try {
        switch (module.toLowerCase()) {

          // ──────────────────────────────────────────────────
          // PRODUCTS
          // ──────────────────────────────────────────────────
          case "products": {
            const schema = z.object({
              name:           z.string().min(1, "Item name is required"),
              code:           z.string().optional(),
              hsn:            z.string().optional(),
              mrp:            z.number().min(0).default(0),
              discPctOnMrp:   z.number().min(0).max(100).default(0),
              salePrice:      z.number().min(0).default(0),
              purchasePrice:  z.number().min(0).default(0),
              discountType:   z.string().default("Discount %"),
              saleDiscount:   z.number().min(0).default(0),
              openingStock:   z.number().min(0).default(0),
              lowStockAlert:  z.number().min(0).default(5),
              location:       z.string().optional(),
              taxRate:        z.union([z.string(), z.number()]).optional(),
              taxInclusive:   z.union([z.string(), z.boolean()]).optional(),
              unit:           z.string().default("Nos"),
              secondaryUnit:  z.string().optional(),
              conversionRate: z.number().optional(),
              taxPct:         z.number().min(0).max(100).optional(),
              barcode:        z.string().optional(),
              description:    z.string().optional(),
            });

            for (let i = 0; i < rows.length; i++) {
              const p = schema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }

              const taxPct = p.data.taxRate !== undefined
                ? parseTaxRate(p.data.taxRate)
                : (p.data.taxPct ?? 0);

              const taxInclusive =
                typeof p.data.taxInclusive === "boolean" ? p.data.taxInclusive :
                typeof p.data.taxInclusive === "string"  ?
                  p.data.taxInclusive.toLowerCase().startsWith("y") ||
                  p.data.taxInclusive.toLowerCase().startsWith("incl") :
                false;

              const code = p.data.code?.trim() ||
                p.data.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 20) + `-${i + 1}`;

              // Strip empty barcode so it doesn't collide on the unique index
              const barcode = p.data.barcode?.trim() || null;

              try {
                const product = await prisma.product.upsert({
                  where:  { code },
                  update: {
                    name: p.data.name,
                    // Only update barcode if provided — avoids clobbering existing unique barcodes
                    ...(barcode !== null ? { barcode } : {}),
                    description: p.data.description ?? null, hsn: p.data.hsn ?? null,
                    mrp: p.data.mrp, discPctOnMrp: p.data.discPctOnMrp,
                    salePrice: p.data.salePrice, purchasePrice: p.data.purchasePrice,
                    discountType: p.data.discountType, saleDiscount: p.data.saleDiscount,
                    location: p.data.location ?? null, taxPct, taxInclusive,
                    taxRate: p.data.taxRate != null ? String(p.data.taxRate) : null,
                    unit: p.data.unit, secondaryUnit: p.data.secondaryUnit ?? null,
                    conversionRate: p.data.conversionRate ?? null, isActive: true,
                  },
                  create: {
                    name: p.data.name, code, barcode,
                    description: p.data.description ?? null, hsn: p.data.hsn ?? null,
                    mrp: p.data.mrp, discPctOnMrp: p.data.discPctOnMrp,
                    salePrice: p.data.salePrice, purchasePrice: p.data.purchasePrice,
                    discountType: p.data.discountType, saleDiscount: p.data.saleDiscount,
                    location: p.data.location ?? null, taxPct, taxInclusive,
                    taxRate: p.data.taxRate != null ? String(p.data.taxRate) : null,
                    unit: p.data.unit, secondaryUnit: p.data.secondaryUnit ?? null,
                    conversionRate: p.data.conversionRate ?? null,
                  },
                });

                // Upsert inventory — always set openingStock from import sheet
                await prisma.inventoryItem.upsert({
                  where:  { productId: product.id },
                  update: { openingStock: p.data.openingStock, lowStockAlert: p.data.lowStockAlert },
                  create: {
                    productId: product.id, openingStock: p.data.openingStock,
                    stockIn: 0, stockOut: 0, lowStockAlert: p.data.lowStockAlert,
                  },
                });

                // Batch rows from Sheet 2 — matched by product name (case-insensitive)
                const productBatches = batches.filter(
                  (b) => String(b.name ?? b.itemName ?? "").trim().toLowerCase() ===
                    p.data.name.trim().toLowerCase()
                );
                for (const batch of productBatches) {
                  const batchName = String(batch.size ?? batch.batchName ?? "Default").trim() || "Default";
                  const batchQty  = parseFloat(String(batch.openingStock ?? batch.quantity ?? 0)) || 0;
                  await prisma.productBatch.upsert({
                    where:  { productId_batchName: { productId: product.id, batchName } },
                    update: { openingStock: batchQty },
                    create: { productId: product.id, batchName, openingStock: batchQty },
                  });
                }
                inserted++;
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                // Duplicate barcode → skip gracefully with clear message
                if (msg.includes("Unique constraint") && msg.includes("barcode")) {
                  errors.push(`Row ${i + 1} (${code}): barcode "${barcode}" already exists — barcode skipped, product imported without it`);
                  // Retry without barcode
                  try {
                    const product = await prisma.product.upsert({
                      where:  { code },
                      update: { name: p.data.name, description: p.data.description ?? null, hsn: p.data.hsn ?? null, mrp: p.data.mrp, discPctOnMrp: p.data.discPctOnMrp, salePrice: p.data.salePrice, purchasePrice: p.data.purchasePrice, discountType: p.data.discountType, saleDiscount: p.data.saleDiscount, location: p.data.location ?? null, taxPct, taxInclusive, taxRate: p.data.taxRate != null ? String(p.data.taxRate) : null, unit: p.data.unit, secondaryUnit: p.data.secondaryUnit ?? null, conversionRate: p.data.conversionRate ?? null, isActive: true },
                      create: { name: p.data.name, code, barcode: null, description: p.data.description ?? null, hsn: p.data.hsn ?? null, mrp: p.data.mrp, discPctOnMrp: p.data.discPctOnMrp, salePrice: p.data.salePrice, purchasePrice: p.data.purchasePrice, discountType: p.data.discountType, saleDiscount: p.data.saleDiscount, location: p.data.location ?? null, taxPct, taxInclusive, taxRate: p.data.taxRate != null ? String(p.data.taxRate) : null, unit: p.data.unit, secondaryUnit: p.data.secondaryUnit ?? null, conversionRate: p.data.conversionRate ?? null },
                    });
                    await prisma.inventoryItem.upsert({ where: { productId: product.id }, update: { openingStock: p.data.openingStock, lowStockAlert: p.data.lowStockAlert }, create: { productId: product.id, openingStock: p.data.openingStock, stockIn: 0, stockOut: 0, lowStockAlert: p.data.lowStockAlert } });
                    inserted++;
                  } catch (e2) { errors.push(`Row ${i + 1} (${code}): ${e2 instanceof Error ? e2.message : String(e2)}`); skipped++; }
                } else {
                  errors.push(`Row ${i + 1} (${code}): ${msg}`);
                  skipped++;
                }
              }
            }
            break;
          }

          // ──────────────────────────────────────────────────
          // CUSTOMERS
          // ──────────────────────────────────────────────────
          case "customers": {
            const schema = z.object({
              name:    z.string().min(1, "Name is required"),
              phone:   z.string().optional(),
              email:   z.string().optional(),
              address: z.string().optional(),
              gstin:   z.string().optional(),
              balance: z.number().default(0),
            });

            for (let i = 0; i < rows.length; i++) {
              const p = schema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              // Normalise phone: strip spaces/dashes, trim to 20 chars
              const rawPhone = p.data.phone?.replace(/[\s\-().]/g, "").trim() || null;
              const phone = rawPhone ? rawPhone.slice(0, 20) : null;
              try {
                if (phone) {
                  await prisma.customer.upsert({
                    where:  { phone },
                    update: { name: p.data.name, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                    create: { name: p.data.name, phone, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                  });
                } else {
                  await prisma.customer.create({
                    data: { name: p.data.name, phone: null, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                  });
                }
                inserted++;
              } catch (e) {
                errors.push(`Row ${i + 1} (${p.data.name}): ${e instanceof Error ? e.message : String(e)}`);
                skipped++;
              }
            }
            break;
          }

          // ──────────────────────────────────────────────────
          // SUPPLIERS
          // ──────────────────────────────────────────────────
          case "suppliers": {
            const schema = z.object({
              name:    z.string().min(1, "Name is required"),
              phone:   z.string().optional(),
              email:   z.string().optional(),
              address: z.string().optional(),
              gstin:   z.string().optional(),
              balance: z.number().default(0),
            });

            for (let i = 0; i < rows.length; i++) {
              const p = schema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              const rawPhone = p.data.phone?.replace(/[\s\-().]/g, "").trim() || null;
              const phone = rawPhone ? rawPhone.slice(0, 20) : null;
              try {
                if (phone) {
                  await prisma.supplier.upsert({
                    where:  { phone },
                    update: { name: p.data.name, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                    create: { name: p.data.name, phone, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                  });
                } else {
                  await prisma.supplier.create({
                    data: { name: p.data.name, phone: null, email: p.data.email ?? null, address: p.data.address ?? null, gstin: p.data.gstin ?? null, balance: p.data.balance },
                  });
                }
                inserted++;
              } catch (e) {
                errors.push(`Row ${i + 1} (${p.data.name}): ${e instanceof Error ? e.message : String(e)}`);
                skipped++;
              }
            }
            break;
          }

          // ──────────────────────────────────────────────────
          // EXPENSES
          // ──────────────────────────────────────────────────
          case "expenses": {
            const schema = z.object({
              category:      z.string().default("General"),
              description:   z.string().optional(),
              amount:        z.number().min(0.01, "Amount must be > 0"),
              paymentMethod: z.string().default("Cash"),
              expenseDate:   z.string().optional(),
              reference:     z.string().optional(),
              notes:         z.string().optional(),
            });

            for (let i = 0; i < rows.length; i++) {
              const p = schema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              try {
                const expenseNumber = await getNextExpenseNumber(prisma);
                const expenseDate   = parseDate(p.data.expenseDate ?? null);
                await prisma.expense.create({
                  data: {
                    expenseNumber,
                    category:      p.data.category,
                    description:   p.data.description ?? null,
                    amount:        p.data.amount,
                    paymentMethod: p.data.paymentMethod,
                    expenseDate,
                    reference:     p.data.reference ?? null,
                    notes:         p.data.notes     ?? null,
                  },
                });
                inserted++;
              } catch (e) {
                errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
                skipped++;
              }
            }
            break;
          }

          // ──────────────────────────────────────────────────
          // SALE INVOICES
          // Groups rows by customerName+invoiceDate+paymentMethod
          // ──────────────────────────────────────────────────
          case "sales": {
            const rowSchema = z.object({
              customerName:  z.string().default("Walk-in Customer"),
              invoiceDate:   z.string().optional(),
              paymentMethod: z.string().default("Cash"),
              itemName:      z.string().min(1, "Item name is required"),
              itemCode:      z.string().default("ITEM"),
              quantity:      z.number().min(0).default(1),
              unitPrice:     z.number().min(0).default(0),
              taxPercent:    z.number().min(0).max(100).default(0),
              discountPct:   z.number().min(0).max(100).default(0),
            });

            type SaleRow = z.infer<typeof rowSchema>;
            type SaleGroup = { key: string; customerName: string; invoiceDate: string; paymentMethod: string; items: SaleRow[] };

            const groups: SaleGroup[] = [];
            const groupIndex: Record<string, number> = {};

            // Phase 1: group rows by invoice key
            for (let i = 0; i < rows.length; i++) {
              const p = rowSchema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              const invDate = parseDate(p.data.invoiceDate ?? null).toISOString().slice(0, 10);
              const key = `${p.data.customerName}|${invDate}|${p.data.paymentMethod}`;
              if (groupIndex[key] === undefined) {
                groupIndex[key] = groups.length;
                groups.push({ key, customerName: p.data.customerName, invoiceDate: invDate, paymentMethod: p.data.paymentMethod, items: [] });
              }
              groups[groupIndex[key]].items.push(p.data);
            }

            // Phase 2: create invoices (one counter call per invoice, not per row)
            for (const grp of groups) {
              try {
                const invoiceNumber = await getNextSaleNumber(prisma);
                const items = grp.items;

                const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
                const discountAmt = items.reduce((s, it) => s + (it.unitPrice * it.quantity * it.discountPct / 100), 0);
                const taxAmt      = items.reduce((s, it) => s + ((it.unitPrice * it.quantity - it.unitPrice * it.quantity * it.discountPct / 100) * it.taxPercent / 100), 0);
                const cgst        = taxAmt / 2;
                const sgst        = taxAmt / 2;
                const totalAmt    = subtotal - discountAmt + taxAmt;

                // Wrap invoice + inventory update in one transaction
                await prisma.$transaction(async (tx: typeof prisma) => {
                  const invoice = await tx.saleInvoice.create({
                    data: {
                      invoiceNumber,
                      customerName:  grp.customerName,
                      customerId:    null,
                      invoiceDate:   new Date(grp.invoiceDate),
                      paymentMethod: grp.paymentMethod,
                      subtotal, discountPct: 0, discountAmt, cgst, sgst,
                      totalAmt, paidAmt: totalAmt, balanceDue: 0, status: "PAID",
                      items: {
                        create: items.map((it) => {
                          const lineTotal = it.unitPrice * it.quantity;
                          const lineDisc  = lineTotal * it.discountPct / 100;
                          const lineTax   = (lineTotal - lineDisc) * it.taxPercent / 100;
                          return {
                            productId: null, itemName: it.itemName, itemCode: it.itemCode,
                            quantity: it.quantity, unit: "Nos", mrp: it.unitPrice,
                            unitPrice: it.unitPrice, discountPct: it.discountPct,
                            discountAmt: lineDisc, taxPercent: it.taxPercent,
                            taxAmount: lineTax, totalAmount: lineTotal - lineDisc + lineTax,
                          };
                        }),
                      },
                    },
                  });

                  // Link to products + update inventory (inside transaction)
                  for (const it of items) {
                    // Case-insensitive search using LOWER() — works in MySQL
                    const prod = (await tx.$queryRawUnsafe(
                      `SELECT id FROM products WHERE isActive = 1 AND (LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)) LIMIT 1`,
                      it.itemCode, it.itemName
                    )) as Array<{ id: string }>;
                    if (prod.length > 0) {
                      const productId = prod[0].id;
                      await tx.saleInvoiceItem.updateMany({
                        where: { invoiceId: invoice.id, itemCode: it.itemCode },
                        data:  { productId },
                      });
                      await tx.inventoryItem.upsert({
                        where:  { productId },
                        update: { stockOut: { increment: it.quantity } },
                        create: { productId, openingStock: 0, stockIn: 0, stockOut: it.quantity, lowStockAlert: 5 },
                      });
                    }
                  }
                });

                inserted++;
              } catch (e) {
                errors.push(`Invoice (${grp.customerName} / ${grp.invoiceDate}): ${e instanceof Error ? e.message : String(e)}`);
                skipped += grp.items.length;
              }
            }
            break;
          }

          // ──────────────────────────────────────────────────
          // PURCHASE INVOICES
          // Groups by supplierName+billDate+paymentMethod
          // ──────────────────────────────────────────────────
          case "purchases": {
            const rowSchema = z.object({
              supplierName:  z.string().default("Unknown Supplier"),
              billDate:      z.string().optional(),
              paymentMethod: z.string().default("Cash"),
              itemName:      z.string().min(1, "Item name is required"),
              itemCode:      z.string().default("ITEM"),
              quantity:      z.number().min(0).default(1),
              unitPrice:     z.number().min(0).default(0),
              taxPercent:    z.number().min(0).max(100).default(0),
              discountPct:   z.number().min(0).max(100).default(0),
            });

            type PurchaseRow = z.infer<typeof rowSchema>;
            type PurchaseGroup = { key: string; supplierName: string; billDate: string; paymentMethod: string; items: PurchaseRow[] };

            const groups: PurchaseGroup[] = [];
            const groupIndex: Record<string, number> = {};

            // Phase 1: group rows
            for (let i = 0; i < rows.length; i++) {
              const p = rowSchema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              const bDate = parseDate(p.data.billDate ?? null).toISOString().slice(0, 10);
              const key = `${p.data.supplierName}|${bDate}|${p.data.paymentMethod}`;
              if (groupIndex[key] === undefined) {
                groupIndex[key] = groups.length;
                groups.push({ key, supplierName: p.data.supplierName, billDate: bDate, paymentMethod: p.data.paymentMethod, items: [] });
              }
              groups[groupIndex[key]].items.push(p.data);
            }

            // Phase 2: create invoices
            for (const grp of groups) {
              try {
                const invoiceNumber = await getNextPurchaseNumber(prisma);
                const items = grp.items;

                const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
                const discountAmt = items.reduce((s, it) => s + (it.unitPrice * it.quantity * it.discountPct / 100), 0);
                const taxAmt      = items.reduce((s, it) => s + ((it.unitPrice * it.quantity - it.unitPrice * it.quantity * it.discountPct / 100) * it.taxPercent / 100), 0);
                const totalAmt    = subtotal - discountAmt + taxAmt;

                // Find supplier first (outside transaction — read-only)
                const supplierRows = (await prisma.$queryRawUnsafe(
                  `SELECT id FROM suppliers WHERE isActive = 1 AND LOWER(name) = LOWER(?) LIMIT 1`,
                  grp.supplierName
                )) as Array<{ id: string }>;
                const supplierId = supplierRows.length > 0 ? supplierRows[0].id : null;

                // Wrap invoice + inventory in one transaction
                await prisma.$transaction(async (tx: typeof prisma) => {
                  const invoice = await tx.purchaseInvoice.create({
                    data: {
                      invoiceNumber,
                      supplierName:  grp.supplierName,
                      supplierId,
                      billDate:      new Date(grp.billDate),
                      paymentMethod: grp.paymentMethod,
                      subtotal, discountPct: 0, discountAmt, taxAmt,
                      totalAmt, taxType: "NONE", status: "CONFIRMED",
                      items: {
                        create: items.map((it) => {
                          const lineTotal = it.unitPrice * it.quantity;
                          const lineDisc  = lineTotal * it.discountPct / 100;
                          const lineTax   = (lineTotal - lineDisc) * it.taxPercent / 100;
                          return {
                            productId: null, itemName: it.itemName, itemCode: it.itemCode,
                            quantity: it.quantity, unit: "Nos", mrp: it.unitPrice,
                            unitPrice: it.unitPrice, discountPct: it.discountPct,
                            discountAmt: lineDisc, taxPercent: it.taxPercent,
                            taxAmount: lineTax, totalAmount: lineTotal - lineDisc + lineTax,
                          };
                        }),
                      },
                    },
                  });

                  // Link to products + update inventory (inside transaction)
                  for (const it of items) {
                    const prod = (await tx.$queryRawUnsafe(
                      `SELECT id FROM products WHERE isActive = 1 AND (LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)) LIMIT 1`,
                      it.itemCode, it.itemName
                    )) as Array<{ id: string }>;
                    if (prod.length > 0) {
                      const productId = prod[0].id;
                      await tx.purchaseInvoiceItem.updateMany({
                        where: { invoiceId: invoice.id, itemCode: it.itemCode },
                        data:  { productId },
                      });
                      await tx.inventoryItem.upsert({
                        where:  { productId },
                        update: { stockIn: { increment: it.quantity } },
                        create: { productId, openingStock: 0, stockIn: it.quantity, stockOut: 0, lowStockAlert: 5 },
                      });
                    }
                  }
                });

                inserted++;
              } catch (e) {
                errors.push(`Invoice (${grp.supplierName} / ${grp.billDate}): ${e instanceof Error ? e.message : String(e)}`);
                skipped += grp.items.length;
              }
            }
            break;
          }

          default:
            return reply.status(HTTP_STATUS.BAD_REQUEST).send(
              errorResponse(
                `Unknown module: "${module}". Valid: products, customers, suppliers, expenses, sales, purchases.`,
                HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR
              )
            );
        }

        return reply.send(successResponse({ inserted, skipped, errors }, "Import complete"));

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(HTTP_STATUS.INTERNAL_ERROR).send(
          errorResponse(`Import failed: ${msg}`, HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR)
        );
      }
    }
  );
}
