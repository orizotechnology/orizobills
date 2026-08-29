import { useState, useRef, useEffect, useCallback } from "react";
import { ScanBarcode, Download, Printer, Plus, Trash2, AlertCircle, Copy, CopyPlus, Upload, Check } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Code 39 encoder — produces a real, scannable barcode.
// Each character = 5 bars + 4 spaces (9 elements), 3 of which
// are "wide". This is the public ISO/IEC 16388 reference table.
// ─────────────────────────────────────────────────────────────
const CODE39 = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000",
  "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
  "8": "100100100", "9": "001100100", A: "100001001", B: "001001001",
  C: "101001000", D: "000011001", E: "100011000", F: "001011000",
  G: "000001101", H: "100001100", I: "001001100", J: "000011100",
  K: "100000011", L: "001000011", M: "101000010", N: "000010011",
  O: "100010010", P: "001010010", Q: "000000111", R: "100000110",
  S: "001000110", T: "000010110", U: "110000001", V: "011000001",
  W: "111000000", X: "010010001", Y: "110010000", Z: "011010000",
  "-": "010000101", ".": "110000100", " ": "011000100", $: "010101000",
  "/": "010100010", "+": "010001010", "%": "000101010", "*": "010010100",
};
const CODE39_ALLOWED = /^[0-9A-Z\-. $/+%]*$/;

function sanitizeCode39(raw) {
  return raw.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
}

// Draws a Code 39 barcode onto a canvas and returns its pixel width.
function drawCode39(canvas, rawValue, { moduleWidth = 2, height = 64, quietZone = 10 } = {}) {
  const value = sanitizeCode39(rawValue || "");
  const chars = `*${value || "0"}*`.split("");
  const narrow = moduleWidth;
  const wide = moduleWidth * 2.5;

  let totalUnits = 0;
  const charWidths = chars.map((ch) => {
    const pattern = CODE39[ch] ?? CODE39["0"];
    const w = [...pattern].reduce((sum, bit) => sum + (bit === "1" ? wide : narrow), 0);
    totalUnits += w + narrow; // inter-character gap
    return w;
  });

  const contentWidth = totalUnits - narrow; // no trailing gap
  const totalWidth = Math.ceil(contentWidth + quietZone * 2);

  canvas.width = totalWidth;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0F172A";

  let x = quietZone;
  chars.forEach((ch) => {
    const pattern = CODE39[ch] ?? CODE39["0"];
    [...pattern].forEach((bit, i) => {
      const isBar = i % 2 === 0;
      const w = bit === "1" ? wide : narrow;
      if (isBar) ctx.fillRect(x, 0, w, height);
      x += w;
    });
    x += narrow;
  });

  return totalWidth;
}

// Avery-style label sheet presets (mm), used to size print cards.
const LABEL_SHEETS = {
  none: { name: "Default (auto)", cols: null, cardW: null, cardH: null },
  "avery-5160": { name: "Avery 5160 (3×10, 66×25mm)", cols: 3, cardW: 66, cardH: 25.4 },
  "avery-5163": { name: "Avery 5163 (2×5, 101×67mm)", cols: 2, cardW: 101.6, cardH: 67 },
  "avery-l7160": { name: "Avery L7160 (3×7, 63×38mm)", cols: 3, cardW: 63.5, cardH: 38.1 },
};

let idCounter = 1;

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const rows = lines.map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  // Drop a header row if it looks like one.
  const first = rows[0].map((c) => c.toLowerCase());
  const looksLikeHeader = first[0]?.includes("barcode") || first[0]?.includes("sku") || first[0]?.includes("value");
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  return dataRows
    .filter((r) => r[0])
    .map((r) => ({
      id: nextGlobalId(),
      value: r[0] || "",
      label: r[1] || "",
      qty: Math.max(1, Number(r[2]) || 1),
    }));
}

function nextGlobalId() {
  return idCounter++;
}

