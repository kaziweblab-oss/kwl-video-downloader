use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
fn cmd_hidden<S: AsRef<std::ffi::OsStr>>(prog: S) -> Command {
    use std::os::windows::process::CommandExt;
    let mut c = Command::new(prog);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[cfg(not(windows))]
fn cmd_hidden<S: AsRef<std::ffi::OsStr>>(prog: S) -> Command {
    Command::new(prog)
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ToolEntry {
    pub name: String,
    pub version: String,
    pub executable: String,
    pub path: Option<String>,
    pub platform: String,
    pub arch: String,
    pub checksum: Option<String>,
    pub installed_at: Option<String>,
    pub status: String, // healthy | missing | corrupt | outdated
    pub health_checked_at: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ToolManifest {
    pub version: u32,
    pub tools: HashMap<String, ToolEntry>,
    pub last_check: Option<String>,
}

impl Default for ToolManifest {
    fn default() -> Self {
        Self { version: 1, tools: HashMap::new(), last_check: None }
    }
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct ToolStatusResponse {
    pub name: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub status: String,
    pub health: String,
    pub last_check: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct AllToolsStatus {
    pub tools: Vec<ToolStatusResponse>,
    pub last_check: Option<String>,
    pub update_available: bool,
    pub active_download_protected: bool,
}

fn now_iso() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{}", secs)
}

pub fn tools_base_dir() -> Option<PathBuf> {
    // Prefer managed tools dir under AppData, fallback to temp for tests
    if let Ok(custom) = std::env::var("KWL_TOOLS_DIR") {
        if !custom.trim().is_empty() {
            return Some(PathBuf::from(custom));
        }
    }
    std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("LOCALAPPDATA"))
        .map(|base| PathBuf::from(base).join("KWL Video Downloader").join("tools"))
}

pub fn tool_dir(name: &str) -> Option<PathBuf> {
    tools_base_dir().map(|b| b.join(name))
}

pub fn current_dir(name: &str) -> Option<PathBuf> {
    tool_dir(name).map(|p| p.join("current"))
}

pub fn previous_dir(name: &str) -> Option<PathBuf> {
    tool_dir(name).map(|p| p.join("previous"))
}

pub fn staging_dir(name: &str) -> Option<PathBuf> {
    tool_dir(name).map(|p| p.join("staging"))
}

pub fn manifest_path() -> Option<PathBuf> {
    tools_base_dir().map(|b| b.join("manifest.json"))
}

fn executable_name(tool: &str) -> String {
    match tool {
        "yt-dlp" => {
            if cfg!(windows) { "yt-dlp.exe".to_string() } else { "yt-dlp".to_string() }
        }
        "ffmpeg" => {
            if cfg!(windows) { "ffmpeg.exe".to_string() } else { "ffmpeg".to_string() }
        }
        "ffprobe" => {
            if cfg!(windows) { "ffprobe.exe".to_string() } else { "ffprobe".to_string() }
        }
        _ => tool.to_string(),
    }
}

fn expected_args(tool: &str) -> Vec<&'static str> {
    match tool {
        "yt-dlp" => vec!["--version"],
        "ffmpeg" => vec!["-version"],
        "ffprobe" => vec!["-version"],
        _ => vec!["--version"],
    }
}

pub fn read_manifest() -> ToolManifest {
    if let Some(path) = manifest_path() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(m) = serde_json::from_str::<ToolManifest>(&content) {
                return m;
            }
        }
    }
    ToolManifest::default()
}

pub fn write_manifest(manifest: &ToolManifest) {
    if let Some(path) = manifest_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string_pretty(manifest) {
            let _ = fs::write(path, content);
        }
    }
}

pub fn health_check_executable(path: &Path, tool: &str) -> bool {
    if !path.is_file() {
        return false;
    }
    let args = expected_args(tool);
    // Avoid executing arbitrary path if not in managed dir or not absolute? For health, we allow managed + PATH fallback
    // Basic validation: must be file and executable
    match cmd_hidden(path).args(&args).output() {
        Ok(o) => o.status.success() && !String::from_utf8_lossy(&o.stdout).trim().is_empty(),
        Err(_) => false,
    }
}

pub fn resolve_managed_tool_path(tool: &str) -> Option<PathBuf> {
    if let Some(dir) = current_dir(tool) {
        let exe = dir.join(executable_name(tool));
        if exe.is_file() {
            return Some(exe);
        }
    }
    None
}

// -- Bundled native tools (used on Android, where yt-dlp + FFmpeg ship inside the APK) --

/// Directory that holds the bundled native tools for the current app data base.
/// On Android the app host extracts `assets/native_tools/*` into `<app_data>/native_tools`.
pub fn bundled_native_tools_dir(app_data_base: &Path) -> PathBuf {
    app_data_base.join("native_tools")
}

/// Make a file executable (chmod 755). No-op on non-Unix platforms (e.g. Windows).
pub fn make_executable(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(path, perms)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}

/// Copy a bundled native tool binary into place and mark it executable (idempotent).
pub fn install_bundled_native_tool(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_file() {
        return Err(format!("bundled tool asset not found: {}", src.display()));
    }
    if dest.is_file() {
        if health_check_executable(dest, &tool_name_from_path(dest)) {
            return Ok(());
        }
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create tool dir: {}", e))?;
    }
    fs::copy(src, dest).map_err(|e| format!("failed to copy bundled tool: {}", e))?;
    make_executable(dest).map_err(|e| format!("failed to mark tool executable: {}", e))?;
    Ok(())
}

