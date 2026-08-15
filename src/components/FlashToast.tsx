import { useEffect, useState } from "react";
import { CheckCircle2, PencilLine } from "lucide-react";

type FlashType = "saved" | "changed";

interface FlashToastProps {
  message: string;
  type: FlashType;
  onDone?: () => void;
  duration?: number;
}

export default function FlashToast({
  message,
  type,
  onDone,
  duration = 1800,
}: FlashToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration);
    const removeTimer = setTimeout(() => onDone?.(), duration + 250);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onDone]);

  const isSaved = type === "saved";

  return (
    <div
      className={exiting ? "flash-toast-exit" : "flash-toast-enter"}
      style={{
        position: "fixed",
        top: 20,
        right: 24,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        background: isSaved ? "#16A34A" : "#F97316",
        color: "#fff",
      }}
    >
      {isSaved ? (
        <CheckCircle2 size={16} />
      ) : (
        <PencilLine size={16} />
      )}
      {message}
    </div>
  );
}