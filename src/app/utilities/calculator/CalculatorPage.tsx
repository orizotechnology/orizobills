import React, { useState, useEffect, useCallback } from "react";

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  const inputDigit = useCallback(
    (digit) => {
      if (waitingForNext) {
        setDisplay(digit);
        setWaitingForNext(false);
      } else {
        setDisplay(display === "0" ? digit : display + digit);
      }
    },
    [display, waitingForNext]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForNext) {
      setDisplay("0.");
      setWaitingForNext(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }, [display, waitingForNext]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setWaitingForNext(false);
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((d) => (d.charAt(0) === "-" ? d.slice(1) : "-" + d));
  }, []);

  const inputPercent = useCallback(() => {
    setDisplay((d) => String(parseFloat(d) / 100));
  }, []);

  const backspace = useCallback(() => {
    setDisplay((d) => {
      if (d.length === 1 || (d.length === 2 && d.charAt(0) === "-")) return "0";
      return d.slice(0, -1);
    });
  }, []);

  const calculate = (a, b, op) => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const formatResult = (num) => {
    if (Number.isNaN(num)) return "Error";
    if (!Number.isFinite(num)) return "Error";
    const rounded = Math.round(num * 1e10) / 1e10;
    return String(rounded);
  };

  const performOperator = useCallback(
    (nextOperator) => {
      const inputValue = parseFloat(display);

      if (prevValue === null) {
        setPrevValue(inputValue);
      } else if (operator && !waitingForNext) {
        const result = calculate(prevValue, inputValue, operator);
        setDisplay(formatResult(result));
        setPrevValue(Number.isNaN(result) ? null : result);
      }

      setWaitingForNext(true);
      setOperator(nextOperator);
    },
    [display, prevValue, operator, waitingForNext]
  );

  const performEquals = useCallback(() => {
    const inputValue = parseFloat(display);
    if (operator === null || prevValue === null) return;
    const result = calculate(prevValue, inputValue, operator);
    setDisplay(formatResult(result));
    setPrevValue(null);
    setOperator(null);
    setWaitingForNext(true);
  }, [display, prevValue, operator]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      const { key } = e;

      if (key >= "0" && key <= "9") {
        e.preventDefault();
        inputDigit(key);
        return;
      }

      switch (key) {
        case ".":
          e.preventDefault();
          inputDecimal();
          break;
        case "+":
          e.preventDefault();
          performOperator("+");
          break;
        case "-":
          e.preventDefault();
          performOperator("-");
          break;
        case "*":
        case "x":
        case "X":
          e.preventDefault();
          performOperator("×");
          break;
        case "/":
          e.preventDefault();
          performOperator("÷");
          break;
        case "Enter":
        case "=":
          e.preventDefault();
          performEquals();
          break;
        case "Backspace":
          e.preventDefault();
          backspace();
          break;
        case "Delete":
        case "Escape":
          e.preventDefault();
          clearAll();
          break;
        case "%":
          e.preventDefault();
          inputPercent();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputDigit, inputDecimal, performOperator, performEquals, backspace, clearAll, inputPercent]);

  const isActiveOp = (op) => operator === op && waitingForNext;

  const keyBase = {
    height: 70,
    fontSize: 22,
    fontWeight: 500,
    border: "1px solid #eef0f5",
    background: "#ffffff",
    color: "#1a1f36",
    cursor: "pointer",
    outline: "none",
    transition: "filter 0.15s ease",
  };

  const grayKey = {
    ...keyBase,
    background: "#eef1f8",
    color: "#4b5468",
  };

  const orangeKey = (active) => ({
    ...keyBase,
    background: active ? "#c9520f" : "#f0791f",
    color: "#ffffff",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7fb",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 320,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(20,24,40,0.08)",
          border: "1px solid #eceef4",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#fbe4d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🧮
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#1a1f36" }}>
              Calculator
            </div>
            <div style={{ fontSize: 12, color: "#8a91a6" }}>
              Quick calculations while billing
            </div>
          </div>
        </div>

        {/* Display */}
        <div
          style={{
            background: "#131a2c",
            color: "#ffffff",
            minHeight: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 20px",
          }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 400,
              wordBreak: "break-all",
              overflowWrap: "anywhere",
              textAlign: "right",
            }}
          >
            {display}
          </span>
        </div>

        {/* Keypad */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1,
            background: "#eef0f5",
          }}
        >
          <button style={grayKey} onClick={clearAll}>AC</button>
          <button style={grayKey} onClick={toggleSign}>+/-</button>
          <button style={grayKey} onClick={inputPercent}>%</button>
          <button style={orangeKey(isActiveOp("÷"))} onClick={() => performOperator("÷")}>÷</button>

          <button style={keyBase} onClick={() => inputDigit("7")}>7</button>
          <button style={keyBase} onClick={() => inputDigit("8")}>8</button>
          <button style={keyBase} onClick={() => inputDigit("9")}>9</button>
          <button style={orangeKey(isActiveOp("×"))} onClick={() => performOperator("×")}>×</button>

          <button style={keyBase} onClick={() => inputDigit("4")}>4</button>
          <button style={keyBase} onClick={() => inputDigit("5")}>5</button>
          <button style={keyBase} onClick={() => inputDigit("6")}>6</button>
          <button style={orangeKey(isActiveOp("-"))} onClick={() => performOperator("-")}>-</button>

          <button style={keyBase} onClick={() => inputDigit("1")}>1</button>
          <button style={keyBase} onClick={() => inputDigit("2")}>2</button>
          <button style={keyBase} onClick={() => inputDigit("3")}>3</button>
          <button style={orangeKey(isActiveOp("+"))} onClick={() => performOperator("+")}>+</button>

          <button style={grayKey} onClick={backspace}>⌫</button>
          <button style={keyBase} onClick={() => inputDigit("0")}>0</button>
          <button style={keyBase} onClick={inputDecimal}>.</button>
          <button style={{ ...keyBase, background: "#dd5a11", color: "#fff" }} onClick={performEquals}>=</button>
        </div>
      </div>
    </div>
  );
}