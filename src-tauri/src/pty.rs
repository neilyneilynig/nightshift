use crate::fs::WorkspaceState;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct Session {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct DataEvent {
    id: u32,
    data: Vec<u8>,
}

#[derive(Clone, Serialize)]
struct ExitEvent {
    id: u32,
    code: Option<u32>,
}

pub fn default_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "/bin/bash".into())
}

/// Spawn `shell` in a new PTY. `on_data` gets raw output chunks from a reader
/// thread; `on_eof` runs once when the PTY closes (shell exited or killed).
pub fn spawn_session(
    shell: &str,
    cwd: &Path,
    cols: u16,
    rows: u16,
    on_data: impl Fn(Vec<u8>) + Send + 'static,
    on_eof: impl FnOnce() + Send + 'static,
) -> Result<Session, String> {
    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;
    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("NIGHTSHIFT", "1");
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("cannot start {shell}: {e}"))?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break, // Linux returns EIO when the child side closes
                Ok(n) => on_data(buf[..n].to_vec()),
            }
        }
        on_eof();
    });
    Ok(Session { writer, master: pair.master, child })
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    ptys: State<PtyState>,
    ws: State<WorkspaceState>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<u32, String> {
    let dir: PathBuf = match cwd {
        Some(c) if !c.is_empty() => PathBuf::from(c),
        _ => ws
            .root()
            .ok()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("/")),
    };
    let id = ptys.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let data_app = app.clone();
    let exit_app = app.clone();
    let session = spawn_session(
        &default_shell(),
        &dir,
        cols.max(2),
        rows.max(2),
        move |data| {
            let _ = data_app.emit("pty-data", DataEvent { id, data });
        },
        move || {
            let state = exit_app.state::<PtyState>();
            let removed = state.sessions.lock().unwrap().remove(&id);
            let code = removed
                .and_then(|mut s| s.child.wait().ok())
                .map(|st| st.exit_code());
            let _ = exit_app.emit("pty-exit", ExitEvent { id, code });
        },
    )?;
    ptys.sessions.lock().unwrap().insert(id, session);
    Ok(id)
}

#[tauri::command(async)]
pub fn pty_write(ptys: State<PtyState>, id: u32, data: String) -> Result<(), String> {
    let mut map = ptys.sessions.lock().unwrap();
    let s = map.get_mut(&id).ok_or_else(|| format!("NO CARRIER: session {id}"))?;
    s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    s.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(ptys: State<PtyState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let map = ptys.sessions.lock().unwrap();
    let s = map.get(&id).ok_or_else(|| format!("NO CARRIER: session {id}"))?;
    s.master
        .resize(PtySize { rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(ptys: State<PtyState>, id: u32) {
    let removed = ptys.sessions.lock().unwrap().remove(&id);
    if let Some(mut s) = removed {
        // kill + reap off-thread: kill can poll for ~200 ms; the session lock is already released
        std::thread::spawn(move || {
            let _ = s.child.kill();
            let _ = s.child.wait();
        });
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    #[test]
    fn echo_round_trip_and_exit() {
        let (tx, rx) = mpsc::channel();
        let (etx, erx) = mpsc::channel();
        let mut s = spawn_session("/bin/sh", Path::new("/tmp"), 80, 24,
            move |d| { let _ = tx.send(d); },
            move || { let _ = etx.send(()); }).unwrap();
        // arithmetic so the echoed input line itself can't match
        s.writer.write_all(b"echo NIGHT$((1+1))SHIFT\nexit\n").unwrap();
        let mut out = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline && !String::from_utf8_lossy(&out).contains("NIGHT2SHIFT") {
            if let Ok(d) = rx.recv_timeout(Duration::from_millis(100)) { out.extend(d); }
        }
        assert!(String::from_utf8_lossy(&out).contains("NIGHT2SHIFT"));
        assert!(erx.recv_timeout(Duration::from_secs(5)).is_ok(), "eof after exit");
        assert_eq!(s.child.wait().unwrap().exit_code(), 0);
    }

    #[test]
    fn eof_fires_when_child_killed() {
        let (etx, erx) = mpsc::channel();
        let mut s = spawn_session("/bin/sh", Path::new("/tmp"), 80, 24, |_| {}, move || { let _ = etx.send(()); }).unwrap();
        s.child.kill().unwrap();
        assert!(erx.recv_timeout(Duration::from_secs(5)).is_ok());
    }

    #[test]
    fn bad_shell_is_an_error() {
        let r = spawn_session("/nonexistent/shell", Path::new("/tmp"), 80, 24, |_| {}, || {});
        assert!(r.is_err());
    }
}
