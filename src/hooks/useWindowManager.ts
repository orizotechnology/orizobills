// =============================================================
// useWindowManager — no-op stubs (kept for import compatibility)
//
// Window decorations are permanently OFF (decorations: false in
// tauri.conf.json). The custom TitleBar component handles all
// window controls (minimize / maximize / close).
//
// These exports are kept so AuthGuard doesn't need changing,
// but they no longer do anything — the window is always the
// same size and the title bar is always shown by the app itself.
// =============================================================

export async function expandToAppWindow(): Promise<void> {
  // No longer needed — window starts full-size, TitleBar handles controls
}

export async function shrinkToDialogWindow(): Promise<void> {
  // No longer needed
}
