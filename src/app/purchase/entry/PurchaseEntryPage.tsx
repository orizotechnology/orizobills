import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { AnimatePresence } from "framer-motion";
import { PurchaseTopBar } from "./components/PurchaseTopBar";
import { Plus, Upload, ChevronDown, AlertCircle, CheckCircle2, Printer } from "lucide-react";
import { http } from "@/lib/axios";
import { ItemRow } from "./components/ItemRow";
import { AddProductModal } from "./components/AddProductModal";
import type { PurchaseRow, ProductOption, Supplier, PurchasePayload } from "./purchase.types";
import { calcRow } from "./purchase.types";

// =============================================================
// PURCHASE ENTRY PAGE — Full-screen
// =============================================================

interface ApiResponse<T> { success: boolean; data: T; message?: string; error?: { message: string }; }

function makeRow(): PurchaseRow {
  return {
    id: nanoid(), productId: "", item: "", code: "", count: "", mrp: 0,
    size: "", qty: 1, unit: "NONE", priceUnit: 0, discPct: 0, discAmt: 0,
    taxPct: "", taxAmt: 0, amount: 0,
  };
}

export default function PurchaseEntryPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const fileRef     = useRef<HTMLInputElement>(null);

  // ── Form state ──────────────────────────────────────────────
  const [party,          setParty]          = useState("");
  const [_partyId,       setPartyId]        = useState("");
  const [partyBal,       setPartyBal]       = useState(0);
  const [poNo,           setPoNo]           = useState("");
  const [poDate,         setPoDate]         = useState("");
  const [billDate,       setBillDate]       = useState(new Date().toISOString().slice(0, 10));
  const [billNo,         setBillNo]         = useState("PUR0001");
  const [terms,          setTerms]          = useState("Purchase Bill");
  const [termsNote,      setTermsNote]      = useState("Thanks for doing business with us!");
  const [payType,        setPayType]        = useState("Cash");
  const [notes,          setNotes]          = useState("");
  const [discPct,        setDiscPct]        = useState("0");
  const [taxType,        setTaxType]        = useState("NONE");
  const [rows,           setRows]           = useState<PurchaseRow[]>([{ ...makeRow(), id: "flash" }, makeRow()]);
  const [uploadedFile,   setUploadedFile]   = useState<File | null>(null);

  // ── Data state ───────────────────────────────────────────────
  const [suppliers,          setSuppliers]          = useState<Supplier[]>([]);
  const [products,           setProducts]           = useState<ProductOption[]>([]);
  const [showAddProd,        setShowAddProd]        = useState(false);
  const [addProdPrefill,     setAddProdPrefill]     = useState("");
  const [addProdRowId,       setAddProdRowId]       = useState("");
  const [saving,             setSaving]             = useState(false);
  const [feedback,           setFeedback]           = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [supplierQuery,      setSupplierQuery]      = useState("");
  const [showSupplierDrop,   setShowSupplierDrop]   = useState(false);
  const [showPrintMenu,      setShowPrintMenu]      = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  // Close print menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node))
        setShowPrintMenu(false);
    };
    if (showPrintMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPrintMenu]);

  // ── Block browser back when form is dirty ───────────────────
  useEffect(() => {
    const isDirty = rows.some((r) => r.item.trim() !== "");
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [rows]);
  useEffect(() => {
    http.get<ApiResponse<{ number: string }>>("/purchases/next-number")
      .then((r) => { if (r.success) setBillNo(r.data.number); })
      .catch(() => {});

    http.get<ApiResponse<{ data: ProductOption[] } | ProductOption[]>>("/products?pageSize=9999&filter=active")
      .then((r) => {
        if (r.success) {
          const raw = r.data;
          setProducts(Array.isArray(raw) ? raw : (raw as { data: ProductOption[] }).data ?? []);
        }
      }).catch(() => {});

    http.get<ApiResponse<{ data: Supplier[]; total: number }>>("/suppliers")
      .then((r) => {
        if (r.success) {
          const raw = r.data as unknown;
          if (raw && typeof raw === "object" && Array.isArray((raw as { data: Supplier[] }).data))
            setSuppliers((raw as { data: Supplier[] }).data);
          else if (Array.isArray(raw))
            setSuppliers(raw as Supplier[]);
        }
      }).catch(() => {});
  }, []);

  // ── Totals ───────────────────────────────────────────────────
  const totalQty   = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalDisc  = rows.reduce((s, r) => s + r.discAmt, 0);
  const totalTax   = rows.reduce((s, r) => s + r.taxAmt, 0);
  const totalAmt   = rows.reduce((s, r) => s + r.amount, 0);
  const billDisc   = totalAmt * (parseFloat(discPct) || 0) / 100;
  const grandTotal = +(totalAmt - billDisc).toFixed(2);

  // ── Row operations ───────────────────────────────────────────
  const addRow    = () => setRows((p) => [...p, makeRow()]);
  const removeRow = useCallback((id: string) => setRows((p) => p.filter((r) => r.id !== id)), []);
  const updateRow = useCallback((id: string, updated: PurchaseRow) =>
    setRows((p) => p.map((r) => r.id === id ? updated : r)), []);

  // ── Add product ──────────────────────────────────────────────
  const handleOpenAddProduct = (prefill: string, rowId: string) => {
    setAddProdPrefill(prefill); setAddProdRowId(rowId); setShowAddProd(true);
  };
  const handleProductCreated = (p: ProductOption) => {
    setProducts((prev) => [...prev, p]);
    setShowAddProd(false);
    if (addProdRowId)
      setRows((prev) => prev.map((r) =>
        r.id === addProdRowId
          ? calcRow({ ...r, productId: p.id, item: p.name, code: p.code, mrp: p.mrp, priceUnit: p.salePrice, unit: p.unit, taxPct: String(p.taxPct) })
          : r
      ));
  };

  // ── Upload Bill ──────────────────────────────────────────────
  const handleUploadClick = () => fileRef.current?.click();
  const handleFileChange  = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedFile(file);
    if (file) setFeedback({ type: "success", msg: `Bill image attached: ${file.name}` });
    setTimeout(() => setFeedback(null), 3000);
    e.target.value = "";
  };

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = (mode: "preview" | "direct") => {
    setShowPrintMenu(false);
    if (mode === "direct") { window.print(); return; }
    // Preview: open a simple print window with bill summary
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    const validRows = rows.filter((r) => r.item.trim());
    win.document.write(`
      <html><head><title>Purchase Bill ${billNo}</title>
      <style>body{font-family:sans-serif;padding:20px;font-size:13px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
      th{background:#f8f8f8;font-size:11px}h2{color:#F97316}
      .total{font-size:16px;font-weight:800;color:#F97316}</style></head>
      <body>
        <h2>Purchase Bill — ${billNo}</h2>
        <p><strong>Supplier:</strong> ${party || "—"} &nbsp;&nbsp;
           <strong>Date:</strong> ${billDate} &nbsp;&nbsp;
           <strong>Payment:</strong> ${payType}</p>
        <table><thead><tr>
          <th>#</th><th>Item</th><th>Code</th><th>Qty</th><th>Unit Price</th><th>Disc%</th><th>Tax%</th><th>Amount</th>
        </tr></thead><tbody>
        ${validRows.map((r, i) => `<tr>
          <td>${i + 1}</td><td>${r.item}</td><td>${r.code}</td>
          <td>${r.qty}</td><td>₹${r.priceUnit}</td>
          <td>${r.discPct}%</td><td>${r.taxPct}%</td>
          <td>₹${r.amount.toFixed(2)}</td>
        </tr>`).join("")}
        </tbody></table>
        <p style="text-align:right;margin-top:12px">
          <span class="total">Total: ₹${grandTotal.toFixed(2)}</span>
        </p>
        <script>window.onload=()=>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  // ── Validate & Save ──────────────────────────────────────────
  const validate = (): string | null => {
    if (!party.trim()) return "Please select or enter a supplier.";
    if (!rows.some((r) => r.item.trim())) return "Please add at least one item.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setFeedback({ type: "error", msg: err }); setTimeout(() => setFeedback(null), 3000); return; }
    setSaving(true); setFeedback(null);
    const validRows = rows.filter((r) => r.item.trim());
    const payload: PurchasePayload = {
      supplierName: party.trim(), supplierId: _partyId || undefined,
      billNumber: billNo, billDate,
      poNumber: poNo || undefined, poDate: poDate || undefined,
      paymentMethod: payType, discountPct: parseFloat(discPct) || 0,
      taxType, terms: terms || undefined, notes: notes || undefined,
      items: validRows.map((r) => ({
        itemName: r.item, itemCode: r.code, quantity: Number(r.qty), unit: r.unit,
        mrp: parseFloat(String(r.mrp)) || 0, unitPrice: parseFloat(String(r.priceUnit)) || 0,
        discountPct: parseFloat(String(r.discPct)) || 0, discountAmt: r.discAmt,
        taxPercent: parseFloat(String(r.taxPct)) || 0, taxAmount: r.taxAmt, totalAmount: r.amount,
      })),
    };
    try {
      const res = await http.post<ApiResponse<unknown>>("/purchases", payload);
      if (res.success) {
        setFeedback({ type: "success", msg: "Purchase saved successfully!" });
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        setTimeout(() => navigate("/app/purchase/all"), 1200);
      } else {
        setFeedback({ type: "error", msg: "Failed to save purchase." });
      }
    } catch (e) {
      setFeedback({ type: "error", msg: e instanceof Error ? e.message : "Failed to save purchase." });
    } finally { setSaving(false); }
  };

  const filteredSuppliers = supplierQuery.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(supplierQuery.toLowerCase()))
    : suppliers.slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 13, overflow: "hidden" }}>

      {/* Hidden file input for Upload Bill */}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={handleFileChange} />

      {/* ── Feedback toast ──────────────────────────────── */}
      <AnimatePresence>
        {feedback && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 3000,
            background: feedback.type === "success" ? "#F0FDF4" : "#FFF1F2",
            border: `1px solid ${feedback.type === "success" ? "#BBF7D0" : "#FECDD3"}`,
            borderRadius: 10, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: 13, fontWeight: 600,
            color: feedback.type === "success" ? "#16A34A" : "#EF4444",
          }}>
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ─────────────────────────────────────── */}
      <PurchaseTopBar
        billNo={billNo}
        billDate={billDate}
        isDirty={rows.some((r) => r.item.trim() !== "")}
      />

      {/* ── Header fields: Party / PO / Bill info ────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "start",
        gap: 24,
        padding: "10px 20px 10px",
        borderBottom: "1px solid #E2E8F0",
        flexShrink: 0,
        background: "#FAFAFA",
      }}>
        {/* Left: Party + PO fields */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Party */}
          <div style={{ minWidth: 180 }}>
            <label style={lbl}>Party <span style={{ color: "#EF4444" }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, width: "100%" }}
                placeholder="Search supplier…"
                value={supplierQuery || party}
                onChange={(e) => { setSupplierQuery(e.target.value); setParty(e.target.value); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 160)}
              />
              {showSupplierDrop && filteredSuppliers.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, zIndex: 200, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 220, maxHeight: 200, overflowY: "auto" }}>
                  {filteredSuppliers.map((s) => (
                    <div key={s.id}
                      onMouseDown={() => { setParty(s.name); setPartyId(s.id); setPartyBal(s.balance ?? 0); setSupplierQuery(""); setShowSupplierDrop(false); }}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F8FAFC", display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF7ED"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.balance !== undefined && <span style={{ color: "#F97316", fontSize: 12 }}>₹{s.balance}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {party && <div style={{ fontSize: 11, color: "#F97316", marginTop: 2 }}>BAL: ₹{partyBal}</div>}
          </div>

          {/* PO No */}
          <div style={{ minWidth: 120 }}>
            <label style={lbl}>PO No.</label>
            <input style={inp} placeholder="PO number" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
          </div>

          {/* PO Date */}
          <div style={{ minWidth: 140 }}>
            <label style={lbl}>PO Date</label>
            <input style={inp} type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
        </div>

        {/* Right: Bill Number / Bill Date */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Bill Number</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#F97316" }}>{billNo}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Bill Date</span>
            <input style={{ ...inp, width: 136 }} type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          {uploadedFile && (
            <div style={{ fontSize: 11, color: "#22C55E", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📎 {uploadedFile.name}
            </div>
          )}
        </div>
      </div>

      {/* ── Item table ──────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["#","ITEM","ITEM CODE","COUNT","MRP","SIZE","QTY","UNIT","PRICE/UNIT","DISC %","DISC AMT","TAX %","TAX AMT","AMOUNT",""].map((h, i) => (
                <th key={i} style={{ padding: "8px 6px", textAlign: i === 0 || i === 14 ? "center" : "left", fontSize: 10, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#F8FAFC", borderRight: "1px solid #F1F5F9", zIndex: 10 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <ItemRow
                key={row.id} row={row} index={idx}
                isFlash={row.id === "flash"} products={products}
                canRemove={rows.length > 1}
                onChange={updateRow} onRemove={removeRow} onAddProduct={handleOpenAddProduct}
              />
            ))}
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC", fontWeight: 700 }}>
              <td colSpan={6} style={{ padding: "7px 8px", fontSize: 12, color: "#1E293B" }}>TOTAL</td>
              <td style={{ padding: "7px 6px", textAlign: "right" }}>{totalQty}</td>
              <td /><td /><td />
              <td style={{ padding: "7px 8px", textAlign: "right" }}>{totalDisc.toFixed(2)}</td>
              <td />
              <td style={{ padding: "7px 8px", textAlign: "right" }}>{totalTax.toFixed(2)}</td>
              <td style={{ padding: "7px 8px", textAlign: "right", color: "#F97316", fontWeight: 800 }}>{totalAmt.toFixed(2)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <button onClick={addRow} style={{ display: "flex", alignItems: "center", gap: 5, margin: "8px 16px", background: "none", border: "none", color: "#F97316", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          <Plus size={14} strokeWidth={2.5} /> ADD ROW
        </button>
      </div>

      {/* ── Bottom panel ────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "flex-start", gap: 20, flexShrink: 0, background: "#FAFAFA" }}>

        {/* Terms & Conditions */}
        <div style={{ width: 160, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Terms &amp; Conditions</div>
          <label style={{ ...lbl, marginBottom: 3 }}>Info</label>
          <input style={{ ...inp, width: "100%", marginBottom: 6, boxSizing: "border-box" }} value={terms} onChange={(e) => setTerms(e.target.value)} />
          <textarea style={{ ...inp, width: "100%", height: 52, resize: "none", boxSizing: "border-box" } as React.CSSProperties} value={termsNote} onChange={(e) => setTermsNote(e.target.value)} />
        </div>

        {/* Payment Type + Notes */}
        <div style={{ width: 160, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Payment Type</div>
          <select style={{ ...inp, width: "100%", marginBottom: 8, boxSizing: "border-box" }} value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option>Cash</option>
            <option>Bank Transfer</option>
            <option>Cheque</option>
            <option>UPI</option>
            <option>Credit</option>
          </select>
          <textarea style={{ ...inp, width: "100%", height: 52, resize: "none", boxSizing: "border-box" } as React.CSSProperties} placeholder="Add notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Bill summary */}
        <div style={{ width: 260, flexShrink: 0 }}>
          {/* Discount row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Discount</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" min={0} max={100} value={discPct}
                onChange={(e) => setDiscPct(e.target.value)}
                style={{ ...inp, width: 60, textAlign: "right" }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>%</span>
              <span style={{ fontSize: 12, color: "#EF4444", width: 56, textAlign: "right" }}>
                ({billDisc > 0 ? `₹${billDisc.toFixed(0)}` : "0"})
              </span>
            </div>
          </div>
          {/* Tax row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Tax</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <select style={{ ...inp, width: 88 }} value={taxType} onChange={(e) => setTaxType(e.target.value)}>
                <option>NONE</option><option>5%</option><option>12%</option><option>18%</option>
              </select>
              <span style={{ fontSize: 12, color: "#64748B", width: 56, textAlign: "right" }}>
                ₹{totalTax.toFixed(0)}
              </span>
            </div>
          </div>
          {/* Total */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid #E2E8F0", paddingTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#F97316" }}>
              ₹{grandTotal === 0 ? "0" : grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #E2E8F0", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#fff" }}>

        {/* Upload Bill */}
        <button onClick={handleUploadClick}
          style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E8F0", borderRadius: 8, background: uploadedFile ? "rgba(34,197,94,0.07)" : "#fff", color: uploadedFile ? "#16A34A" : "#475569", borderColor: uploadedFile ? "#22C55E" : "#E2E8F0", padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = uploadedFile ? "rgba(34,197,94,0.12)" : "#F8FAFC"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = uploadedFile ? "rgba(34,197,94,0.07)" : "#fff"; }}>
          <Upload size={14} />
          {uploadedFile ? `Bill: ${uploadedFile.name.slice(0, 18)}${uploadedFile.name.length > 18 ? "…" : ""}` : "Upload Bill"}
        </button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Print dropdown */}
          <div ref={printMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowPrintMenu((p) => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#475569", padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
              <Printer size={14} /> Print <ChevronDown size={12} style={{ transition: "transform 0.15s", transform: showPrintMenu ? "rotate(180deg)" : "rotate(0)" }} />
            </button>
            {showPrintMenu && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 170, zIndex: 500, overflow: "hidden", padding: "4px 0" }}>
                {[
                  { label: "Print Preview", mode: "preview" as const },
                  { label: "Print Directly", mode: "direct" as const },
                ].map(({ label, mode }) => (
                  <button key={mode} onClick={() => handlePrint(mode)}
                    style={{ width: "100%", display: "flex", alignItems: "center", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", fontFamily: "inherit", textAlign: "left" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLButtonElement).style.color = "#F97316"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            style={{ background: saving ? "#FED7AA" : "#F97316", color: saving ? "#F97316" : "#fff", border: "none", borderRadius: 8, padding: "8px 32px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", outline: "none", display: "flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}>
            {saving
              ? <><span style={{ width: 14, height: 14, border: "2px solid #F97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Saving…</>
              : "Save"}
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProd && (
          <AddProductModal prefill={addProdPrefill} onCreated={handleProductCreated} onClose={() => setShowAddProd(false)} />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "#64748B", marginBottom: 4, letterSpacing: "0.02em",
};
const inp: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 10px",
  fontSize: 13, color: "#1E293B", outline: "none",
  fontFamily: "inherit", background: "#fff",
};
