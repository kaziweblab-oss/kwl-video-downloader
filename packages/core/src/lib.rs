// packages/core/src/lib.rs - Shared Rust core (re-used by all platforms)
// This is a lightweight shared crate. Real implementation lives in apps/desktop/src-tauri/src/lib.rs
// Platform apps (android/linux/macos) can depend on this via path = "../../../packages/core"

pub const APP_NAME: &str = "KWL Video Downloader";
pub const APP_VERSION: &str = "1.0.3";
pub const IDENTIFIER: &str = "com.kwl.videodownloader";

pub fn platform_name() -> &'static str {
    #[cfg(target_os = "windows")]
    return "windows";
    #[cfg(target_os = "linux")]
    return "linux";
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(target_os = "android")]
    return "android";
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos", target_os = "android")))]
    return "unknown";
}
