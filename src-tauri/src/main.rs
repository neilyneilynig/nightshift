#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fs;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(fs::WorkspaceState::default())
        .invoke_handler(tauri::generate_handler![
            fs::ws_open, fs::ws_root, fs::fs_list, fs::fs_read, fs::fs_write,
            fs::fs_stat, fs::fs_mkdir, fs::fs_rename, fs::fs_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nightshift");
}