fn tool_name_from_path(path: &Path) -> String {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    name.trim_end_matches(".exe").to_string()
}

/// Relative path of a bundled tool inside the packaged `assets/native_tools/`
/// folder (e.g. `native_tools/yt-dlp` or `native_tools/yt-dlp.exe`).
/// Used when reading the bundled tools out of the APK's asset bundle.
pub fn bundled_tool_asset_relative_path(tool: &str) -> PathBuf {
    Path::new("native_tools").join(executable_name(tool))
}

/// Resolve a bundled native tool binary under an app data base directory, if present.
pub fn resolve_bundled_tool_path(tool: &str, app_data_base: &Path) -> Option<PathBuf> {
    let dir = bundled_native_tools_dir(app_data_base);
    let exe = dir.join(executable_name(tool));
    if exe.is_file() {
        Some(exe)
    } else {
        None
    }
}

// Base directory (app data dir) that contains the `native_tools` folder.
// On Android the app host extracts the APK's `assets/native_tools/*` here and marks them executable.
// Set once from Tauri setup so it is available to every resolver without threading a handle around.
static BUNDLED_TOOLS_BASE: OnceLock<Option<PathBuf>> = OnceLock::new();

pub fn set_bundled_tools_base(base: Option<PathBuf>) {
    let _ = BUNDLED_TOOLS_BASE.set(base);
}

/// The configured `native_tools` directory, if the base was provided at startup.
pub fn bundled_tools_dir() -> Option<PathBuf> {
    BUNDLED_TOOLS_BASE
        .get()
        .and_then(|base| base.as_ref().map(|b| bundled_native_tools_dir(b)))
}

/// Resolve a bundled native tool binary shipping inside the packaged resources, if extracted.
pub fn resolve_bundled_tool(tool: &str) -> Option<PathBuf> {
    bundled_tools_dir()
        .and_then(|dir| {
            let exe = dir.join(executable_name(tool));
            if exe.is_file() {
                Some(exe)
            } else {
                None
            }
        })
}

pub fn get_tool_status(tool: &str) -> ToolStatusResponse {
    let manifest = read_manifest();
    let entry = manifest.tools.get(tool);
    let managed_path = resolve_managed_tool_path(tool);
    // Prefer managed path, else fallback to entry path
    let path = managed_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .or_else(|| entry.and_then(|e| e.path.clone()));

    let candidate_path: Option<PathBuf> = managed_path.clone().or_else(|| entry.and_then(|e| e.path.clone()).map(PathBuf::from));
    let (health, version) = if let Some(p) = candidate_path.as_ref() {
        let ok = health_check_executable(p, tool);
        let ver = if ok {
            get_version_for_path(p, tool)
        } else {
            entry.map(|e| e.version.clone())
        };
        (if ok { "healthy".to_string() } else { "corrupt".to_string() }, ver)
    } else {
        ("missing".to_string(), entry.map(|e| e.version.clone()))
    };

    let status = entry.map(|e| e.status.clone()).unwrap_or_else(|| health.clone());

    ToolStatusResponse {
        name: tool.to_string(),
        version,
        path,
        status,
        health,
        last_check: manifest.last_check.clone(),
    }
}

fn get_version_for_path(path: &Path, tool: &str) -> Option<String> {
    let args = expected_args(tool);
    cmd_hidden(path)
        .args(&args)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let out = String::from_utf8_lossy(&o.stdout).trim().to_string();
                // Take first line for ffmpeg
                let ver = out.lines().next().unwrap_or(&out).trim().to_string();
                if ver.is_empty() { None } else { Some(ver) }
            } else {
                None
            }
        })
}

pub fn all_tools_status() -> AllToolsStatus {
    let manifest = read_manifest();
    let names = ["yt-dlp", "ffmpeg", "ffprobe"];
    let tools = names.iter().map(|n| get_tool_status(n)).collect();
    AllToolsStatus {
        tools,
        last_check: manifest.last_check,
        update_available: false,
        active_download_protected: has_active_downloads(),
    }
}

fn has_active_downloads() -> bool {
    // Check via jobs lock if available - we use a heuristic: try to read manifest's active flag or check via crate
    // For now, check if any job is active by trying to inspect via lib's public helper if exists, otherwise assume false
    // We will expose has_active_download_jobs in lib.rs, but as fallback use file lock heuristic
    crate::has_active_download_jobs()
}

