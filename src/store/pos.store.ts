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
  createdAt: string;
}

interface PosState {
  bills: Bill[];
  activeBillId: string;
  _counter: number; // invoice counter lives inside store — survives StrictMode

  addBill: () => void;
  closeBill: (id: string) => void;
  setActiveBill: (id: string) => void;
  getActiveBill: () => Bill | undefined;
  updateBill: (id: string, patch: Partial<Omit<Bill, "id">>) => void;
  addRowToBill: (id: string, row: ProductRow) => void;
  updateRowInBill: (billId: string, rowId: string, field: keyof ProductRow, value: number | string) => void;
  removeRowFromBill: (billId: string, rowId: string) => void;
}

function makeInvoiceNo(n: number) {
  return `#OB${String(n).padStart(4, "0")}`;
}

function makeBill(counter: number): Bill {
  return {
    id: nanoid(),
    invoiceNo: makeInvoiceNo(counter),
    customer: "",
    rows: [],
    paymentMode: "Cash",
    paidAmount: "0.00",
    discount: 0,
    createdAt: new Date().toISOString(),
  };
}

export const usePosStore = create<PosState>((set, get) => {
  const first = makeBill(1);
  return {
    bills: [first],
    activeBillId: first.id,
    _counter: 2, // next bill will be #OB0002

    addBill: () => {
      const { _counter } = get();
      const bill = makeBill(_counter);
      set((s) => ({
        bills: [...s.bills, bill],
        activeBillId: bill.id,
        _counter: s._counter + 1,
      }));
    },

    closeBill: (id) => {
      const { bills, activeBillId } = get();
      if (bills.length === 1) return;
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
              const taxAmt = (taxable * u.taxPct) / 100;
              return { ...u, discAmt: +discAmt.toFixed(2), taxAmt: +taxAmt.toFixed(2), total: +(taxable + taxAmt).toFixed(2) };
            }),
          };
        }),
      }));
    },

    removeRowFromBill: (billId, rowId) => {
      set((s) => ({
        bills: s.bills.map((b) =>
          b.id === billId ? { ...b, rows: b.rows.filter((r) => r.id !== rowId) } : b
        ),
      }));
    },
  };
});
