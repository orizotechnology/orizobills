// =============================================================
// useWindowManager
//
// DIALOG STATE  (unauthenticated / setup):
//   500×620, no decorations, transparent, not resizable
//
// APP STATE (authenticated):
//   1440×900, decorations ON, resizable, min 1024×600
// =============================================================

import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

function isTauri(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

export async function expandToAppWindow(): Promise<void> {
  if (!isTauri()) return; // browser dev — no-op
  try {
    const win = getCurrentWindow();
    // Order matters: decorations first, then size/constraints
    await win.setDecorations(true);
    await win.setResizable(true);
    await win.setMinSize(new LogicalSize(1024, 600));
    await win.setSize(new LogicalSize(1440, 900));
    await win.center();
  } catch (err) {
    console.error("[WindowManager] expandToAppWindow failed:", err);
  }
}

export async function shrinkToDialogWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const win = getCurrentWindow();
    await win.setDecorations(false);
    await win.setResizable(false);
    await win.setMinSize(null);
    await win.setSize(new LogicalSize(500, 620));
    await win.center();
  } catch (err) {
    console.error("[WindowManager] shrinkToDialogWindow failed:", err);
  }
}