pub fn startup_health_check() -> AllToolsStatus {
    let mut manifest = read_manifest();
    let mut updated = false;
    for name in ["yt-dlp", "ffmpeg", "ffprobe"] {
        let entry = manifest.tools.get(name).cloned();
        let managed = resolve_managed_tool_path(name);
        let health = if let Some(p) = managed.as_ref() {
            health_check_executable(p, name)
        } else if let Some(e) = entry.as_ref().and_then(|x| x.path.as_ref()) {
            let p = PathBuf::from(e);
            health_check_executable(&p, name)
        } else {
            false
        };
        let status = if managed.is_some() && health { "healthy" } else if managed.is_some() && !health { "corrupt" } else { "missing" };
        if let Some(e) = manifest.tools.get_mut(name) {
            if e.status != status {
                e.status = status.to_string();
                e.health_checked_at = Some(now_iso());
                updated = true;
            }
        } else {
            // Create entry if missing but managed file exists
            if let Some(p) = managed {
                let ver = get_version_for_path(&p, name).unwrap_or_else(|| "unknown".to_string());
                manifest.tools.insert(name.to_string(), ToolEntry {
                    name: name.to_string(),
                    version: ver,
                    executable: executable_name(name),
                    path: Some(p.to_string_lossy().to_string()),
                    platform: std::env::consts::OS.to_string(),
                    arch: std::env::consts::ARCH.to_string(),
                    checksum: None,
                    installed_at: Some(now_iso()),
                    status: status.to_string(),
                    health_checked_at: Some(now_iso()),
                });
                updated = true;
            }
        }
    }
    if updated {
        manifest.last_check = Some(now_iso());
        write_manifest(&manifest);
    }
    all_tools_status()
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct ToolUpdateResult {
    pub tool: String,
    pub success: bool,
    pub message: String,
    pub previous_version: Option<String>,
    pub new_version: Option<String>,
}

// Safe staged update: does NOT delete current until new verified. Keeps previous for rollback.
// For production, new_binary_path would be downloaded artifact path; here we simulate with provided path or fallback.
pub fn staged_update_tool(tool: &str, new_binary_temp_path: &Path) -> ToolUpdateResult {
    if has_active_downloads() {
        return ToolUpdateResult {
            tool: tool.to_string(),
            success: false,
            message: "Update deferred until downloads finish — active download protected".to_string(),
            previous_version: get_tool_status(tool).version,
            new_version: None,
        };
    }

    let cur_dir = match current_dir(tool) {
        Some(p) => p,
        None => return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Tool base dir unavailable".to_string(), previous_version: None, new_version: None },
    };
    let prev_dir = match previous_dir(tool) {
        Some(p) => p,
        None => return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Tool base dir unavailable".to_string(), previous_version: None, new_version: None },
    };
    let staging = match staging_dir(tool) {
        Some(p) => p,
        None => return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Tool base dir unavailable".to_string(), previous_version: None, new_version: None },
    };

    // Ensure dirs exist
    let _ = fs::create_dir_all(&cur_dir);
    let _ = fs::create_dir_all(&prev_dir);
    let _ = fs::create_dir_all(&staging);

    // Validate new binary exists and is plausible
    if !new_binary_temp_path.is_file() {
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Downloaded artifact not found or invalid".to_string(), previous_version: get_tool_status(tool).version, new_version: None };
    }

    // Copy to staging and verify health
    let exe_name = executable_name(tool);
    let staged_exe = staging.join(&exe_name);
    if let Err(e) = fs::copy(new_binary_temp_path, &staged_exe) {
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: format!("Failed to stage update: {}", e), previous_version: get_tool_status(tool).version, new_version: None };
    }

    // Health check staged
    if !health_check_executable(&staged_exe, tool) {
        let _ = fs::remove_file(&staged_exe);
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Staged tool failed health check — rollback, previous version kept".to_string(), previous_version: get_tool_status(tool).version, new_version: None };
    }

    let new_version = get_version_for_path(&staged_exe, tool);
    let prev_version = get_tool_status(tool).version.clone();

    // Backup current to previous (atomic: remove previous, rename current->previous if exists)
    if cur_dir.exists() {
        // Remove previous if exists
        let _ = fs::remove_dir_all(&prev_dir);
        // Try rename current -> previous; if fails due to file lock, abort
        if let Err(e) = fs::rename(&cur_dir, &prev_dir) {
            // Cleanup staging
            let _ = fs::remove_file(&staged_exe);
            return ToolUpdateResult { tool: tool.to_string(), success: false, message: format!("Failed to backup current tool (maybe file lock): {} — previous kept", e), previous_version: prev_version, new_version: new_version.clone() };
        }
    }

    // Create new current dir and move staged exe there
    let _ = fs::create_dir_all(&cur_dir);
    let final_exe = cur_dir.join(&exe_name);
    if let Err(e) = fs::rename(&staged_exe, &final_exe) {
        // Rollback: restore previous
        let _ = fs::remove_dir_all(&cur_dir);
        let _ = fs::rename(&prev_dir, &cur_dir);
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: format!("Failed to activate new tool: {} — rollback to previous", e), previous_version: prev_version, new_version: new_version.clone() };
    }

    // Cleanup staging dir (now empty)
    let _ = fs::remove_dir_all(&staging);

    // Verify activated tool
    if !health_check_executable(&final_exe, tool) {
        // Rollback
        let _ = fs::remove_dir_all(&cur_dir);
        let _ = fs::rename(&prev_dir, &cur_dir);
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Activated tool failed health check — rollback to previous version".to_string(), previous_version: prev_version, new_version: new_version.clone() };
    }

    // Update manifest
    let mut manifest = read_manifest();
    let entry = ToolEntry {
        name: tool.to_string(),
        version: new_version.clone().unwrap_or_else(|| "unknown".to_string()),
        executable: exe_name.to_string(),
        path: Some(final_exe.to_string_lossy().to_string()),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        checksum: None,
        installed_at: Some(now_iso()),
        status: "healthy".to_string(),
        health_checked_at: Some(now_iso()),
    };
    manifest.tools.insert(tool.to_string(), entry);
    manifest.last_check = Some(now_iso());
    write_manifest(&manifest);

    ToolUpdateResult { tool: tool.to_string(), success: true, message: "Tool update completed — new version active, previous kept for rollback".to_string(), previous_version: prev_version, new_version }
}

