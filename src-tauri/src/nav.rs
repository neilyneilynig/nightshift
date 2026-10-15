use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

/// The webview may only ever show the app itself (bundled assets or the Vite dev
/// server). Links from previewed files open in the system browser instead.
pub fn is_app_url(url: &Url) -> bool {
    match (url.scheme(), url.host_str()) {
        ("tauri", Some("localhost")) => true,
        ("http" | "https", Some("tauri.localhost")) => true,
        ("http", Some("localhost")) => url.port() == Some(1420),
        _ => false,
    }
}

pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navguard")
        .on_navigation(|_webview, url| is_app_url(url))
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> tauri::Url { s.parse().unwrap() }

    #[test]
    fn allows_only_the_app_origin() {
        assert!(is_app_url(&u("tauri://localhost/index.html")));
        assert!(is_app_url(&u("http://tauri.localhost/")));
        assert!(is_app_url(&u("http://localhost:1420/src/main.ts")));
        assert!(!is_app_url(&u("https://evil.example/")));
        assert!(!is_app_url(&u("http://localhost:8080/")));
        assert!(!is_app_url(&u("file:///etc/passwd")));
    }
}
