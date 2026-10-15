use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

pub fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from(".config"))
        .join("nightshift")
}

fn state_path() -> PathBuf {
    config_dir().join("state.json")
}

#[derive(Serialize, Debug)]
pub struct Loaded {
    pub state: Option<Value>,
    pub warning: Option<String>,
}

pub fn load_from(path: &Path) -> Loaded {
    let text = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) if e.kind() == ErrorKind::NotFound => return Loaded { state: None, warning: None },
        Err(e) => return Loaded { state: None, warning: Some(format!("could not read state: {e}")) },
    };
    match serde_json::from_str(&text) {
        Ok(v) => Loaded { state: Some(v), warning: None },
        Err(e) => {
            let _ = fs::rename(path, path.with_extension("json.corrupt"));
            Loaded {
                state: None,
                warning: Some(format!(
                    "state file was corrupt ({e}); starting fresh, old copy kept as state.json.corrupt"
                )),
            }
        }
    }
}

pub fn save_to(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn state_load() -> Loaded {
    load_from(&state_path())
}

#[tauri::command]
pub fn state_save(state: Value) -> Result<(), String> {
    save_to(&state_path(), &state)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_file_is_empty_without_warning() {
        let d = tempfile::tempdir().unwrap();
        let l = load_from(&d.path().join("state.json"));
        assert!(l.state.is_none() && l.warning.is_none());
    }

    #[test]
    fn corrupt_file_warns_and_is_set_aside() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("state.json");
        fs::write(&p, "{not json").unwrap();
        let l = load_from(&p);
        assert!(l.state.is_none());
        assert!(l.warning.unwrap().contains("corrupt"));
        assert!(d.path().join("state.json.corrupt").exists());
    }

    #[test]
    fn save_then_load_round_trip() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("nested/state.json");
        save_to(&p, &json!({"version": 1, "node": 2})).unwrap();
        assert_eq!(load_from(&p).state.unwrap()["node"], 2);
    }
}