pub fn rollback_tool(tool: &str) -> ToolUpdateResult {
    let cur_dir = match current_dir(tool) { Some(p) => p, None => return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Tool base dir unavailable".to_string(), previous_version: None, new_version: None } };
    let prev_dir = match previous_dir(tool) { Some(p) => p, None => return ToolUpdateResult { tool: tool.to_string(), success: false, message: "Tool base dir unavailable".to_string(), previous_version: None, new_version: None } };

    if !prev_dir.exists() {
        return ToolUpdateResult { tool: tool.to_string(), success: false, message: "No previous version available for rollback".to_string(), previous_version: get_tool_status(tool).version, new_version: None };
    }

    let _ = fs::remove_dir_all(&cur_dir);
    match fs::rename(&prev_dir, &cur_dir) {
        Ok(_) => {
            let new_ver = get_tool_status(tool).version;
            ToolUpdateResult { tool: tool.to_string(), success: true, message: "Rollback completed — previous version restored".to_string(), previous_version: None, new_version: new_ver }
        }
        Err(e) => ToolUpdateResult { tool: tool.to_string(), success: false, message: format!("Rollback failed: {}", e), previous_version: None, new_version: None },
    }
}

static TOOL_CHECK_CACHE: OnceLock<Mutex<Option<AllToolsStatus>>> = OnceLock::new();

// Background tool auto-update (real implementation).
// Sources: yt-dlp GitHub releases (Windows/Linux/macOS standalone builds),
// BtbN FFmpeg-Builds GitHub releases (Windows ffmpeg+ffprobe bundle).
// Runs in a detached thread, is offline-safe, defers while downloads are
// active, and never panics: every failure path is silently skipped so the
// app can neither crash nor hang because of a tool update.
const YTDLP_LATEST_API: &str = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
#[cfg(windows)]
const FFMPEG_LATEST_API: &str = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";
const TOOL_HTTP_TIMEOUT_SECS: u64 = 20;
const MAX_TOOL_DOWNLOAD_BYTES: u64 = 400 * 1024 * 1024;
const TOOL_USER_AGENT: &str = "KWL-Video-Downloader";

fn tool_http_client(with_total_timeout: bool) -> Result<reqwest::blocking::Client, String> {
    let mut builder = reqwest::blocking::Client::builder()
        .user_agent(TOOL_USER_AGENT)
        .connect_timeout(std::time::Duration::from_secs(TOOL_HTTP_TIMEOUT_SECS));
    if with_total_timeout {
        builder = builder.timeout(std::time::Duration::from_secs(TOOL_HTTP_TIMEOUT_SECS));
    }
    builder.build().map_err(|e| format!("http client: {}", e))
}

/// Leading numeric components of a version string:
/// "9.0.2-ess" -> [9,0,2], "n7.1" -> [7,1], "2026.08.19" -> [2026,8,19].
fn parse_version_tuple(s: &str) -> Vec<u64> {
    let mut out = Vec::new();
    let mut cur: u64 = 0;
    let mut in_num = false;
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            in_num = true;
            cur = cur
                .saturating_mul(10)
                .saturating_add((ch as u8 - b'0') as u64);
        } else if in_num {
            out.push(cur);
            cur = 0;
            in_num = false;
        }
    }
    if in_num {
        out.push(cur);
    }
    out
}

fn is_newer_version(current: &str, latest: &str) -> bool {
    let l = parse_version_tuple(latest);
    if l.is_empty() {
        return false;
    }
    let c = parse_version_tuple(current);
    if c.is_empty() {
        // Unknown/missing current version -> allow install; a successful
        // install records a known version so this cannot loop every launch.
        return true;
    }
    let n = c.len().max(l.len());
    for i in 0..n {
        let a = *c.get(i).unwrap_or(&0);
        let b = *l.get(i).unwrap_or(&0);
        if b > a {
            return true;
        }
        if b < a {
            return false;
        }
    }
    false
}

fn release_tag_and_assets(body: &serde_json::Value) -> Option<(String, Vec<(String, String)>)> {
    let tag = body.get("tag_name")?.as_str()?.trim().to_string();
    if tag.is_empty() {
        return None;
    }
    let assets = body.get("assets")?.as_array()?;
    let mut out = Vec::new();
    for a in assets {
        let name = match a.get("name").and_then(|v| v.as_str()) {
            Some(n) => n,
            None => continue,
        };
        let url = match a.get("browser_download_url").and_then(|v| v.as_str()) {
            Some(u) => u,
            None => continue,
        };
        out.push((name.to_string(), url.to_string()));
    }
    if out.is_empty() {
        None
    } else {
        Some((tag, out))
    }
}

