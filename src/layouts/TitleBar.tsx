import { useState, useEffect } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";

// =============================================================
// CUSTOM TITLE BAR
//
// Replaces the OS title bar since decorations: false in Tauri.
// Shows only when the user is authenticated (app is open).
//
// - Drag region: covers the entire bar EXCEPT the buttons
// - Minimize / Maximize-toggle / Close via @tauri-apps/api
// - Falls back gracefully in browser (buttons hidden)
// =============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTauri = () => !!(window as any).__TAURI_INTERNALS__;

async function getWin() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [inTauri] = useState(isTauri);

  // Track maximized state
  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const win = await getWin();
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setIsMaximized(await win.isMaximized());
        });
      } catch { /* browser */ }
    })();
    return () => { unlisten?.(); };
  }, [inTauri]);

  const handleMinimize = async () => {
    try { (await getWin()).minimize(); } catch { /* browser */ }
  };

  const handleMaximize = async () => {
    try {
      const win = await getWin();
      if (await win.isMaximized()) await win.unmaximize();
      else await win.maximize();
    } catch { /* browser */ }
  };

  const handleClose = async () => {
    try { (await getWin()).close(); } catch { /* browser */ }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 32,
        background: "#ffffff",   // white — matches the TopBar
        borderBottom: "1px solid #E2E8F0",
        flexShrink: 0,
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
        zIndex: 1000,
      }}
    >
      {/* Drag region */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          cursor: "default",
        }}
      >
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#94A3B8",
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}>
          Orizo Bills
        </span>
      </div>

      {/* Window controls */}
      {inTauri && (
        <div style={{ display: "flex", alignItems: "center", height: "100%", flexShrink: 0 }}>
          <WinBtn onClick={handleMinimize} label="Minimize" hoverBg="#F1F5F9">
            <Minus size={14} strokeWidth={2} color="currentColor" />
          </WinBtn>
          <WinBtn onClick={handleMaximize} label={isMaximized ? "Restore" : "Maximize"} hoverBg="#F1F5F9">
            {isMaximized
              ? <Maximize2 size={12} strokeWidth={2} color="currentColor" />
              : <Square size={11} strokeWidth={2} color="currentColor" />
            }
          </WinBtn>
          <WinBtn onClick={handleClose} label="Close" hoverBg="#EF4444" isClose>
            <X size={14} strokeWidth={2} color="currentColor" />
          </WinBtn>
        </div>
      )}
    </div>
  );
}

function WinBtn({
  children, onClick, label, hoverBg, isClose = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  hoverBg: string;
  isClose?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? hoverBg : "transparent",
        border: "none",
        cursor: "pointer",
        // On close hover → icon turns white; others keep dark
        color: hovered && isClose ? "#fff" : "#64748B",
        transition: "background 0.1s, color 0.1s",
        outline: "none",
        flexShrink: 0,
      }}
    >
      {/* Re-render children with correct color via CSS currentColor */}
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "inherit" }}>
        {children}
      </span>
    </button>
  );
}

