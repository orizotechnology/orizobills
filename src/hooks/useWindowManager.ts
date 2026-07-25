// =============================================================
// useWindowManager
//
// Manages the Tauri window state transition:
//
//   DIALOG STATE (unauthenticated):
//     - 500×620, no decorations, transparent, not resizable
//     - Just the floating login/setup card
//
//   APP STATE (authenticated):
//     - 1440×900, decorations ON, #F8FAFC background, resizable
//     - Full normal application window
//
// Works in both Tauri (uses __TAURI__ API) and browser dev
// (no-op so the app still works in browser without crashing).
// =============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tauri = () => (window as any).__TAURI_INTERNALS__ ?? (window as any).__TAURI__ ?? null;

async function invoke(cmd: string, args?: Record<string, unknown>) {
  const t = tauri();
  if (!t) return; // browser dev mode — skip
  try {
    // Tauri v2 uses window.__TAURI_INTERNALS__.invoke
    if (t.invoke) return await t.invoke(cmd, args);
    // Tauri v1 fallback
    if (t.tauri?.invoke) return await t.tauri.invoke(cmd, args);
  } catch {
    /* ignore — window API might not be available yet */
  }
}

export async function expandToAppWindow() {
  const t = tauri();
  if (!t) return; // browser — no-op

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    // 1. Enable decorations (title bar + min/max/close)
    await win.setDecorations(true);

    // 2. Make resizable
    await win.setResizable(true);

    // 3. Set min size for the app
    await win.setMinSize({ type: "Logical", width: 1024, height: 600 });

    // 4. Resize to full app dimensions
    await win.setSize({ type: "Logical", width: 1440, height: 900 });

    // 5. Center on screen
    await win.center();

    // 6. Ensure it's not transparent anymore (solid background)
    // Background color is handled by CSS (#F8FAFC set by AuthGuard)

  } catch {
    // @tauri-apps/api not available in browser — use IPC fallback
    await invoke("plugin:window|set_decorations", { decorations: true });
    await invoke("plugin:window|set_resizable", { resizable: true });
    await invoke("plugin:window|set_size", { size: { type: "Logical", width: 1440, height: 900 } });
    await invoke("plugin:window|center");
  }
}

export async function shrinkToDialogWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setDecorations(false);
    await win.setResizable(false);
    await win.setMinSize(null);
    await win.setSize({ type: "Logical", width: 500, height: 620 });
    await win.center();
  } catch { /* browser or no permission */ }
}