fn ytdlp_wanted_asset() -> Option<&'static str> {
    if cfg!(windows) {
        Some("yt-dlp.exe")
    } else if cfg!(target_os = "linux") {
        Some("yt-dlp_linux")
    } else if cfg!(target_os = "macos") {
        Some("yt-dlp_macos")
    } else {
        None
    }
}

fn pick_named_asset(assets: &[(String, String)], wanted: &str) -> Option<String> {
    assets
        .iter()
        .find(|(n, _)| n == wanted)
        .map(|(_, u)| u.clone())
}

/// Version of a BtbN release asset from its `-nX.Y[.Z]-` tag segment, e.g.
/// `ffmpeg-n9.0.2-12-...-win64-gpl-9.0.zip` -> [9,0,2]. Nightly autobuilds
/// (`ffmpeg-N-126905-...`) and rolling names (`ffmpeg-master-latest-...`)
/// have no such segment -> [] so they are never picked (no nightly churn).
fn ffmpeg_asset_version(asset: &str) -> Vec<u64> {
    for seg in asset.split('-') {
        let s = seg
            .strip_prefix('n')
            .or_else(|| seg.strip_prefix('N'))
            .unwrap_or("");
        if !s
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            continue;
        }
        let v: Vec<u64> = parse_version_tuple(s).into_iter().take(3).collect();
        if !v.is_empty() {
            return v;
        }
    }
    Vec::new()
}

/// Newest Windows GPL (non-shared) bundle asset by major.minor.patch.
/// Returns (version, download_url).
#[cfg(windows)]
fn pick_newest_ffmpeg_win_asset(assets: &[(String, String)]) -> Option<(Vec<u64>, String)> {
    let mut best_ver: Vec<u64> = Vec::new();
    let mut best_url: Option<String> = None;
    for (name, url) in assets {
        let l = name.to_lowercase();
        if !(l.contains("win64") && l.ends_with(".zip") && !l.contains("shared")) {
            continue;
        }
        let mut v = ffmpeg_asset_version(name);
        if v.is_empty() {
            continue;
        }
        while v.len() < 3 {
            v.push(0);
        }
        if best_url.is_none() || v > best_ver {
            best_ver = v;
            best_url = Some(url.clone());
        }
    }
    best_url.map(|u| (best_ver, u))
}

fn fetch_release(api_url: &str) -> Result<(String, Vec<(String, String)>), String> {
    let client = tool_http_client(true)?;
    let resp = client
        .get(api_url)
        .send()
        .map_err(|e| format!("release api: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("release api status: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().map_err(|e| format!("release json: {}", e))?;
    release_tag_and_assets(&body).ok_or_else(|| "release json shape".to_string())
}

fn temp_download_path(prefix: &str) -> Option<PathBuf> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir =
        std::env::temp_dir().join(format!("kwl-tool-dl-{}-{}-{}", std::process::id(), prefix, nanos));
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join(prefix))
}

fn download_to_temp(url: &str, prefix: &str) -> Result<PathBuf, String> {
    let client = tool_http_client(false)?;
    let mut resp = client
        .get(url)
        .send()
        .map_err(|e| format!("download: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("download status: {}", resp.status()));
    }
    let dest = temp_download_path(prefix).ok_or_else(|| "temp dir".to_string())?;
    {
        let mut file = fs::File::create(&dest).map_err(|e| format!("temp file: {}", e))?;
        resp.copy_to(&mut file)
            .map_err(|e| format!("download body: {}", e))?;
    }
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(u64::MAX);
    if size > MAX_TOOL_DOWNLOAD_BYTES {
        let _ = fs::remove_file(&dest);
        return Err("download too large".to_string());
    }
    Ok(dest)
}

#[cfg(unix)]
fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(md) = fs::metadata(path) {
        let mut perm = md.permissions();
        perm.set_mode(perm.mode() | 0o111);
        let _ = fs::set_permissions(path, perm);
    }
}

fn extract_wanted_from_zip(
    zip_path: &Path,
    dest_dir: &Path,
    suffixes: &[&str],
) -> Result<Vec<PathBuf>, String> {
    let f = fs::File::open(zip_path).map_err(|e| format!("open archive: {}", e))?;
    let mut zip = zip::ZipArchive::new(f).map_err(|e| format!("read archive: {}", e))?;
    fs::create_dir_all(dest_dir).map_err(|e| format!("extract dir: {}", e))?;
    let mut out = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("archive entry: {}", e))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        if suffixes.iter().any(|s| name.ends_with(s)) {
            let base = name.rsplit('/').next().unwrap_or("tool.bin").to_string();
            if base.is_empty() || base.contains("..") {
                continue;
            }
            let dest = dest_dir.join(&base);
            let mut df = fs::File::create(&dest).map_err(|e| format!("extract file: {}", e))?;
            std::io::copy(&mut entry, &mut df).map_err(|e| format!("extract copy: {}", e))?;
            out.push(dest);
        }
    }
    if out.is_empty() {
        return Err("no matching binaries in archive".to_string());
    }
    Ok(out)
}

fn current_managed_version(tool: &str) -> Option<String> {
    resolve_managed_tool_path(tool).and_then(|p| get_version_for_path(&p, tool))
}

