import { useState, useRef } from "react";
import { Trash2, Zap } from "lucide-react";
import type { PurchaseRow, ProductOption } from "../purchase.types";
import { calcRow } from "../purchase.types";

// =============================================================
// ITEM ROW — purchase table row
// Primary unit dropdown + secondary unit dropdown + conversion
// hidden in a small inline label. No COUNT column.
// All number inputs: manual typing only, spinners hidden.
// =============================================================

interface ItemRowProps {
  row: PurchaseRow;
  index: number;
  isFlash?: boolean;
  products: ProductOption[];
  canRemove: boolean;
  onChange: (id: string, updated: PurchaseRow) => void;
  onRemove: (id: string) => void;
  onAddProduct: (prefill: string, rowId: string) => void;
}

// Common units for dropdown
const UNITS = [
  "Nos", "Pcs", "Box", "Kg", "Gm", "Mg",
  "Litre", "Ml", "Metre", "Cm", "Mm",
  "Pair", "Set", "Dozen", "Bundle",
  "Bag", "Carton", "Roll", "Sheet", "Tablet",
];

const TAX_OPTS = [
  { label: "Select", val: "" },
  { label: "0%",  val: "0"  },
  { label: "5%",  val: "5"  },
  { label: "12%", val: "12" },
  { label: "18%", val: "18" },
  { label: "28%", val: "28" },
];

