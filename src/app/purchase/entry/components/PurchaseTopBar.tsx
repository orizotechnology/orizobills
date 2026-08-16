import { useState, useEffect } from "react";
import { Settings, Maximize2, X, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDialogKeyboard } from "@/hooks";

// =============================================================
// PURCHASE TOP BAR — mirrors PosTopBar styling
// Shows: Logo | spacer | BILL # / DATE / TIME | Settings | Fullscreen | Close
// =============================================================

interface PurchaseTopBarProps {
  billNo:   string;
  billDate: string;          // YYYY-MM-DD
  isDirty?: boolean;         // true when form has unsaved items
  onClose?: () => void;      // override close behaviour (optional)
}

export function PurchaseTopBar({ billNo, billDate, isDirty = false, onClose }: PurchaseTopBarProps) {
  const navigate = useNavigate();
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live clock
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()
  );
  useEffect(() => {
    const t = setInterval(() =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()),
    30_000);
    return () => clearInterval(t);
  }, []);

  // Format display date from YYYY-MM-DD → DD/MM/YYYY
  const displayDate = billDate
    ? billDate.split("-").reverse().join("/")
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* Tauri — ignore */ }
  };

  const handleClose = () => {
    if (onClose) { onClose(); return; }
    if (isDirty) setShowConfirm(true);
    else navigate("/app/purchase/all");
  };

  // Enter = confirm, Escape = cancel
  useDialogKeyboard({
    isOpen:    showConfirm,
    onConfirm: () => { setShowConfirm(false); navigate("/app/purchase/all"); },
    onCancel:  () => setShowConfirm(false),
  });

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 16,
        padding: "0 14px",
        height: 48,
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}>

        {/* LEFT: Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "2px solid #E2E8F0", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff",
          }}>
            <img src="/logo.png" alt="Logo"
              style={{ width: 28, height: 28, objectFit: "contain" }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                const p = el.parentElement;
                if (p) { p.style.background = "#F97316"; p.innerHTML = `<span style="color:#fff;font-weight:800;font-size:13px">O</span>`; }
              }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#F97316", lineHeight: 1.2 }}>Orizo Bills</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", marginTop: 1 }}>PURCHASE BILL</div>
          </div>
        </div>

        {/* CENTER: spacer */}
        <div />

        {/* RIGHT: Bill info pill + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Bill # / Date / Time pill */}
          <div style={{
            display: "flex", alignItems: "center",
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 8, height: 30,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>BILL</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#F97316", whiteSpace: "nowrap" }}>{billNo}</span>
            </div>
            <div style={{ width: 1, height: 16, background: "#E2E8F0", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>DATE</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap" }}>{displayDate}</span>
            </div>
            <div style={{ width: 1, height: 16, background: "#E2E8F0", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>TIME</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap" }}>{time}</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "#E2E8F0", margin: "0 4px", flexShrink: 0 }} />

          {/* Settings */}
          <button onClick={() => navigate("/app/settings/general")} style={iconBtn} title="Settings">
            <Settings size={15} strokeWidth={1.8} color="#64748B" />
          </button>

          {/* Fullscreen toggle */}
          <button onClick={() => void toggleFullscreen()} style={iconBtn}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            <Maximize2 size={15} strokeWidth={1.8} color={isFullscreen ? "#F97316" : "#64748B"} />
          </button>

          {/* Close */}
          <button onClick={handleClose} style={iconBtn} title="Close Purchase">
            <X size={16} strokeWidth={2} color="#EF4444" />
          </button>
        </div>
      </div>

      {/* Confirm close dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
              justifyContent: "center", padding: 24 }}>
            <motion.div
              initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #F1F5F9",
                display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFF7ED",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle size={20} color="#F97316" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Discard Purchase?</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Unsaved items will be lost</div>
                </div>
              </div>
              <div style={{ padding: "16px 22px 20px" }}>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
                  You have <strong style={{ color: "#F97316" }}>unsaved items</strong> on this bill.
                  Going back will discard them.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowConfirm(false)}
                    style={{ flex: 1, padding: "11px 0", border: "1px solid #E2E8F0", borderRadius: 10,
                      background: "#fff", color: "#475569", fontSize: 14, fontWeight: 500,
                      cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    Keep Editing
                  </button>
                  <button onClick={() => { setShowConfirm(false); navigate("/app/purchase/all"); }}
                    style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 10,
                      background: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    Yes, Discard
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", borderRadius: 8,
  cursor: "pointer", outline: "none",
};