fn cleanup_temp_download(path: &Path) {
    let _ = fs::remove_file(path);
    if let Some(parent) = path.parent() {
        let ours = parent
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.starts_with("kwl-tool-dl-"))
            .unwrap_or(false);
        if ours {
            let _ = fs::remove_dir_all(parent);
        }
    }
}

fn update_ytdlp_if_newer() {
    let wanted = match ytdlp_wanted_asset() {
        Some(w) => w,
        None => return,
    };
    let (tag, assets) = match fetch_release(YTDLP_LATEST_API) {
        Ok(v) => v,
        Err(_) => return,
    };
    let url = match pick_named_asset(&assets, wanted) {
        Some(u) => u,
        None => return,
    };
    let cur = current_managed_version("yt-dlp").unwrap_or_default();
    if !is_newer_version(&cur, &tag) {
        return;
    }
    let tmp = match download_to_temp(&url, wanted) {
        Ok(p) => p,
        Err(_) => return,
    };
    #[cfg(unix)]
    make_executable(&tmp);
    let _ = staged_update_tool("yt-dlp", &tmp);
    cleanup_temp_download(&tmp);
}

#[cfg(windows)]
fn update_ffmpeg_bundle_if_newer() {
    let (_tag, assets) = match fetch_release(FFMPEG_LATEST_API) {
        Ok(v) => v,
        Err(_) => return,
    };
    let (best_ver, url) = match pick_newest_ffmpeg_win_asset(&assets) {
        Some(v) => v,
        None => return,
    };
    let cur = current_managed_version("ffmpeg").unwrap_or_default();
    let mut cur_v: Vec<u64> = parse_version_tuple(&cur).into_iter().take(3).collect();
    let proceed = if cur_v.is_empty() {
        true // missing/unreadable current -> allow install
    } else {
        while cur_v.len() < 3 {
            cur_v.push(0);
        }
        best_ver > cur_v
    };
    if !proceed {
        return;
    }
    let zip_path = match download_to_temp(&url, "ffmpeg-bundle.zip") {
        Ok(p) => p,
        Err(_) => return,
    };
    let dest_dir = match zip_path.parent() {
        Some(d) => d.join("out"),
        None => {
            cleanup_temp_download(&zip_path);
            return;
        }
    };
    let exes = match extract_wanted_from_zip(&zip_path, &dest_dir, &["bin/ffmpeg.exe", "bin/ffprobe.exe"]) {
        Ok(v) => v,
        Err(_) => {
            cleanup_temp_download(&zip_path);
            return;
        }
    };
    for exe in &exes {
        let lname = exe
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_lowercase();
        let tool = if lname.contains("ffprobe") {
            "ffprobe"
        } else {
            "ffmpeg"
        };
        let _ = staged_update_tool(tool, exe);
        let _ = fs::remove_file(exe);
    }
    cleanup_temp_download(&zip_path);
    let _ = fs::remove_dir_all(&dest_dir);
}

pub fn background_update_check() {
    // Spawn detached thread so startup is never blocked. All failures are
    // silently skipped (offline-safe) and active downloads defer updates.
    std::thread::spawn(|| {
        // Quick health check
        let status = startup_health_check();
        let cache = TOOL_CHECK_CACHE.get_or_init(|| Mutex::new(None));
        if let Ok(mut g) = cache.lock() {
            *g = Some(status.clone());
        }
        if has_active_downloads() {
            return;
        }
        update_ytdlp_if_newer();
        #[cfg(windows)]
        update_ffmpeg_bundle_if_newer();
        let mut manifest = read_manifest();
        manifest.last_check = Some(now_iso());
        write_manifest(&manifest);
    });
}

