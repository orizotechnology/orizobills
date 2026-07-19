// =============================================================
// TAURI APPLICATION LIBRARY
// Add Tauri commands and plugins here as features are built.
// =============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register plugins here as needed
        // .plugin(tauri_plugin_shell::init())
        // .plugin(tauri_plugin_dialog::init())
        // Register commands here
        // .invoke_handler(tauri::generate_handler![])
        .setup(|_app| {
            // App setup — open main window, initialize state, etc.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
