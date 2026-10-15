use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::State;

pub const MAX_READ_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Default)]
pub struct WorkspaceState(pub Mutex<Option<PathBuf>>);

impl WorkspaceState {
    pub fn root(&self) -> Result<PathBuf, String> {
        self.0
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "NO WORKSPACE: open a folder first (Ctrl+Alt+O)".to_string())
    }
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Serialize, Debug)]
pub struct Stat {
    pub mtime_ms: u64,
    pub size: u64,
    pub is_dir: bool,
}

/// Resolve a workspace-relative path to an absolute path inside `root`
/// (which must already be canonical). Follows symlinks; rejects escapes.
pub fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    for c in rel_path.components() {
        match c {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(format!("ACCESS DENIED: illegal path '{rel}'")),
        }
    }
    let joined = root.join(rel_path);
    let mut existing = joined.as_path();
    let mut tail = Vec::new();
    // symlink_metadata so a dangling symlink counts as existing (and then fails to canonicalize)
    while existing.symlink_metadata().is_err() {
        tail.push(existing.file_name().ok_or_else(|| format!("invalid path '{rel}'"))?);
        existing = existing.parent().ok_or_else(|| format!("invalid path '{rel}'"))?;
    }
    let mut real = existing
        .canonicalize()
        .map_err(|e| format!("ACCESS DENIED: '{rel}': {e}"))?;
    for part in tail.iter().rev() {
        real.push(part);
    }
    if !real.starts_with(root) {
        return Err(format!("ACCESS DENIED: '{rel}' is outside the workspace"));
    }
    Ok(real)
}

/// Like `resolve`, but does not follow a symlink in the final component,
/// so delete/rename act on the link itself. Refuses the workspace root.
fn resolve_entry(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    let name = rel_path
        .file_name()
        .ok_or_else(|| format!("ACCESS DENIED: cannot modify '{rel}'"))?;
    let parent = rel_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(resolve(root, &parent)?.join(name))
}

fn rel_of(root: &Path, abs: &Path) -> String {
    abs.strip_prefix(root)
        .unwrap_or(abs)
        .to_string_lossy()
        .replace('\\', "/")
}

pub fn stat_path(p: &Path) -> Result<Stat, String> {
    let m = fs::metadata(p).map_err(|e| format!("{}: {e}", p.display()))?;
    let mtime_ms = m
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(Stat { mtime_ms, size: m.len(), is_dir: m.is_dir() })
}

pub fn list_dir(root: &Path, rel: &str) -> Result<Vec<Entry>, String> {
    let dir = resolve(root, rel)?;
    let mut out = Vec::new();
    for item in fs::read_dir(&dir).map_err(|e| format!("{rel}: {e}"))? {
        let item = item.map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();
        if name == ".git" {
            continue;
        }
        let is_dir = item.path().is_dir();
        out.push(Entry { path: rel_of(root, &dir.join(&name)), name, is_dir });
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

pub fn read_text(root: &Path, rel: &str) -> Result<String, String> {
    let p = resolve(root, rel)?;
    let meta = fs::metadata(&p).map_err(|e| format!("{rel}: {e}"))?;
    if meta.is_dir() {
        return Err(format!("{rel} is a directory"));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(format!(
            "FILE TOO LARGE: {rel} is {:.1} MB (limit 5 MB)",
            meta.len() as f64 / 1_048_576.0
        ));
    }
    let bytes = fs::read(&p).map_err(|e| format!("{rel}: {e}"))?;
    String::from_utf8(bytes).map_err(|_| format!("BINARY DATA: {rel} is not UTF-8 text"))
}

pub fn write_text(root: &Path, rel: &str, content: &str) -> Result<Stat, String> {
    let p = resolve(root, rel)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("{rel}: {e}"))?;
    }
    fs::write(&p, content).map_err(|e| format!("{rel}: {e}"))?;
    stat_path(&p)
}

pub fn make_dir(root: &Path, rel: &str) -> Result<(), String> {
    fs::create_dir_all(resolve(root, rel)?).map_err(|e| format!("{rel}: {e}"))
}

pub fn rename_path(root: &Path, from: &str, to: &str) -> Result<(), String> {
    let a = resolve_entry(root, from)?;
    let b = resolve_entry(root, to)?;
    if b.symlink_metadata().is_ok() {
        return Err(format!("{to} already exists"));
    }
    fs::rename(&a, &b).map_err(|e| format!("rename {from} → {to}: {e}"))
}

pub fn delete_path(root: &Path, rel: &str) -> Result<(), String> {
    let p = resolve_entry(root, rel)?;
    let meta = p.symlink_metadata().map_err(|e| format!("{rel}: {e}"))?;
    if meta.file_type().is_dir() {
        fs::remove_dir_all(&p)
    } else {
        fs::remove_file(&p)
    }
    .map_err(|e| format!("delete {rel}: {e}"))
}

