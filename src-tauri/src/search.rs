use crate::fs::WorkspaceState;
use ignore::WalkBuilder;
use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::State;

pub const FILE_CAP: usize = 20_000;
pub const HIT_CAP: usize = 500;

#[derive(Serialize, Debug, PartialEq)]
pub struct Hit {
    pub path: String,
    pub line: u32,
    pub text: String,
}

pub fn list_files(root: &Path, cap: usize) -> Vec<String> {
    let mut out = Vec::new();
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .require_git(false)
        .filter_entry(|e| e.file_name() != ".git")
        .build();
    for entry in walker.flatten() {
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            if let Ok(rel) = entry.path().strip_prefix(root) {
                out.push(rel.to_string_lossy().replace('\\', "/"));
                if out.len() >= cap {
                    break;
                }
            }
        }
    }
    out
}

/// Parse one line of `rg --null --line-number` output: `path\0line:text`.
pub fn parse_rg_line(line: &str) -> Option<Hit> {
    let (path, rest) = line.split_once('\0')?;
    let (num, text) = rest.split_once(':')?;
    Some(Hit {
        path: path.trim_start_matches("./").to_string(),
        line: num.parse().ok()?,
        text: text.trim_end().chars().take(300).collect(),
    })
}

pub fn grep(root: &Path, query: &str) -> Result<Vec<Hit>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let out = Command::new("rg")
        .current_dir(root)
        .args([
            "--null", "--line-number", "--no-heading", "--color", "never",
            "--fixed-strings", "--smart-case", "--max-count", "20", "--max-columns", "300", "--",
        ])
        .arg(query)
        .arg(".")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "MODULE NOT INSTALLED: ripgrep (pacman -S ripgrep)".to_string()
            } else {
                e.to_string()
            }
        })?;
    match out.status.code() {
        Some(0) | Some(1) => {}
        _ => return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()),
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(parse_rg_line)
        .take(HIT_CAP)
        .collect())
}

#[tauri::command(async)]
pub fn search_files(ws: State<WorkspaceState>) -> Result<Vec<String>, String> {
    Ok(list_files(&ws.root()?, FILE_CAP))
}

#[tauri::command(async)]
pub fn search_text(ws: State<WorkspaceState>, query: String) -> Result<Vec<Hit>, String> {
    grep(&ws.root()?, &query)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_rg_null_lines() {
        let h = parse_rg_line("./src/a b.rs\012:  let x = 1;").unwrap();
        assert_eq!(h, Hit { path: "src/a b.rs".into(), line: 12, text: "  let x = 1;".into() });
        assert!(parse_rg_line("garbage").is_none());
    }

    #[test]
    fn list_files_respects_gitignore_and_cap() {
        let d = tempfile::tempdir().unwrap();
        let root = d.path();
        fs::write(root.join(".gitignore"), "ignored/\n").unwrap();
        fs::create_dir(root.join("ignored")).unwrap();
        fs::write(root.join("ignored/x.txt"), "").unwrap();
        fs::create_dir(root.join(".git")).unwrap();
        fs::write(root.join(".git/HEAD"), "").unwrap();
        for i in 0..5 { fs::write(root.join(format!("f{i}.txt")), "").unwrap(); }
        let all = list_files(root, 100);
        assert!(all.contains(&"f0.txt".to_string()));
        assert!(!all.iter().any(|p| p.starts_with("ignored/") || p.starts_with(".git/")));
        assert_eq!(list_files(root, 3).len(), 3);
    }

    #[test]
    fn grep_finds_text() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("a.txt"), "one\nneon samurai\n").unwrap();
        let hits = grep(d.path(), "samurai").unwrap();
        assert_eq!(hits, vec![Hit { path: "a.txt".into(), line: 2, text: "neon samurai".into() }]);
        assert!(grep(d.path(), "nothing-here-zz").unwrap().is_empty());
        assert!(grep(d.path(), "  ").unwrap().is_empty());
    }
}
