#!/usr/bin/env tsx
// =============================================================
// MIGRATE + SEED SCRIPT
// Run with:  npx tsx src/scripts/migrate.ts
//
// What it does:
//   1. Runs prisma db push (sync schema to DB without migration history)
//      OR prisma migrate deploy (if you want proper migration files)
//   2. Seeds the DB with a default branch if none exists
//   3. Ensures every existing Product has an InventoryItem row
// =============================================================

import { execSync } from "child_process";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env relative to the server directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runMigration() {
  console.log("\n🔄  Pushing schema to database…");
  try {
    execSync("npx prisma db push --accept-data-loss", {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
    });
    console.log("✅  Schema push complete.\n");
  } catch (e) {
    console.error("❌  Schema push failed:", e);
    process.exit(1);
  }
}

async function seedBranch() {
  const count = await prisma.branch.count();
  if (count > 0) {
    console.log(`ℹ️   Branches already exist (${count}). Skipping branch seed.`);
    return;
  }
  await prisma.branch.create({
    data: {
      name:      "Main Branch",
      slug:      "branch_main_branch",
      address:   null,
      isDefault: true,
      isActive:  true,
    },
  });
  console.log("🌱  Default branch created: Main Branch");
}

async function backfillInventory() {
  const products = await prisma.product.findMany({
    where: {
      isActive:     true,
      inventoryItem: null,
    },
    select: { id: true, name: true },
  });

  if (products.length === 0) {
    console.log("ℹ️   All products already have inventory rows.");
    return;
  }

  for (const p of products) {
    await prisma.inventoryItem.create({
      data: {
        productId:    p.id,
        openingStock: 0,
        stockIn:      0,
        stockOut:     0,
        lowStockAlert: 5,
      },
    });
  }
  console.log(`🌱  Created inventory rows for ${products.length} product(s).`);
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("   Orizo Bills — DB Migration & Seed   ");
  console.log("═══════════════════════════════════════");

  await runMigration();

  console.log("🔗  Connecting to database…");
  await prisma.$connect();

  await seedBranch();
  await backfillInventory();

  console.log("\n✅  All done! Database is ready.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