export default function BarcodeGeneratorPage() {
  const [entries, setEntries] = useState([
    { id: nextGlobalId(), value: "8901234567890", label: "Sample Product", qty: 1 },
  ]);
  const canvasRefs = useRef(new Map());
  const fileInputRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sheet, setSheet] = useState("none");

  const addRow = () => {
    setEntries((prev) => [...prev, { id: nextGlobalId(), value: "", label: "", qty: 1 }]);
  };

  const duplicateRow = (id) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: nextGlobalId() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const copyValue = async (entry) => {
    try {
      await navigator.clipboard.writeText(entry.value);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((c) => (c === entry.id ? null : c)), 1200);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const removeRow = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    canvasRefs.current.delete(id);
  };

  const update = (id, field, value) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleCSVFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result || ""));
      if (parsed.length > 0) setEntries((prev) => [...prev, ...parsed]);
    };
    reader.readAsText(file);
  };

  const setCanvasRef = useCallback((id, idx) => (node) => {
    if (node) canvasRefs.current.set(`${id}-${idx}`, node);
    else canvasRefs.current.delete(`${id}-${idx}`);
  }, []);

  // Redraw every barcode canvas whenever entries change.
  useEffect(() => {
    entries.forEach((entry) => {
      const qty = Math.max(1, Number(entry.qty) || 1);
      for (let i = 0; i < qty; i++) {
        const canvas = canvasRefs.current.get(`${entry.id}-${i}`);
        if (canvas) drawCode39(canvas, entry.value);
      }
    });
  });

  const validEntries = entries.filter((e) => e.value.trim().length > 0);
  const hasInvalidChars = entries.some((e) => e.value && !CODE39_ALLOWED.test(e.value.toUpperCase()));

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const cards = [];
    entries.forEach((entry) => {
      const qty = Math.max(1, Number(entry.qty) || 1);
      for (let i = 0; i < qty; i++) {
        const canvas = canvasRefs.current.get(`${entry.id}-${i}`);
        if (canvas) cards.push({ canvas, label: entry.label, value: entry.value || "0" });
      }
    });
    if (cards.length === 0) return;

    const preset = LABEL_SHEETS[sheet];
    const cardW = preset.cardW ? Math.round(preset.cardW * 3.7795) : 260;
    const cardH = preset.cardH ? Math.round(preset.cardH * 3.7795) : 150;
    const cols = preset.cols || Math.min(4, cards.length);
    const rows = Math.ceil(cards.length / cols);
    const out = document.createElement("canvas");
    out.width = cardW * cols;
    out.height = cardH * rows;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    cards.forEach((card, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ox = col * cardW, oy = row * cardH;
      ctx.strokeStyle = "#E2E8F0";
      ctx.strokeRect(ox + 4, oy + 4, cardW - 8, cardH - 8);
      const scale = Math.min((cardW - 40) / card.canvas.width, 1);
      const dw = card.canvas.width * scale, dh = card.canvas.height * scale;
      ctx.drawImage(card.canvas, ox + (cardW - dw) / 2, oy + 16, dw, dh);
      ctx.fillStyle = "#0F172A";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(card.value, ox + cardW / 2, oy + 16 + dh + 18);
      if (card.label) {
        ctx.fillStyle = "#64748B";
        ctx.font = "11px sans-serif";
        ctx.fillText(card.label.slice(0, 28), ox + cardW / 2, oy + 16 + dh + 34);
      }
    });

    const link = document.createElement("a");
    link.download = "barcodes.png";
    link.href = out.toDataURL("image/png");
    link.click();
  };

  const sheetPreset = LABEL_SHEETS[sheet];
  const mmToPx = (mm) => `${(mm * 3.7795).toFixed(1)}px`;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
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
            <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Generate and print Code 39 product barcodes</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={sheet}
            onChange={(e) => setSheet(e.target.value)}
            title="Label sheet size for printing"
            style={{
              padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E2E8F0",
              background: "#fff", fontSize: 12.5, color: "#475569", cursor: "pointer",
            }}
          >
            {Object.entries(LABEL_SHEETS).map(([key, s]) => (
              <option key={key} value={key}>{s.name}</option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCSVFile(file);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileInputRef.current?.click()} style={btnStyle(false, false)}>
            <Upload size={15} /> Import CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={validEntries.length === 0}
            style={btnStyle(false, validEntries.length === 0)}
          >
            <Printer size={15} /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={validEntries.length === 0}
            style={btnStyle(true, validEntries.length === 0)}
          >
            <Download size={15} /> Download PNG
          </button>
        </div>
      </div>

      <p className="no-print" style={{ margin: "-18px 0 20px", fontSize: 11.5, color: "#94A3B8" }}>
        CSV format: <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4 }}>barcode,label,qty</code> — one row per product.
      </p>

      {hasInvalidChars && (
        <div className="no-print" style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8,
          padding: "9px 14px", marginBottom: 16, fontSize: 12.5, color: "#92400E",
        }}>
          <AlertCircle size={15} />
          Code 39 only supports A–Z, 0–9, and - . $ / + % space. Unsupported characters will be dropped when rendered.
        </div>
      )}

      {/* Entry table */}
      <div className="no-print" style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #E2E8F0",
        overflow: "hidden", marginBottom: 20,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 96px 44px",
          gap: 0,
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          padding: "10px 16px",
        }}>
          {["Barcode / SKU", "Label (Product Name)", "Qty", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</span>
          ))}
        </div>

        {entries.map((entry) => {
          const invalid = entry.value && !CODE39_ALLOWED.test(entry.value.toUpperCase());
          return (
            <div key={entry.id} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 96px auto",
              gap: 8,
              padding: "10px 16px",
              borderBottom: "1px solid #F1F5F9",
              alignItems: "center",
            }}>
              <input
                value={entry.value}
                onChange={(e) => update(entry.id, "value", e.target.value)}
                placeholder="e.g. 8901234567890"
                style={inputStyle(invalid)}
              />
              <input
                value={entry.label}
                onChange={(e) => update(entry.id, "label", e.target.value)}
                placeholder="Product name"
                style={inputStyle(false)}
              />
              <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: 7, overflow: "hidden", background: "#F8FAFC" }}>
                <button
                  onClick={() => update(entry.id, "qty", Math.max(1, (Number(entry.qty) || 1) - 1))}
                  style={stepBtnStyle}
                >−</button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={entry.qty}
                  onChange={(e) => update(entry.id, "qty", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                  style={{ width: 28, border: "none", background: "transparent", textAlign: "center", fontSize: 13, color: "#0F172A", outline: "none" }}
                />
                <button
                  onClick={() => update(entry.id, "qty", (Number(entry.qty) || 1) + 1)}
                  style={stepBtnStyle}
                >+</button>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  onClick={() => copyValue(entry)}
                  disabled={!entry.value}
                  title="Copy barcode value"
                  style={iconBtnStyle(!entry.value)}
                >
                  {copiedId === entry.id ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                </button>
                <button onClick={() => duplicateRow(entry.id)} title="Duplicate row" style={iconBtnStyle(false)}>
                  <CopyPlus size={14} />
                </button>
                <button
                  onClick={() => removeRow(entry.id)}
                  disabled={entries.length === 1}
                  title="Delete row"
                  style={{
                    ...iconBtnStyle(entries.length === 1),
                    color: entries.length === 1 ? "#CBD5E1" : "#EF4444",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ padding: "10px 16px" }}>
          <button onClick={addRow} style={addRowStyle}>
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid #E2E8F0", padding: "20px 24px",
      }} className="preview-card">
        <h2 className="no-print" style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Preview</h2>

        {validEntries.length === 0 ? (
          <div className="no-print" style={{
            textAlign: "center", padding: "36px 12px", color: "#94A3B8", fontSize: 13,
          }}>
            Add a barcode / SKU above to see it rendered here.
          </div>
        ) : (
          <div
            style={{
              display: "flex", flexWrap: "wrap", gap: 16,
              ...(sheetPreset.cardW ? { "--sheet-w": mmToPx(sheetPreset.cardW), "--sheet-h": mmToPx(sheetPreset.cardH) } : {}),
            }}
            className="barcode-print-area"
          >
            {entries.flatMap((entry) => {
              if (!entry.value.trim()) return [];
              const qty = Math.max(1, Number(entry.qty) || 1);
              return Array.from({ length: qty }).map((_, idx) => (
                <div key={`${entry.id}-${idx}`} className="barcode-card" style={{
                  border: "1px solid #E2E8F0", borderRadius: 8,
                  padding: "14px 16px", textAlign: "center",
                  background: "#fff", minWidth: 160,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <canvas ref={setCanvasRef(entry.id, idx)} style={{ display: "block", margin: "0 auto 6px" }} />
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0F172A", marginBottom: 4, letterSpacing: 0.5 }}>
                    {sanitizeCode39(entry.value) || "0"}
                  </div>
                  {entry.label && (
                    <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, margin: "0 auto" }}>
                      {entry.label}
                    </div>
                  )}
                </div>
              ));
            })}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .preview-card { border: none !important; padding: 0 !important; box-shadow: none !important; }
          .barcode-card { break-inside: avoid; }
          ${sheetPreset.cardW ? `
          .barcode-print-area { gap: 0 !important; }
          .barcode-card {
            width: var(--sheet-w);
            height: var(--sheet-h);
            border-radius: 0 !important;
            overflow: hidden;
          }
          ` : ""}
        }
      `}</style>
    </div>
  );
}

const btnStyle = (primary, disabled) => ({
  display: "flex", alignItems: "center", gap: 7,
  padding: "8px 16px", borderRadius: 8,
  border: primary ? "none" : "1.5px solid #E2E8F0",
  background: disabled ? (primary ? "#FDBA84" : "#F8FAFC") : (primary ? "#F97316" : "#fff"),
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: 13, fontWeight: 500,
  color: primary ? "#fff" : (disabled ? "#CBD5E1" : "#475569"),
  transition: "background 0.15s ease",
});

const addRowStyle = {
  display: "flex", alignItems: "center", gap: 6,
  background: "none", border: "1.5px dashed #CBD5E1",
  borderRadius: 7, padding: "7px 14px",
  cursor: "pointer", color: "#64748B", fontSize: 13,
};

const iconBtnStyle = (disabled) => ({
  background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
  color: disabled ? "#CBD5E1" : "#64748B",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 6, borderRadius: 6,
});

const stepBtnStyle = {
  width: 22, height: 26, border: "none", background: "transparent",
  color: "#64748B", fontSize: 14, cursor: "pointer", lineHeight: 1,
};

const inputStyle = (invalid) => ({
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: `1.5px solid ${invalid ? "#FCA5A5" : "#E2E8F0"}`,
  fontSize: 13,
  color: "#0F172A",
  outline: "none",
  background: invalid ? "#FEF2F2" : "#F8FAFC",
  boxSizing: "border-box",
});