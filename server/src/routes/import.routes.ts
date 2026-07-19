import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { successResponse, errorResponse } from "../utils/response.util";
import { HTTP_STATUS, ERROR_CODES } from "../constants/http.constants";

// =============================================================
// BULK IMPORT ROUTE — POST /api/import/:module
//
// Accepts parsed rows from the frontend (Excel/CSV already read
// client-side), validates with Zod, inserts into MySQL via
// Prisma. Supports: products, customers, suppliers, expenses,
// sales, purchases.
//
// Returns { inserted, skipped, errors[] }.
// =============================================================

const MAX_ROWS = 5000;

// ── Tax rate string → number ──────────────────────────────────
// "GST@18%" → 18   "IGST@5%" → 5   "Exempt" → 0   "12" → 12
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

// ── Zero-pad invoice numbers ──────────────────────────────────
function pad(prefix: string, n: number) {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export async function importRoutes(fastify: FastifyInstance) {

  fastify.post(
    "/:module",
    async (req: FastifyRequest<{ Params: { module: string } }>, reply) => {

      const { module } = req.params;
      const prisma     = req.prisma; // branch-aware Prisma client
      const body       = req.body as {
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
          errorResponse(
            `Too many rows (max ${MAX_ROWS}). Split the file into smaller batches.`,
            HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR
          )
        );
      }

      const rows    = body.rows;
      const batches = Array.isArray(body.batches) ? body.batches : [];
      let inserted  = 0;
      let skipped   = 0;
      const errors: string[] = [];

      try {
        switch (module.toLowerCase()) {

          // ══════════════════════════════════════════════════
          // PRODUCTS
          // MySQL query (via Prisma):
          //   INSERT INTO products (...) VALUES (...)
          //   ON DUPLICATE KEY UPDATE name=VALUES(name), ...
          //   INSERT INTO inventory_items (...) VALUES (...)
          //   ON DUPLICATE KEY UPDATE openingStock=VALUES(openingStock)
          // ══════════════════════════════════════════════════
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
              taxInclusive:   z.string().optional(),
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
              const taxInclusive = typeof p.data.taxInclusive === "string"
                ? p.data.taxInclusive.toLowerCase().startsWith("incl")
                : false;
              const code = p.data.code?.trim() ||
                p.data.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 20) + `-${i + 1}`;

              try {
                // INSERT INTO products ... ON DUPLICATE KEY UPDATE
                const product = await prisma.product.upsert({
                  where:  { code },
                  update: {
                    name: p.data.name, barcode: p.data.barcode ?? null,
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
                    name: p.data.name, code, barcode: p.data.barcode ?? null,
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

                // INSERT INTO inventory_items ... ON DUPLICATE KEY UPDATE
                await prisma.inventoryItem.upsert({
                  where:  { productId: product.id },
                  update: { openingStock: p.data.openingStock, lowStockAlert: p.data.lowStockAlert },
                  create: {
                    productId: product.id, openingStock: p.data.openingStock,
                    stockIn: 0, stockOut: 0, lowStockAlert: p.data.lowStockAlert,
                  },
                });

                // INSERT INTO product_batches ... for Sheet 2 batch rows
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
                errors.push(`Row ${i + 1} (${code}): ${msg}`);
                skipped++;
              }
            }
            break;
          }

          // ══════════════════════════════════════════════════
          // CUSTOMERS
          // MySQL query (via Prisma):
          //   INSERT INTO customers (id,name,phone,email,address,gstin,balance)
          //   VALUES (uuid(), ?, ?, ?, ?, ?, ?)
          //   ON DUPLICATE KEY UPDATE name=VALUES(name), ...
          // ══════════════════════════════════════════════════
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
              const phone = p.data.phone?.trim() || null;
              try {
                if (phone) {
                  await prisma.customer.upsert({
                    where:  { phone },
                    update: {
                      name: p.data.name, email: p.data.email ?? null,
                      address: p.data.address ?? null, gstin: p.data.gstin ?? null,
                      balance: p.data.balance,
                    },
                    create: {
                      name: p.data.name, phone,
                      email: p.data.email ?? null, address: p.data.address ?? null,
                      gstin: p.data.gstin ?? null, balance: p.data.balance,
                    },
                  });
                } else {
                  await prisma.customer.create({
                    data: {
                      name: p.data.name, phone: null,
                      email: p.data.email ?? null, address: p.data.address ?? null,
                      gstin: p.data.gstin ?? null, balance: p.data.balance,
                    },
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

          // ══════════════════════════════════════════════════
          // SUPPLIERS
          // MySQL query (via Prisma):
          //   INSERT INTO suppliers (...) VALUES (...)
          //   ON DUPLICATE KEY UPDATE ...
          // ══════════════════════════════════════════════════
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
              const phone = p.data.phone?.trim() || null;
              try {
                if (phone) {
                  await prisma.supplier.upsert({
                    where:  { phone },
                    update: {
                      name: p.data.name, email: p.data.email ?? null,
                      address: p.data.address ?? null, gstin: p.data.gstin ?? null,
                      balance: p.data.balance,
                    },
                    create: {
                      name: p.data.name, phone,
                      email: p.data.email ?? null, address: p.data.address ?? null,
                      gstin: p.data.gstin ?? null, balance: p.data.balance,
                    },
                  });
                } else {
                  await prisma.supplier.create({
                    data: {
                      name: p.data.name, phone: null,
                      email: p.data.email ?? null, address: p.data.address ?? null,
                      gstin: p.data.gstin ?? null, balance: p.data.balance,
                    },
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

          // ══════════════════════════════════════════════════
          // EXPENSES
          // MySQL query (via Prisma):
          //   INSERT INTO expenses
          //     (id, expenseNumber, category, description, amount,
          //      paymentMethod, expenseDate, reference, notes)
          //   VALUES (uuid(), ?, ?, ?, ?, ?, ?, ?, ?)
          // ══════════════════════════════════════════════════
          case "expenses": {
            const schema = z.object({
              category:      z.string().default("General"),
              description:   z.string().optional(),
              amount:        z.number().min(0.01, "Amount must be > 0"),
              paymentMethod: z.string().default("Cash"),
              expenseDate:   z.string().default(() => new Date().toISOString().slice(0, 10)),
              reference:     z.string().optional(),
              notes:         z.string().optional(),
            });

            let expCount = await prisma.expense.count();

            for (let i = 0; i < rows.length; i++) {
              const p = schema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              try {
                expCount++;
                const expenseNumber = pad("EXP", expCount);
                let expenseDate: Date;
                try {
                  expenseDate = new Date(p.data.expenseDate);
                  if (isNaN(expenseDate.getTime())) expenseDate = new Date();
                } catch { expenseDate = new Date(); }

                await prisma.expense.create({
                  data: {
                    expenseNumber, category: p.data.category,
                    description: p.data.description ?? null, amount: p.data.amount,
                    paymentMethod: p.data.paymentMethod, expenseDate,
                    reference: p.data.reference ?? null, notes: p.data.notes ?? null,
                  },
                });
                inserted++;
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes("expenseNumber")) expCount--;
                errors.push(`Row ${i + 1}: ${msg}`);
                skipped++;
              }
            }
            break;
          }

          // ══════════════════════════════════════════════════
          // SALE INVOICES
          // Groups rows by customerName+invoiceDate → one invoice
          // per group, multiple items per invoice.
          //
          // MySQL queries (via Prisma):
          //   INSERT INTO sale_invoices (...) VALUES (...)
          //   INSERT INTO sale_invoice_items (...) VALUES (...)
          //   INSERT INTO inventory_items (...) ON DUPLICATE KEY
          //     UPDATE stockOut = stockOut + VALUES(stockOut)
          // ══════════════════════════════════════════════════
          case "sales": {
            const rowSchema = z.object({
              customerName:  z.string().default("Walk-in Customer"),
              invoiceDate:   z.string().default(() => new Date().toISOString().slice(0, 10)),
              paymentMethod: z.string().default("Cash"),
              itemName:      z.string().min(1, "Item name is required"),
              itemCode:      z.string().default("ITEM"),
              quantity:      z.number().min(0).default(1),
              unitPrice:     z.number().min(0).default(0),
              taxPercent:    z.number().min(0).max(100).default(0),
              discountPct:   z.number().min(0).max(100).default(0),
            });

            // Group rows into invoices by customerName + invoiceDate
            type SaleRow = z.infer<typeof rowSchema>;
            type SaleGroup = { key: string; customerName: string; invoiceDate: string; paymentMethod: string; items: SaleRow[] };
            const groups: SaleGroup[] = [];
            const groupIndex: Record<string, number> = {};

            for (let i = 0; i < rows.length; i++) {
              const p = rowSchema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              const key = `${p.data.customerName}|${p.data.invoiceDate}`;
              if (groupIndex[key] === undefined) {
                groupIndex[key] = groups.length;
                groups.push({ key, customerName: p.data.customerName, invoiceDate: p.data.invoiceDate, paymentMethod: p.data.paymentMethod, items: [] });
              }
              groups[groupIndex[key]].items.push(p.data);
            }

            let saleCount = await prisma.saleInvoice.count();

            for (const grp of groups) {
              try {
                saleCount++;
                const invoiceNumber = pad("INV", saleCount);
                const items = grp.items;

                // Calculate totals
                const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
                const discountAmt = items.reduce((s, it) => s + (it.unitPrice * it.quantity * it.discountPct / 100), 0);
                const taxAmt      = items.reduce((s, it) => s + ((it.unitPrice * it.quantity - it.unitPrice * it.quantity * it.discountPct / 100) * it.taxPercent / 100), 0);
                const cgst        = taxAmt / 2;
                const sgst        = taxAmt / 2;
                const totalAmt    = subtotal - discountAmt + taxAmt;

                // INSERT INTO sale_invoices
                const invoice = await prisma.saleInvoice.create({
                  data: {
                    invoiceNumber,
                    customerName:  grp.customerName,
                    customerId:    null,
                    invoiceDate:   new Date(grp.invoiceDate),
                    paymentMethod: grp.paymentMethod,
                    subtotal, discountPct: 0, discountAmt, cgst, sgst,
                    totalAmt, paidAmt: totalAmt, balanceDue: 0, status: "PAID",
                    // INSERT INTO sale_invoice_items
                    items: {
                      create: items.map((it) => {
                        const lineTotal = it.unitPrice * it.quantity;
                        const lineDisc  = lineTotal * it.discountPct / 100;
                        const lineTax   = (lineTotal - lineDisc) * it.taxPercent / 100;
                        return {
                          productId:   null,
                          itemName:    it.itemName,
                          itemCode:    it.itemCode,
                          quantity:    it.quantity,
                          unit:        "Nos",
                          mrp:         it.unitPrice,
                          unitPrice:   it.unitPrice,
                          discountPct: it.discountPct,
                          discountAmt: lineDisc,
                          taxPercent:  it.taxPercent,
                          taxAmount:   lineTax,
                          totalAmount: lineTotal - lineDisc + lineTax,
                        };
                      }),
                    },
                  },
                });
                inserted++;

                // Try to link items to products and update inventory
                for (const it of items) {
                  const prod = await prisma.product.findFirst({
                    where: { OR: [{ code: it.itemCode }, { name: it.itemName }], isActive: true },
                  });
                  if (prod) {
                    // UPDATE sale_invoice_items SET productId=? WHERE itemCode=? AND invoiceId=?
                    await prisma.saleInvoiceItem.updateMany({
                      where: { invoiceId: invoice.id, itemCode: it.itemCode },
                      data:  { productId: prod.id },
                    });
                    // INSERT INTO inventory_items ON DUPLICATE KEY UPDATE stockOut=stockOut+qty
                    await prisma.inventoryItem.upsert({
                      where:  { productId: prod.id },
                      update: { stockOut: { increment: it.quantity } },
                      create: { productId: prod.id, openingStock: 0, stockIn: 0, stockOut: it.quantity, lowStockAlert: 5 },
                    });
                  }
                }
              } catch (e) {
                saleCount--;
                errors.push(`Invoice (${grp.customerName} / ${grp.invoiceDate}): ${e instanceof Error ? e.message : String(e)}`);
                skipped += grp.items.length;
              }
            }
            break;
          }

          // ══════════════════════════════════════════════════
          // PURCHASE INVOICES
          // Groups rows by supplierName+billDate → one invoice
          // per group, multiple items per invoice.
          //
          // MySQL queries (via Prisma):
          //   INSERT INTO purchase_invoices (...) VALUES (...)
          //   INSERT INTO purchase_invoice_items (...) VALUES (...)
          //   INSERT INTO inventory_items (...) ON DUPLICATE KEY
          //     UPDATE stockIn = stockIn + VALUES(stockIn)
          // ══════════════════════════════════════════════════
          case "purchases": {
            const rowSchema = z.object({
              supplierName:  z.string().default("Unknown Supplier"),
              billDate:      z.string().default(() => new Date().toISOString().slice(0, 10)),
              paymentMethod: z.string().default("Cash"),
              itemName:      z.string().min(1, "Item name is required"),
              itemCode:      z.string().default("ITEM"),
              quantity:      z.number().min(0).default(1),
              unitPrice:     z.number().min(0).default(0),
              taxPercent:    z.number().min(0).max(100).default(0),
              discountPct:   z.number().min(0).max(100).default(0),
            });

            type PurchaseRow = z.infer<typeof rowSchema>;
            type PurchaseGroup = {
              key: string; supplierName: string; billDate: string;
              paymentMethod: string; items: PurchaseRow[];
            };
            const groups: PurchaseGroup[] = [];
            const groupIndex: Record<string, number> = {};

            for (let i = 0; i < rows.length; i++) {
              const p = rowSchema.safeParse(rows[i]);
              if (!p.success) {
                errors.push(`Row ${i + 1}: ${p.error.errors[0]?.message ?? "invalid"}`);
                skipped++; continue;
              }
              const key = `${p.data.supplierName}|${p.data.billDate}`;
              if (groupIndex[key] === undefined) {
                groupIndex[key] = groups.length;
                groups.push({
                  key, supplierName: p.data.supplierName,
                  billDate: p.data.billDate, paymentMethod: p.data.paymentMethod, items: [],
                });
              }
              groups[groupIndex[key]].items.push(p.data);
            }

            let purchaseCount = await prisma.purchaseInvoice.count();

            for (const grp of groups) {
              try {
                purchaseCount++;
                const invoiceNumber = pad("PUR", purchaseCount);
                const items = grp.items;

                // Calculate totals
                const subtotal    = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
                const discountAmt = items.reduce((s, it) => s + (it.unitPrice * it.quantity * it.discountPct / 100), 0);
                const taxAmt      = items.reduce((s, it) => s + ((it.unitPrice * it.quantity - it.unitPrice * it.quantity * it.discountPct / 100) * it.taxPercent / 100), 0);
                const totalAmt    = subtotal - discountAmt + taxAmt;

                // INSERT INTO purchase_invoices + purchase_invoice_items
                const invoice = await prisma.purchaseInvoice.create({
                  data: {
                    invoiceNumber,
                    supplierName:  grp.supplierName,
                    supplierId:    null,
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
                          productId:   null,
                          itemName:    it.itemName,
                          itemCode:    it.itemCode,
                          quantity:    it.quantity,
                          unit:        "Nos",
                          mrp:         it.unitPrice,
                          unitPrice:   it.unitPrice,
                          discountPct: it.discountPct,
                          discountAmt: lineDisc,
                          taxPercent:  it.taxPercent,
                          taxAmount:   lineTax,
                          totalAmount: lineTotal - lineDisc + lineTax,
                        };
                      }),
                    },
                  },
                });
                inserted++;

                // Link to products and update inventory stockIn
                for (const it of items) {
                  const prod = await prisma.product.findFirst({
                    where: { OR: [{ code: it.itemCode }, { name: it.itemName }], isActive: true },
                  });
                  if (prod) {
                    // UPDATE purchase_invoice_items SET productId=? WHERE itemCode=? AND invoiceId=?
                    await prisma.purchaseInvoiceItem.updateMany({
                      where: { invoiceId: invoice.id, itemCode: it.itemCode },
                      data:  { productId: prod.id },
                    });
                    // INSERT INTO inventory_items ON DUPLICATE KEY UPDATE stockIn=stockIn+qty
                    await prisma.inventoryItem.upsert({
                      where:  { productId: prod.id },
                      update: { stockIn: { increment: it.quantity } },
                      create: { productId: prod.id, openingStock: 0, stockIn: it.quantity, stockOut: 0, lowStockAlert: 5 },
                    });
                  }
                }

                // Try to link invoice to supplier record
                const supplier = await prisma.supplier.findFirst({
                  where: { name: { contains: grp.supplierName }, isActive: true },
                });
                if (supplier) {
                  await prisma.purchaseInvoice.update({
                    where: { id: invoice.id },
                    data:  { supplierId: supplier.id },
                  });
                }
              } catch (e) {
                purchaseCount--;
                errors.push(`Invoice (${grp.supplierName} / ${grp.billDate}): ${e instanceof Error ? e.message : String(e)}`);
                skipped += grp.items.length;
              }
            }
            break;
          }

          // ══════════════════════════════════════════════════
          // UNKNOWN MODULE
          // ══════════════════════════════════════════════════
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
