import { useState, useRef } from "react";
import { ScanBarcode, Download, Printer, Plus, Trash2 } from "lucide-react";

// ── tiny inline barcode renderer using Code128 pattern ──────
// For a real app, replace with a library like `jsbarcode`.
// This stub renders a visual placeholder so the page is functional.

interface BarcodeEntry {
  id: number;
  value: string;
  label: string;
  qty: number;
}

export default function BarcodeGeneratorPage() {
  const [entries, setEntries] = useState<BarcodeEntry[]>([
    { id: 1, value: "", label: "", qty: 1 },
  ]);
  const nextId = useRef(2);

  const addRow = () => {
    setEntries((prev) => [
      ...prev,
      { id: nextId.current++, value: "", label: "", qty: 1 },
    ]);
  };

  const removeRow = (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const update = (id: number, field: keyof BarcodeEntry, value: string | number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handlePrint = () => window.print();

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(249,115,22,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScanBarcode size={20} color="#F97316" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Barcode Generator</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Generate and print product barcodes</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handlePrint}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 8,
              border: "1.5px solid #E2E8F0", background: "#fff",
              cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#475569",
            }}
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 8,
              border: "none", background: "#F97316",
              cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#fff",
            }}
          >
            <Download size={15} /> Download
          </button>
        </div>
      </div>

      {/* Entry table */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #E2E8F0",
        overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 80px 44px",
          gap: 0,
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          padding: "10px 16px",
        }}>
          {["Barcode / SKU", "Label (Product Name)", "Qty", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {entries.map((entry) => (
          <div key={entry.id} style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 80px 44px",
            gap: 8,
            padding: "10px 16px",
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}>
            <input
              value={entry.value}
              onChange={(e) => update(entry.id, "value", e.target.value)}
              placeholder="e.g. 8901234567890"
              style={inputStyle}
            />
            <input
              value={entry.label}
              onChange={(e) => update(entry.id, "label", e.target.value)}
              placeholder="Product name"
              style={inputStyle}
            />
            <input
              type="number"
              min={1}
              value={entry.qty}
              onChange={(e) => update(entry.id, "qty", Number(e.target.value))}
              style={{ ...inputStyle, textAlign: "center" }}
            />
            <button
              onClick={() => removeRow(entry.id)}
              disabled={entries.length === 1}
              style={{
                background: "none", border: "none", cursor: entries.length === 1 ? "not-allowed" : "pointer",
                color: entries.length === 1 ? "#CBD5E1" : "#EF4444",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div style={{ padding: "10px 16px" }}>
          <button
            onClick={addRow}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "1.5px dashed #CBD5E1",
              borderRadius: 7, padding: "7px 14px",
              cursor: "pointer", color: "#64748B", fontSize: 13,
            }}
          >
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #E2E8F0", padding: "20px 24px",
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Preview</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }} className="barcode-print-area">
          {entries.flatMap((entry) =>
            Array.from({ length: entry.qty || 1 }).map((_, idx) => (
              <BarcodeCard key={`${entry.id}-${idx}`} value={entry.value} label={entry.label} />
            ))
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          .barcode-print-area { display: flex !important; flex-wrap: wrap; gap: 16px; }
        }
      `}</style>
    </div>
  );
}

// ── Barcode card (visual stub — replace with jsbarcode for real SVG) ──

function BarcodeCard({ value, label }: { value: string; label: string }) {
  const display = value || "000000000000";

  // Simple representation using a series of bars
  const bars = display.split("").map((c) => c.charCodeAt(0));

  return (
    <div style={{
      border: "1px solid #E2E8F0", borderRadius: 8,
      padding: "12px 16px", textAlign: "center",
      background: "#fff", minWidth: 140,
    }}>
      {/* Bar visual */}
      <div style={{ display: "flex", justifyContent: "center", gap: 1, marginBottom: 6, height: 48 }}>
        {bars.map((_b, i) => (
          <div
            key={i}
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 2 === 0 ? "100%" : "80%",
              background: "#0F172A",
              alignSelf: "flex-end",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0F172A", marginBottom: 4 }}>
        {display}
      </div>
      {label && (
        <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120, margin: "0 auto" }}>
          {label}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "1.5px solid #E2E8F0",
  fontSize: 13,
  color: "#0F172A",
  outline: "none",
  background: "#F8FAFC",
  boxSizing: "border-box",
};