export function ItemRow({ row, index, isFlash, products, canRemove, onChange, onRemove, onAddProduct }: ItemRowProps) {
  const [search,       setSearch]       = useState(row.item);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim().length > 0
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const update = (field: keyof PurchaseRow, val: string | number) => {
    onChange(row.id, calcRow({ ...row, [field]: val }));
  };

  const selectProduct = (p: ProductOption) => {
    setSearch(p.name);
    setShowDropdown(false);
    onChange(row.id, calcRow({
      ...row,
      productId:      p.id,
      item:           p.name,
      code:           p.code,
      mrp:            p.mrp,
      priceUnit:      p.salePrice,
      unit:           p.unit || "Nos",
      secondaryUnit:  p.secondaryUnit || "",
      conversionRate: p.conversionRate ?? 0,
      taxPct:         String(p.taxPct),
    }));
  };

  const hasSec = !!row.secondaryUnit && row.conversionRate > 0;

  return (
    <>
      <style>{`
        .pur-inp::-webkit-inner-spin-button,
        .pur-inp::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .pur-inp[type=number] { -moz-appearance: textfield; }
      `}</style>
      <tr style={{ borderBottom: "1px solid #F8FAFC" }}>

        {/* # */}
        <td style={td(28)}>
          {isFlash
            ? <Zap size={13} color="#F97316" />
            : <span style={{ color: "#94A3B8", fontSize: 11, userSelect: "none" }}>{index}</span>}
        </td>

        {/* Item name */}
        <td style={{ ...td(), minWidth: 130, position: "relative" }}>
          <input ref={inputRef} style={cellInp} placeholder="Item name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); update("item", e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            autoComplete="off" />
          {showDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 240, maxHeight: 220, overflowY: "auto" }}>
              {filtered.length > 0 ? filtered.map((p) => (
                <div key={p.id} onMouseDown={() => selectProduct(p)}
                  style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F8FAFC", fontSize: 13 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{p.name}</span>
                  <span style={{ color: "#94A3B8", marginLeft: 8, fontSize: 11 }}>{p.code}</span>
                  <span style={{ float: "right", color: "#F97316", fontSize: 12 }}>₹{p.salePrice}</span>
                </div>
              )) : search.trim().length > 1 ? (
                <div onMouseDown={() => { setShowDropdown(false); onAddProduct(search, row.id); }}
                  style={{ padding: "10px 14px", cursor: "pointer", color: "#F97316", fontSize: 13, fontWeight: 600 }}>
                  + Create "{search}"
                </div>
              ) : null}
            </div>
          )}
        </td>

        {/* Item Code */}
        <td style={td(76)}><input style={cellInp} value={row.code} onChange={(e) => update("code", e.target.value)} /></td>

        {/* MRP */}
        <td style={td(66)}>
          <input className="pur-inp" style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" value={row.mrp} onChange={(e) => update("mrp", e.target.value)} />
        </td>

        {/* Size */}
        <td style={td(52)}><input style={cellInp} value={row.size} onChange={(e) => update("size", e.target.value)} /></td>

        {/* QTY */}
        <td style={td(52)}>
          <input className="pur-inp" style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} value={row.qty}
            onChange={(e) => update("qty", parseFloat(e.target.value) || 0)} />
        </td>

        {/* Primary Unit — dropdown */}
        <td style={td(80)}>
          <select style={{ ...cellInp, background: "transparent" }}
            value={row.unit}
            onChange={(e) => update("unit", e.target.value)}>
            <option value="">— Unit —</option>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </td>

        {/* Secondary Unit — dropdown + converted qty shown inline */}
        <td style={td(120)}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <select style={{ ...cellInp, background: "transparent", flex: 1, minWidth: 0 }}
              value={row.secondaryUnit}
              onChange={(e) => update("secondaryUnit", e.target.value)}>
              <option value="">— None —</option>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {hasSec && (
              <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap", flexShrink: 0 }}>
                ={row.secQty}
              </span>
            )}
          </div>
        </td>

        {/* Conv Rate — only visible when secondary unit is set; inline small */}
        <td style={td(54)}>
          {row.secondaryUnit ? (
            <input className="pur-inp" style={{ ...cellInp, textAlign: "right", fontSize: 11 }} type="number"
              inputMode="decimal" min={0} placeholder="1:n"
              value={row.conversionRate || ""}
              onChange={(e) => update("conversionRate", parseFloat(e.target.value) || 0)} />
          ) : (
            <span style={{ color: "#E2E8F0", fontSize: 11, padding: "4px", display: "block", textAlign: "center" }}>—</span>
          )}
        </td>

        {/* Price/Unit */}
        <td style={td(78)}>
          <input className="pur-inp" style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} step="0.01" value={row.priceUnit}
            onChange={(e) => update("priceUnit", e.target.value)} />
        </td>

        {/* Disc % */}
        <td style={td(52)}>
          <input className="pur-inp" style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} max={100} value={row.discPct}
            onChange={(e) => update("discPct", e.target.value)} />
        </td>

        {/* Disc Amt */}
        <td style={{ ...td(62), color: "#64748B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.discAmt.toFixed(2)}
        </td>

        {/* Tax % */}
        <td style={td(78)}>
          <select style={{ ...cellInp, background: "transparent" }}
            value={String(row.taxPct)} onChange={(e) => update("taxPct", e.target.value)}>
            {TAX_OPTS.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
          </select>
        </td>

        {/* Tax Amt */}
        <td style={{ ...td(62), color: "#64748B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.taxAmt.toFixed(2)}
        </td>

        {/* Amount */}
        <td style={{ ...td(78), fontWeight: 700, color: "#1E293B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.amount.toFixed(2)}
        </td>

        {/* Delete */}
        <td style={td(28)}>
          {canRemove && (
            <button onClick={() => onRemove(row.id)} style={delBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
              <Trash2 size={13} />
            </button>
          )}
        </td>
      </tr>
    </>
  );
}

function td(width?: number): React.CSSProperties {
  return { padding: "3px 2px", width, borderRight: "1px solid #F8FAFC" };
}

const cellInp: React.CSSProperties = {
  width: "100%", border: "none",
  borderBottom: "1px solid #E8EDF2",
  padding: "4px 4px", fontSize: 12, color: "#1E293B",
  outline: "none", fontFamily: "inherit", background: "transparent",
};

const delBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#CBD5E1", display: "flex", padding: "2px",
  outline: "none", borderRadius: 4, transition: "color 0.12s",
};

// =============================================================
// ITEM ROW — purchase table row
// - No COUNT column
// - Primary unit (base) + Secondary unit (converted) shown together
// - All number inputs: manual typing only, spinners hidden
// =============================================================

interface ItemRowProps {
  row: PurchaseRow;
  index: number;
  isFlash?: boolean;
  products: ProductOption[];
  canRemove: boolean;
  onChange: (id: string, updated: PurchaseRow) => void;
  onRemove: (id: string) => void;
  onAddProduct: (prefill: string, rowId: string) => void;
}

const TAX_OPTS = [
  { label: "Select", val: "" },
  { label: "0%",  val: "0"  },
  { label: "5%",  val: "5"  },
  { label: "12%", val: "12" },
  { label: "18%", val: "18" },
  { label: "28%", val: "28" },
];

export function ItemRow({ row, index, isFlash, products, canRemove, onChange, onRemove, onAddProduct }: ItemRowProps) {
  const [search,       setSearch]       = useState(row.item);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim().length > 0
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const update = (field: keyof PurchaseRow, val: string | number) => {
    onChange(row.id, calcRow({ ...row, [field]: val }));
  };

  const selectProduct = (p: ProductOption) => {
    setSearch(p.name);
    setShowDropdown(false);
    onChange(row.id, calcRow({
      ...row,
      productId:      p.id,
      item:           p.name,
      code:           p.code,
      mrp:            p.mrp,
      priceUnit:      p.salePrice,
      unit:           p.unit || "Nos",
      secondaryUnit:  p.secondaryUnit || "",
      conversionRate: p.conversionRate ?? 0,
      taxPct:         String(p.taxPct),
    }));
  };

  const hasSec = row.secondaryUnit && row.conversionRate > 0;

  return (
    <>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      <tr style={{ borderBottom: "1px solid #F8FAFC" }}>

        {/* # */}
        <td style={td(28)}>
          {isFlash
            ? <Zap size={13} color="#F97316" />
            : <span style={{ color: "#94A3B8", fontSize: 11, userSelect: "none" }}>{index}</span>}
        </td>

        {/* Item name — product search */}
        <td style={{ ...td(), minWidth: 140, position: "relative" }}>
          <input ref={inputRef} style={cellInp} placeholder="Item name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); update("item", e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            autoComplete="off"
          />
          {showDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 200, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 240, maxHeight: 220, overflowY: "auto" }}>
              {filtered.length > 0 ? filtered.map((p) => (
                <div key={p.id} onMouseDown={() => selectProduct(p)}
                  style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #F8FAFC", fontSize: 13 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>
                  <span style={{ fontWeight: 600, color: "#1E293B" }}>{p.name}</span>
                  <span style={{ color: "#94A3B8", marginLeft: 8, fontSize: 11 }}>{p.code}</span>
                  <span style={{ float: "right", color: "#F97316", fontSize: 12 }}>₹{p.salePrice}</span>
                </div>
              )) : search.trim().length > 1 ? (
                <div onMouseDown={() => { setShowDropdown(false); onAddProduct(search, row.id); }}
                  style={{ padding: "10px 14px", cursor: "pointer", color: "#F97316", fontSize: 13, fontWeight: 600 }}>
                  + Create "{search}"
                </div>
              ) : null}
            </div>
          )}
        </td>

        {/* Item Code */}
        <td style={td(80)}>
          <input style={cellInp} value={row.code} onChange={(e) => update("code", e.target.value)} />
        </td>

        {/* MRP */}
        <td style={td(70)}>
          <input style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" value={row.mrp}
            onChange={(e) => update("mrp", e.target.value)} />
        </td>

        {/* Size */}
        <td style={td(56)}>
          <input style={cellInp} value={row.size} onChange={(e) => update("size", e.target.value)} />
        </td>

        {/* QTY (primary) */}
        <td style={td(56)}>
          <input style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} value={row.qty}
            onChange={(e) => update("qty", parseFloat(e.target.value) || 0)} />
        </td>

        {/* Primary Unit */}
        <td style={td(68)}>
          <input style={cellInp} placeholder="Unit"
            value={row.unit}
            onChange={(e) => update("unit", e.target.value)} />
        </td>

        {/* Secondary Unit — label + converted qty */}
        <td style={td(96)}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <input style={{ ...cellInp, width: 44 }} placeholder="Sec. unit"
              value={row.secondaryUnit}
              onChange={(e) => update("secondaryUnit", e.target.value)} />
            {hasSec && (
              <span style={{ fontSize: 10, color: "#64748B", whiteSpace: "nowrap" }}>
                = {row.secQty}
              </span>
            )}
          </div>
        </td>

        {/* Conversion Rate */}
        <td style={td(60)}>
          <input style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} placeholder="Conv."
            value={row.conversionRate || ""}
            onChange={(e) => update("conversionRate", parseFloat(e.target.value) || 0)} />
        </td>

        {/* Price/Unit */}
        <td style={td(80)}>
          <input style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} step="0.01" value={row.priceUnit}
            onChange={(e) => update("priceUnit", e.target.value)} />
        </td>

        {/* Disc % */}
        <td style={td(56)}>
          <input style={{ ...cellInp, textAlign: "right" }} type="number"
            inputMode="decimal" min={0} max={100} value={row.discPct}
            onChange={(e) => update("discPct", e.target.value)} />
        </td>

        {/* Disc Amt — read-only */}
        <td style={{ ...td(64), color: "#64748B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.discAmt.toFixed(2)}
        </td>

        {/* Tax % */}
        <td style={td(80)}>
          <select style={{ ...cellInp, background: "transparent" }}
            value={String(row.taxPct)} onChange={(e) => update("taxPct", e.target.value)}>
            {TAX_OPTS.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
          </select>
        </td>

        {/* Tax Amt — read-only */}
        <td style={{ ...td(64), color: "#64748B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.taxAmt.toFixed(2)}
        </td>

        {/* Amount — read-only */}
        <td style={{ ...td(80), fontWeight: 700, color: "#1E293B", textAlign: "right", padding: "4px 6px", fontSize: 12 }}>
          {row.amount.toFixed(2)}
        </td>

        {/* Delete */}
        <td style={td(28)}>
          {canRemove && (
            <button onClick={() => onRemove(row.id)} style={delBtn}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1"; }}>
              <Trash2 size={13} />
            </button>
          )}
        </td>
      </tr>
    </>
  );
}

function td(width?: number): React.CSSProperties {
  return { padding: "3px 2px", width, borderRight: "1px solid #F8FAFC" };
}

const cellInp: React.CSSProperties = {
  width: "100%", border: "none",
  borderBottom: "1px solid #E8EDF2",
  padding: "4px 4px", fontSize: 12, color: "#1E293B",
  outline: "none", fontFamily: "inherit", background: "transparent",
};

const delBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#CBD5E1", display: "flex", padding: "2px",
  outline: "none", borderRadius: 4, transition: "color 0.12s",
};
