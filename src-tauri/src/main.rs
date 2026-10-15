#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fs;
mod pty;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(fs::WorkspaceState::default())
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            fs::ws_open, fs::ws_root, fs::fs_list, fs::fs_read, fs::fs_write,
            fs::fs_stat, fs::fs_mkdir, fs::fs_rename, fs::fs_delete,
            pty::pty_spawn, pty::pty_write, pty::pty_resize, pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running nightshift");
}
