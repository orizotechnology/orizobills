import { useEffect } from "react";

// =============================================================
// useDialogKeyboard
//
// When a confirmation dialog is open:
//   Enter → fires the confirm action (e.g. "Yes, Delete")
//   Escape → fires the cancel action (e.g. "No, Keep It")
//
// Usage:
//   useDialogKeyboard({
//     isOpen:    showConfirm,
//     onConfirm: handleConfirm,
//     onCancel:  () => setShowConfirm(false),
//     disabled:  isDeleting,   // prevent Enter during async op
//   });
// =============================================================

interface Options {
  isOpen:     boolean;
  onConfirm:  () => void;
  onCancel:   () => void;
  disabled?:  boolean;  // block Enter when an async op is in progress
}

export function useDialogKeyboard({ isOpen, onConfirm, onCancel, disabled }: Options) {
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !disabled) {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [isOpen, onConfirm, onCancel, disabled]);
}
