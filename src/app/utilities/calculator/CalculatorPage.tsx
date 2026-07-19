import { useState } from "react";
import { Calculator } from "lucide-react";

type CalcOp = "+" | "-" | "×" | "÷" | null;

export default function CalculatorPage() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev]       = useState<number | null>(null);
  const [op, setOp]           = useState<CalcOp>(null);
  const [fresh, setFresh]     = useState(false); // next digit resets display

  const pushDigit = (d: string) => {
    setDisplay((cur) => {
      if (fresh) { setFresh(false); return d; }
      if (cur === "0" && d !== ".") return d;
      if (d === "." && cur.includes(".")) return cur;
      return cur + d;
    });
  };

  const pushOp = (o: CalcOp) => {
    const val = parseFloat(display);
    if (prev !== null && op && !fresh) {
      const result = compute(prev, val, op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(val);
    }
    setOp(o);
    setFresh(true);
  };

  const equals = () => {
    if (prev === null || op === null) return;
    const val = parseFloat(display);
    const result = compute(prev, val, op);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const clear = () => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setFresh(false);
  };

  const toggleSign = () => {
    setDisplay((cur) => String(parseFloat(cur) * -1));
  };

  const percent = () => {
    setDisplay((cur) => String(parseFloat(cur) / 100));
  };

  const backspace = () => {
    setDisplay((cur) => (cur.length > 1 ? cur.slice(0, -1) : "0"));
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 420 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Calculator size={20} color="#F97316" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Calculator</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Quick calculations while billing</p>
        </div>
      </div>

      {/* Body */}
      <div style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        maxWidth: 320,
      }}>
        {/* Display */}
        <div style={{
          background: "#0F172A",
          padding: "24px 20px 16px",
          textAlign: "right",
        }}>
          <div style={{ color: "#64748B", fontSize: 13, minHeight: 18, marginBottom: 4 }}>
            {prev !== null ? `${prev} ${op ?? ""}` : ""}
          </div>
          <div style={{
            color: "#fff",
            fontSize: display.length > 12 ? 22 : 36,
            fontWeight: 300,
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {display}
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "#E2E8F0",
        }}>
          {[
            { label: "AC",  action: clear,              type: "func" as const },
            { label: "+/-", action: toggleSign,          type: "func" as const },
            { label: "%",   action: percent,             type: "func" as const },
            { label: "÷",   action: () => pushOp("÷"),  type: "op"   as const },

            { label: "7",   action: () => pushDigit("7"), type: "num" as const },
            { label: "8",   action: () => pushDigit("8"), type: "num" as const },
            { label: "9",   action: () => pushDigit("9"), type: "num" as const },
            { label: "×",   action: () => pushOp("×"),    type: "op"  as const },

            { label: "4",   action: () => pushDigit("4"), type: "num" as const },
            { label: "5",   action: () => pushDigit("5"), type: "num" as const },
            { label: "6",   action: () => pushDigit("6"), type: "num" as const },
            { label: "-",   action: () => pushOp("-"),    type: "op"  as const },

            { label: "1",   action: () => pushDigit("1"), type: "num" as const },
            { label: "2",   action: () => pushDigit("2"), type: "num" as const },
            { label: "3",   action: () => pushDigit("3"), type: "num" as const },
            { label: "+",   action: () => pushOp("+"),    type: "op"  as const },

            { label: "⌫",   action: backspace,            type: "func" as const },
            { label: "0",   action: () => pushDigit("0"), type: "num"  as const },
            { label: ".",   action: () => pushDigit("."), type: "num"  as const },
            { label: "=",   action: equals,               type: "eq"   as const },
          ].map(({ label, action, type }) => {
            const bg = type === "op" ? "#F97316"
                     : type === "eq" ? "#EA580C"
                     : type === "func" ? "#F1F5F9"
                     : "#fff";
            const color = type === "op" || type === "eq" ? "#fff"
                        : type === "func" ? "#475569"
                        : "#0F172A";
            return (
              <button
                key={label}
                onClick={action}
                style={{
                  background: bg,
                  color,
                  border: "none",
                  padding: "18px 0",
                  fontSize: 18,
                  fontWeight: type === "eq" || type === "op" ? 600 : 400,
                  cursor: "pointer",
                  transition: "filter 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.92)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function compute(a: number, b: number, op: CalcOp): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 ? a / b : 0;
    default:  return b;
  }
}