pub fn get_cached_tool_status() -> Option<AllToolsStatus> {
    TOOL_CHECK_CACHE.get().and_then(|m| m.lock().ok().and_then(|g| g.clone()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    fn temp_tools_dir_unique(suffix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kwl-tools-test-{}-{}-{}", std::process::id(), suffix, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn temp_tools_dir() -> PathBuf {
        temp_tools_dir_unique("default")
    }

    #[test]
    fn version_tuples_parse_shapes() {
        assert_eq!(parse_version_tuple("2026.08.19"), vec![2026, 8, 19]);
        assert_eq!(parse_version_tuple("n7.1"), vec![7, 1]);
        assert_eq!(
            parse_version_tuple("ffmpeg version 9.0.2-essentials_build"),
            vec![9, 0, 2]
        );
        assert_eq!(parse_version_tuple(""), Vec::<u64>::new());
        assert_eq!(parse_version_tuple("unknown"), Vec::<u64>::new());
    }

    #[test]
    fn newer_detection_rules() {
        assert!(!is_newer_version("2026.08.19", "2026.08.19"));
        assert!(is_newer_version("2026.08.19", "2026.11.01"));
        assert!(!is_newer_version("2026.11.01", "2026.08.19"));
        assert!(!is_newer_version("9.0.2", "n7.1"));
        assert!(is_newer_version("7.1", "n9.0"));
        assert!(!is_newer_version("1.0", "bogus"));
        assert!(is_newer_version("", "2026.08.19"));
        assert!(!is_newer_version("2026.08.19", ""));
    }

    #[test]
    fn ffmpeg_asset_version_shapes() {
        // release assets carry -nX.Y[.Z]- tag segments
        assert_eq!(
            ffmpeg_asset_version("ffmpeg-n9.0.2-12-gc867e13549-win64-gpl-9.0.zip"),
            vec![9, 0, 2]
        );
        assert_eq!(
            ffmpeg_asset_version("ffmpeg-n8.1.3-win64-gpl-8.1.zip"),
            vec![8, 1, 3]
        );
        // nightly autobuilds and rolling names have no release segment -> skipped
        assert!(ffmpeg_asset_version("ffmpeg-N-126905-gb87602a63a-win64-gpl.zip").is_empty());
        assert!(ffmpeg_asset_version("ffmpeg-N-126905-gb87602a63a-win64-gpl-shared.zip").is_empty());
        assert!(ffmpeg_asset_version("ffmpeg-master-latest-win64-gpl.zip").is_empty());
    }

    #[test]
    fn release_asset_pickers() {
        let body: serde_json::Value = serde_json::from_str(
            r#"{"tag_name":"2026.08.19","assets":[
                {"name":"yt-dlp.exe","browser_download_url":"https://x/yt-dlp.exe"},
                {"name":"yt-dlp_linux","browser_download_url":"https://x/yt-dlp_linux"},
                {"name":"SHA256SUMS","browser_download_url":"https://x/sums"}]}"#,
        )
        .unwrap();
        let (tag, assets) = release_tag_and_assets(&body).unwrap();
        assert_eq!(tag, "2026.08.19");
        assert_eq!(
            pick_named_asset(&assets, "yt-dlp.exe").unwrap(),
            "https://x/yt-dlp.exe"
        );
        assert!(pick_named_asset(&assets, "yt-dlp_macos").is_none());
        let bad: serde_json::Value = serde_json::from_str(r#"{"tag_name":"","assets":[]}"#).unwrap();
        assert!(release_tag_and_assets(&bad).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn ffmpeg_win_asset_picker() {
        let body: serde_json::Value = serde_json::from_str(
            r#"{"tag_name":"latest","assets":[
                {"name":"ffmpeg-N-126905-gb87602a63a-win64-gpl.zip","browser_download_url":"https://x/nightly.zip"},
                {"name":"ffmpeg-n8.1.3-win64-gpl-8.1.zip","browser_download_url":"https://x/old.zip"},
                {"name":"ffmpeg-n9.0-latest-win64-gpl-shared-9.0.zip","browser_download_url":"https://x/shared.zip"},
                {"name":"ffmpeg-n9.0.2-12-gc867e13549-win64-gpl-9.0.zip","browser_download_url":"https://x/win.zip"},
                {"name":"ffmpeg-n9.0.2-12-gc867e13549-win64-lgpl-9.0.zip","browser_download_url":"https://x/lgpl.zip"}]}"#,
        )
        .unwrap();
        let (_, assets) = release_tag_and_assets(&body).unwrap();
        let (ver, url) = pick_newest_ffmpeg_win_asset(&assets).unwrap();
        assert_eq!(url, "https://x/win.zip");
        assert_eq!(ver, vec![9, 0, 2]);
    }

    #[test]
    fn zip_extract_finds_nested_exes() {
        let dir = temp_tools_dir_unique("zipextract");
        let zip_path = dir.join("bundle.zip");
        {
            let f = fs::File::create(&zip_path).unwrap();
            let mut w = zip::ZipWriter::new(f);
            let opts = zip::write::SimpleFileOptions::default();
            w.start_file("ffmpeg-n7.1-win64-gpl/bin/ffmpeg.exe", opts).unwrap();
            w.write_all(b"fake-ffmpeg").unwrap();
            w.start_file("ffmpeg-n7.1-win64-gpl/bin/ffprobe.exe", opts).unwrap();
            w.write_all(b"fake-ffprobe").unwrap();
            w.start_file("ffmpeg-n7.1-win64-gpl/README.txt", opts).unwrap();
            w.write_all(b"readme").unwrap();
            w.finish().unwrap();
        }
        let out_dir = dir.join("out");
        let got =
            extract_wanted_from_zip(&zip_path, &out_dir, &["bin/ffmpeg.exe", "bin/ffprobe.exe"])
                .unwrap();
        assert_eq!(got.len(), 2);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn valid_manifest_read_write() {
        let _guard = env_lock();
        let dir = temp_tools_dir_unique("manifest");
        std::env::set_var("KWL_TOOLS_DIR", &dir);
        let mut m = ToolManifest::default();
        m.tools.insert("yt-dlp".to_string(), ToolEntry {
            name: "yt-dlp".to_string(),
            version: "2026.08.19".to_string(),
            executable: "yt-dlp.exe".to_string(),
            path: Some(dir.join("yt-dlp").join("current").join("yt-dlp.exe").to_string_lossy().to_string()),
            platform: "windows".to_string(),
            arch: "x64".to_string(),
            checksum: None,
            installed_at: Some(now_iso()),
            status: "healthy".to_string(),
            health_checked_at: Some(now_iso()),
        });
        write_manifest(&m);
        let read = read_manifest();
        assert_eq!(read.tools.get("yt-dlp").unwrap().version, "2026.08.19");
        let _ = fs::remove_dir_all(&dir);
        std::env::remove_var("KWL_TOOLS_DIR");
    }

    #[test]
    fn missing_tool_detected() {
        let _guard = env_lock();
        let dir = temp_tools_dir_unique("missing");
        std::env::set_var("KWL_TOOLS_DIR", &dir);
        let status = get_tool_status("ffmpeg");
        assert!(status.health == "missing" || status.health == "corrupt");
        let _ = fs::remove_dir_all(&dir);
        std::env::remove_var("KWL_TOOLS_DIR");
    }

    #[test]
    fn invalid_executable_fails_health_check() {
        let dir = temp_tools_dir_unique("invalid");
        let fake = dir.join("fake.exe");
        // Ensure parent exists
        let _ = fs::create_dir_all(dir.clone());
        fs::write(&fake, b"not an exe").unwrap();
        assert!(!health_check_executable(&fake, "ffmpeg"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn version_detection_for_known_tool() {
        // Use cargo as known good executable for health check (it supports --version)
        let cargo = PathBuf::from("cargo");
        // If cargo not in PATH, skip
        if health_check_executable(&cargo, "yt-dlp") {
            let v = get_version_for_path(&cargo, "yt-dlp");
            assert!(v.is_some());
        }
    }

    #[test]
    fn staged_update_preserves_previous_and_rollback_on_health_fail() {
        let _guard = env_lock();
        let dir = temp_tools_dir_unique("staged");
        std::env::set_var("KWL_TOOLS_DIR", &dir);
        // Create current tool as dummy file (will be backed up)
        let cur = dir.join("ffmpeg").join("current");
        fs::create_dir_all(&cur).unwrap();
        let cur_exe = cur.join(executable_name("ffmpeg"));
        // Use a copy of a real exe if available, else dummy that will fail health
        // Create a valid dummy: copy current cargo exe path? For test, use a file that will fail health check to trigger rollback
        fs::write(&cur_exe, b"valid-but-not-executable").unwrap();
        // Create new binary temp that also fails health check (invalid)
        let new_bin = dir.join("new_ffmpeg.exe");
        fs::write(&new_bin, b"invalid").unwrap();
        let result = staged_update_tool("ffmpeg", &new_bin);
        assert!(!result.success);
        assert!(result.message.contains("health check") || result.message.contains("not found") || result.message.contains("invalid"));
        // Previous should still not exist or current still there? Since staged failed, current should remain
        assert!(cur_exe.exists() || !cur.exists());
        let _ = fs::remove_dir_all(&dir);
        std::env::remove_var("KWL_TOOLS_DIR");
    }

    #[test]
    fn tool_directory_structure() {
        let _guard = env_lock();
        let dir = temp_tools_dir_unique("structure");
        std::env::set_var("KWL_TOOLS_DIR", &dir);
        assert_eq!(tool_dir("yt-dlp").unwrap(), dir.join("yt-dlp"));
        assert_eq!(current_dir("yt-dlp").unwrap(), dir.join("yt-dlp").join("current"));
        assert_eq!(previous_dir("yt-dlp").unwrap(), dir.join("yt-dlp").join("previous"));
        assert_eq!(staging_dir("yt-dlp").unwrap(), dir.join("yt-dlp").join("staging"));
        let _ = fs::remove_dir_all(&dir);
        std::env::remove_var("KWL_TOOLS_DIR");
    }

    #[test]
    fn startup_health_check_offline_safe() {
        let _guard = env_lock();
        let dir = temp_tools_dir_unique("startup");
        std::env::set_var("KWL_TOOLS_DIR", &dir);
        // No tools installed, startup should not crash and return status
        let status = startup_health_check();
        assert_eq!(status.tools.len(), 3);
        let _ = fs::remove_dir_all(&dir);
        std::env::remove_var("KWL_TOOLS_DIR");
    }

    #[test]
    fn bundled_native_tools_install_and_resolve() {
        let dir = temp_tools_dir_unique("bundled");
        let app_data = dir.join("app_data");
        let src = dir.join("yt-dlp.exe");
        fs::write(&src, b"fake bundled tool payload").unwrap();
        let dest = bundled_native_tools_dir(&app_data).join("yt-dlp.exe");
        install_bundled_native_tool(&src, &dest).unwrap();
        assert!(dest.is_file());
        assert_eq!(
            resolve_bundled_tool_path("yt-dlp", &app_data),
            Some(dest.clone())
        );
        // make_executable must not fail on any host
        make_executable(&dest).unwrap();
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn bundled_native_tool_missing_src_is_error() {
        let dir = temp_tools_dir_unique("bundled-missing");
        let app_data = dir.join("app_data");
        let result = install_bundled_native_tool(
            &dir.join("does-not-exist"),
            &bundled_native_tools_dir(&app_data).join("ffmpeg"),
        );
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn asset_relative_path_points_into_native_tools() {
        let path = bundled_tool_asset_relative_path("yt-dlp");
        let rendered = path.to_string_lossy().to_string().replace('\\', "/");
        assert!(
            rendered.starts_with("native_tools/yt-dlp"),
            "asset path should start with native_tools/yt-dlp, got {rendered}"
        );
        assert!(path.file_name().is_some());
        assert!(path.starts_with("native_tools"));
    }
}
