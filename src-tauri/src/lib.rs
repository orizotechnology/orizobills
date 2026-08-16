// =============================================================
// TAURI APPLICATION LIBRARY
// =============================================================

use std::process::Command;

/// Write bytes to the OS Downloads folder and open the file.
/// Returns the full path of the written file.
#[tauri::command]
fn save_and_open_file(filename: String, data: Vec<u8>) -> Result<String, String> {
    // Resolve Downloads directory
    let downloads = dirs_next::download_dir()
        .or_else(|| dirs_next::home_dir().map(|h| h.join("Downloads")))
        .ok_or_else(|| "Cannot find Downloads folder".to_string())?;

    std::fs::create_dir_all(&downloads)
        .map_err(|e| format!("Cannot create Downloads dir: {e}"))?;

    let path = downloads.join(&filename);
    std::fs::write(&path, &data)
        .map_err(|e| format!("Cannot write file: {e}"))?;

    // Open with default OS application
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&path).spawn().ok();
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&path).spawn().ok();
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&path).spawn().ok();

    Ok(path.to_string_lossy().to_string())
}

/// Open an existing file by its full path.
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&path).spawn()
        .map_err(|e| format!("Failed to open: {e}"))?;
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&path).spawn()
        .map_err(|e| format!("Failed to open: {e}"))?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(&path).spawn()
        .map_err(|e| format!("Failed to open: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_and_open_file, open_file])
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                // Lock size: no resizing allowed
                let _ = win.set_resizable(false);
                // Always start maximized
                let _ = win.maximize();
                // Re-maximize any time the window is somehow moved or un-maximized.
                // This is the definitive lock: covers drag, title bar double-click,
                // keyboard shortcuts, and any other OS-level move attempts.
                let win2 = win.clone();
                win.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            let _ = win2.maximize();
                        }
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