#[tauri::command]
pub fn ws_open(ws: State<WorkspaceState>, path: String) -> Result<String, String> {
    let p = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("{path}: {e}"))?;
    if !p.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    *ws.0.lock().unwrap() = Some(p.clone());
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn ws_root(ws: State<WorkspaceState>) -> Option<String> {
    ws.0.lock().unwrap().as_ref().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn fs_list(ws: State<WorkspaceState>, path: String) -> Result<Vec<Entry>, String> {
    list_dir(&ws.root()?, &path)
}

#[tauri::command]
pub fn fs_read(ws: State<WorkspaceState>, path: String) -> Result<String, String> {
    read_text(&ws.root()?, &path)
}

#[tauri::command]
pub fn fs_write(ws: State<WorkspaceState>, path: String, content: String) -> Result<Stat, String> {
    write_text(&ws.root()?, &path, &content)
}

#[tauri::command]
pub fn fs_stat(ws: State<WorkspaceState>, path: String) -> Result<Stat, String> {
    stat_path(&resolve(&ws.root()?, &path)?)
}

#[tauri::command]
pub fn fs_mkdir(ws: State<WorkspaceState>, path: String) -> Result<(), String> {
    make_dir(&ws.root()?, &path)
}

#[tauri::command]
pub fn fs_rename(ws: State<WorkspaceState>, from: String, to: String) -> Result<(), String> {
    rename_path(&ws.root()?, &from, &to)
}

#[tauri::command]
pub fn fs_delete(ws: State<WorkspaceState>, path: String) -> Result<(), String> {
    delete_path(&ws.root()?, &path)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;
    use std::path::PathBuf;

    fn ws() -> (tempfile::TempDir, PathBuf) {
        let d = tempfile::tempdir().unwrap();
        let root = d.path().canonicalize().unwrap();
        (d, root)
    }

    #[test]
    fn resolves_nested_new_file() {
        let (_d, root) = ws();
        assert_eq!(resolve(&root, "a/b/new.txt").unwrap(), root.join("a/b/new.txt"));
        assert_eq!(resolve(&root, "").unwrap(), root);
    }

    #[test]
    fn rejects_parent_dir_and_absolute() {
        let (_d, root) = ws();
        assert!(resolve(&root, "../etc/passwd").unwrap_err().contains("ACCESS DENIED"));
        assert!(resolve(&root, "a/../../x").is_err());
        assert!(resolve(&root, "/etc/passwd").is_err());
    }

    #[test]
    fn rejects_symlink_escape() {
        let (_d, root) = ws();
        let outside = tempfile::tempdir().unwrap();
        symlink(outside.path(), root.join("escape")).unwrap();
        assert!(resolve(&root, "escape/secret.txt").unwrap_err().contains("outside"));
    }

    #[test]
    fn rejects_dangling_symlink() {
        let (_d, root) = ws();
        symlink("/tmp/nightshift-does-not-exist-xyz/f", root.join("dangle")).unwrap();
        assert!(resolve(&root, "dangle").is_err());
    }

    #[test]
    fn list_sorts_dirs_first_and_hides_git() {
        let (_d, root) = ws();
        fs::write(root.join("b.txt"), "").unwrap();
        fs::write(root.join("A.txt"), "").unwrap();
        fs::create_dir(root.join("zdir")).unwrap();
        fs::create_dir(root.join(".git")).unwrap();
        let names: Vec<String> = list_dir(&root, "").unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["zdir", "A.txt", "b.txt"]);
        let nested = list_dir(&root, "zdir").unwrap();
        assert!(nested.is_empty());
    }

    #[test]
    fn read_rejects_binary() {
        let (_d, root) = ws();
        fs::write(root.join("bin"), [0xff, 0xfe, 0x00]).unwrap();
        assert!(read_text(&root, "bin").unwrap_err().contains("BINARY DATA"));
    }

    #[test]
    fn read_rejects_huge() {
        let (_d, root) = ws();
        let f = fs::File::create(root.join("big.log")).unwrap();
        f.set_len(MAX_READ_BYTES + 1).unwrap();
        assert!(read_text(&root, "big.log").unwrap_err().contains("FILE TOO LARGE"));
    }

    #[test]
    fn write_read_round_trip_with_spaces_and_unicode() {
        let (_d, root) = ws();
        let st = write_text(&root, "dir with space/ñ.txt", "héllo").unwrap();
        assert_eq!(st.size, "héllo".len() as u64);
        assert_eq!(read_text(&root, "dir with space/ñ.txt").unwrap(), "héllo");
        assert_eq!(list_dir(&root, "dir with space").unwrap()[0].path, "dir with space/ñ.txt");
    }

    #[test]
    fn delete_symlink_removes_link_not_target() {
        let (_d, root) = ws();
        fs::write(root.join("real.txt"), "x").unwrap();
        symlink(root.join("real.txt"), root.join("link.txt")).unwrap();
        delete_path(&root, "link.txt").unwrap();
        assert!(root.join("real.txt").exists());
        assert!(root.join("link.txt").symlink_metadata().is_err());
    }

    #[test]
    fn refuses_to_delete_or_rename_root() {
        let (_d, root) = ws();
        assert!(delete_path(&root, "").is_err());
        assert!(delete_path(&root, ".").is_err());
        assert!(rename_path(&root, "", "x").is_err());
    }

    #[test]
    fn rename_refuses_to_overwrite() {
        let (_d, root) = ws();
        fs::write(root.join("a"), "1").unwrap();
        fs::write(root.join("b"), "2").unwrap();
        assert!(rename_path(&root, "a", "b").unwrap_err().contains("exists"));
        rename_path(&root, "a", "c").unwrap();
        assert_eq!(fs::read_to_string(root.join("c")).unwrap(), "1");
    }
}
