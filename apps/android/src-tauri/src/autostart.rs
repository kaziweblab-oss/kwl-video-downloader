//! Startup on Windows sign-in (auto-launch) via registry Run key.
//! No extra crate needed — uses `reg` command. Works for Windows currentUser.

#[cfg(windows)]
use std::process::Command;

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "KWL Video Downloader";

fn exe_path_for_run() -> Option<String> {
    std::env::current_exe().ok().map(|p| p.to_string_lossy().to_string())
}

#[cfg(windows)]
fn reg_query_enabled() -> bool {
    let out = Command::new("reg")
        .args(["query", RUN_KEY, "/v", VALUE_NAME])
        .output();
    match out {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

#[cfg(not(windows))]
fn reg_query_enabled() -> bool {
    false
}

pub fn is_autostart_enabled_impl() -> bool {
    reg_query_enabled()
}

pub fn set_autostart_enabled_impl(enabled: bool) -> Result<bool, String> {
    #[cfg(not(windows))]
    {
        let _ = enabled;
        return Err("Autostart is supported on Windows only".to_string());
    }
    #[cfg(windows)]
    {
        if enabled {
            let exe = exe_path_for_run().ok_or_else(|| "Unable to resolve executable path".to_string())?;
            // quote path for Run key
            let data = format!("\"{}\"", exe);
            let status = Command::new("reg")
                .args(["add", RUN_KEY, "/v", VALUE_NAME, "/t", "REG_SZ", "/d", &data, "/f"])
                .output()
                .map_err(|e| format!("Failed to enable autostart: {}", e))?;
            if !status.status.success() {
                let err = String::from_utf8_lossy(&status.stderr);
                return Err(format!("reg add failed: {}", err));
            }
            Ok(true)
        } else {
            let status = Command::new("reg")
                .args(["delete", RUN_KEY, "/v", VALUE_NAME, "/f"])
                .output()
                .map_err(|e| format!("Failed to disable autostart: {}", e))?;
            // delete returns error if not exists — treat as success (already disabled)
            if status.status.success() {
                Ok(false)
            } else {
                let stderr = String::from_utf8_lossy(&status.stderr).to_ascii_lowercase();
                if stderr.contains("unable to find") || stderr.contains("not found") {
                    Ok(false)
                } else {
                    // still consider disabled
                    Ok(false)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn run_key_constants_not_empty() {
        assert!(!super::RUN_KEY.is_empty());
        assert!(!super::VALUE_NAME.is_empty());
        assert!(super::RUN_KEY.contains("Run"));
    }
}
