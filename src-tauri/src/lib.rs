// =============================================================
// TAURI APPLICATION LIBRARY
//
// Transparent background is configured in tauri.conf.json:
//   "transparent": true
//   "backgroundColor": "#00000000"
//
// This allows the auth/login dialog to float with no white
// WebView background behind it. AuthGuard restores the
// background to #F8FAFC after login via inline style on <html>.
// =============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
