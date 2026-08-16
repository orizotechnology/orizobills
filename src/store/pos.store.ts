import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ProductRow } from "@/app/pos/components/ProductTable";

export interface Bill {
  id: string;
  invoiceNo: string;
  customer: string;
  rows: ProductRow[];
  paymentMode: "Cash" | "UPI" | "Card" | "Split";
  paidAmount: string;
  discount: number;
  discountType: "%" | "₹";
  createdAt: string;
}

interface PosState {
  bills: Bill[];
  activeBillId: string;

  addBill: () => void;
  resetAfterSave: () => void;
  resetStore: () => void;
  closeBill: (id: string) => void;
  setActiveBill: (id: string) => void;
  getActiveBill: () => Bill | undefined;
  updateBill: (id: string, patch: Partial<Omit<Bill, "id">>) => void;
  addRowToBill: (id: string, row: ProductRow) => void;
  updateRowInBill: (billId: string, rowId: string, field: keyof ProductRow, value: number | string) => void;
  removeRowFromBill: (billId: string, rowId: string) => void;
}

// =============================================================
// Invoice number helpers
// Numbers are LOCAL tab labels only — the real invoice number
// comes from the server after save.
//
// Strategy: always find the lowest positive integer NOT already
// used by an open tab. So if tabs 1, 3, 4 are open, next = 2.
// If 1, 2, 3 are open, next = 4.
// After closing tab 2, the next new tab gets 2 again.
// =============================================================

function parseTabNum(invoiceNo: string): number {
  // invoiceNo format: "#OB0003" → 3
  const match = invoiceNo.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

function nextTabNumber(bills: Bill[]): number {
  const used = new Set(bills.map((b) => parseTabNum(b.invoiceNo)));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function makeInvoiceNo(n: number): string {
  return `#OB${String(n).padStart(4, "0")}`;
}

function makeBill(n: number): Bill {
  return {
    id: nanoid(),
    invoiceNo: makeInvoiceNo(n),
    customer: "",
    rows: [],
    paymentMode: "Cash",
    paidAmount: "",
    discount: 0,
    discountType: "%",
    createdAt: new Date().toISOString(),
  };
}

// ── Store ─────────────────────────────────────────────────────

export const usePosStore = create<PosState>((set, get) => {
  const first = makeBill(1);
  return {
    bills: [first],
    activeBillId: first.id,

    // Open a new tab — gets the lowest available number
    addBill: () => {
      const { bills } = get();
      const bill = makeBill(nextTabNumber(bills));
      set((s) => ({
        bills: [...s.bills, bill],
        activeBillId: bill.id,
      }));
    },

    // After save: remove the saved tab, open a fresh #OB0001
    // (or lowest available if #OB0001 is still open as another tab)
    resetAfterSave: () => {
      const { activeBillId, bills } = get();
      const remaining = bills.filter((b) => b.id !== activeBillId);
      const fresh = makeBill(nextTabNumber(remaining));
      set({
        bills: [...remaining, fresh],
        activeBillId: fresh.id,
      });
    },

    // Called when user confirms closing the POS — wipes ALL bills,
    // starts fresh so next open has no leftover data.
    resetStore: () => {
      const fresh = makeBill(1);
      set({ bills: [fresh], activeBillId: fresh.id });
    },

    // Close a tab — switch to the nearest neighbour
    closeBill: (id) => {
      const { bills, activeBillId } = get();
      if (bills.length === 1) return; // never close the last tab
      const idx = bills.findIndex((b) => b.id === id);
      const next = bills[idx - 1] ?? bills[idx + 1];
      set({
        bills: bills.filter((b) => b.id !== id),
        activeBillId: activeBillId === id ? next.id : activeBillId,
      });
    },

    setActiveBill: (id) => set({ activeBillId: id }),

    getActiveBill: () => {
      const { bills, activeBillId } = get();
      return bills.find((b) => b.id === activeBillId);
    },

    updateBill: (id, patch) => {
      set((s) => ({
        bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },

    addRowToBill: (id, row) => {
      set((s) => ({
        bills: s.bills.map((b) =>
          b.id === id ? { ...b, rows: [...b.rows, row] } : b
        ),
      }));
    },

    updateRowInBill: (billId, rowId, field, value) => {
      set((s) => ({
        bills: s.bills.map((b) => {
          if (b.id !== billId) return b;
          return {
            ...b,
            rows: b.rows.map((r) => {
              if (r.id !== rowId) return r;
              const u = { ...r, [field]: value };
              const discAmt = (u.mrp * u.qty * u.discPct) / 100;
              const taxable = u.price * u.qty - discAmt;
              const taxAmt  = (taxable * u.taxPct) / 100;
              return {
                ...u,
                discAmt: +discAmt.toFixed(2),
                taxAmt:  +taxAmt.toFixed(2),
                total:   +(taxable + taxAmt).toFixed(2),
              };
            }),
          };
        }),
      }));
    },

    removeRowFromBill: (billId, rowId) => {
      set((s) => ({
        bills: s.bills.map((b) =>
          b.id === billId
            ? { ...b, rows: b.rows.filter((r) => r.id !== rowId) }
            : b
        ),
      }));
    },
  };
});
