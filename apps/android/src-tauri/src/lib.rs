use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
fn cmd_hidden<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
fn cmd_hidden<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    Command::new(program)
}

pub mod autostart;
pub mod report;
pub mod tools;
pub mod versions;

/// Application startup hook: registers the bundled native tools base directory
/// (Android host extracts `assets/native_tools/*` into the app data dir),
/// points the in-app report system at the app data dir and retries any queued
/// reports, then kicks off the background runtime tool health check.
use tauri::AppHandle;

pub fn app_setup<R: tauri::Runtime>(app: &AppHandle<R>) {
    use tauri::Manager;
    let base = app.path().app_data_dir().ok();
    tools::set_bundled_tools_base(base.clone());
    report::set_reports_dir(base.clone());
    versions::set_versions_dir(base);
    report::flush_pending_reports();
    tools::background_update_check();
}

#[derive(Debug, serde::Serialize)]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub environment: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct UrlRequest {
    pub url: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct DeleteHistoryRequest {
    pub timestamp: String,
    pub output_path: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct DownloadRequestInput {
    pub url: String,
    pub media_type: String,
    pub container: String,
    pub quality: String,
    pub output_directory: String,
    pub resolution: Option<String>,
    #[serde(default)]
    pub fps: Option<u64>,
    #[serde(default)]
    pub transcode: Option<bool>,
    pub duration_seconds: Option<f64>,
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub video_size_bytes: Option<u64>,
    #[serde(default)]
    pub audio_size_bytes: Option<u64>,
    #[serde(default)]
    pub total_size_bytes: Option<u64>,
    #[serde(default)]
    pub size_known: Option<bool>,
}

pub fn validate_download_request_input(request: &DownloadRequestInput) -> Result<(), String> {
    if request.url.trim().is_empty() {
        return Err("URL is required".to_string());
    }

    if request.container.trim().is_empty() {
        return Err("Format is required".to_string());
    }

    if request.quality.trim().is_empty() {
        return Err("Quality is required".to_string());
    }

    let is_video = request.media_type.eq_ignore_ascii_case("video");
    let resolution = request.resolution.as_deref().unwrap_or("").trim().to_string();

    if is_video && resolution.is_empty() {
        return Err("Resolution is required for video downloads".to_string());
    }

    if let Some(fps) = request.fps {
        if fps == 0 {
            return Err("FPS must be greater than zero".to_string());
        }
        if resolution.is_empty() {
            return Err("FPS requires a resolution".to_string());
        }
    }

    Ok(())
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct DownloadJobResponse {
    pub id: String,
    pub status: String,
    pub output_path: Option<String>,
    pub filename: Option<String>,
    pub percent: Option<f64>,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_second: Option<f64>,
    pub eta_seconds: Option<u64>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct DownloadHistoryEntry {
    pub filename: Option<String>,
    pub media_type: String,
    pub format: String,
    pub resolution: Option<String>,
    pub status: String,
    pub timestamp: String,
    pub output_path: Option<String>,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Clone, Debug)]
struct FileProgressState {
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Clone, Debug)]
struct ProgressAggregator {
    files: HashMap<String, FileProgressState>,
    peak_percent: f64,
    peak_downloaded: u64,
}

impl ProgressAggregator {
    fn new() -> Self {
        Self { files: HashMap::new(), peak_percent: 0.0, peak_downloaded: 0 }
    }

    fn key_for(filename: Option<String>) -> String {
        filename.unwrap_or_else(|| "__default__".to_string())
    }

    /// Update with real yt-dlp progress for a single file/stream and return aggregated values.
    /// Byte-weighted: combinedDownloaded / combinedTotal *100, monotonic (never backward), handles unknown totals honestly.
    fn ingest(
        &mut self,
        downloaded: Option<u64>,
        total: Option<u64>,
        speed: Option<f64>,
        eta: Option<u64>,
        filename: Option<String>,
    ) -> (Option<f64>, Option<u64>, Option<u64>, Option<f64>, Option<u64>) {
        let key = Self::key_for(filename);
        let downloaded_val = downloaded.unwrap_or(0);
        // Update file entry: keep latest downloaded/total/speed/eta for that file
        self.files.insert(
            key,
            FileProgressState { downloaded: downloaded_val, total },
        );

        // Aggregate across all files byte-weighted
        let combined_downloaded: u64 = self.files.values().map(|f| f.downloaded).sum();
        self.peak_downloaded = self.peak_downloaded.max(combined_downloaded);

        // If any file has unknown total, we cannot compute honest percent
        let mut combined_total: Option<u64> = Some(0);
        for f in self.files.values() {
            match f.total {
                Some(t) => {
                    combined_total = combined_total.map(|acc| acc + t);
                }
                None => {
                    combined_total = None;
                    break;
                }
            }
        }

        // Speed/ETA are real values from the latest yt-dlp event – do not retain stale values
        let latest_speed = speed;
        let latest_eta = eta;

        // Professional estimate for unknown total (large videos where yt-dlp total is NA): if speed & ETA known, estimate total = downloaded + speed*ETA
        if combined_total.is_none() {
            if let (Some(sp), Some(eta_val)) = (latest_speed, latest_eta) {
                if sp > 0.0 && eta_val > 0 && combined_downloaded > 0 {
                    let estimated_remaining = (sp * eta_val as f64) as u64;
                    let estimated_total = combined_downloaded.saturating_add(estimated_remaining);
                    if estimated_total > combined_downloaded {
                        combined_total = Some(estimated_total);
                    }
                }
            }
        }

        // FIX: Never allow downloaded > total — when audio stream discovered, ensure total is updated
        // If combined_downloaded exceeds combined_total (stale total), clamp total to downloaded so percent never >100 and bytes display honest
        if let Some(total) = combined_total {
            if combined_downloaded > total {
                combined_total = Some(combined_downloaded);
            }
        }

        let raw_percent = match (combined_total, combined_downloaded) {
            (Some(total), downloaded) if total > 0 => Some(((downloaded as f64 / total as f64) * 100.0).min(100.0)),
            _ => None,
        };

        let percent = match raw_percent {
            Some(p) => {
                // monotonic: never move backward
                if p > self.peak_percent {
                    self.peak_percent = p;
                }
                Some(self.peak_percent)
            }
            None => {
                // unknown total – no fabricated percent, return None so UI shows bytes-only + indeterminate
                if self.peak_percent > 0.0 && combined_total.is_some() {
                    Some(self.peak_percent)
                } else {
                    None
                }
            }
        };

        // Provide monotonic downloaded as peak
        let monotonic_downloaded = Some(self.peak_downloaded);

        (percent, monotonic_downloaded, combined_total, latest_speed, latest_eta)
    }

    fn phase_min_percent(status: &str) -> Option<f64> {
        match status {
            "processing" | "merging" => Some(92.0),
            "converting" => Some(92.0),
            "validating" => Some(98.0),
            "completed" => Some(100.0),
            _ => None,
        }
    }

    fn apply_phase_floor(&mut self, status: &str) -> Option<f64> {
        if let Some(floor) = Self::phase_min_percent(status) {
            if floor > self.peak_percent {
                self.peak_percent = floor;
            }
            Some(self.peak_percent)
        } else {
            None
        }
    }
}

#[derive(Clone)]
struct JobState {
    response: DownloadJobResponse,
    process_id: Option<u32>,
    history: DownloadHistoryEntry,
    temp_directory: PathBuf,
    aggregator: ProgressAggregator,
}

static JOBS: OnceLock<Mutex<HashMap<String, JobState>>> = OnceLock::new();
static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(1);

fn jobs() -> &'static Mutex<HashMap<String, JobState>> {
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_job_id() -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let sequence = JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("job-{timestamp}-{sequence}")
}

pub fn has_active_download_jobs() -> bool {
    if let Ok(jobs) = jobs().lock() {
        jobs.values().any(|j| matches!(j.response.status.as_str(), "queued" | "downloading" | "processing" | "converting" | "validating" | "paused"))
    } else {
        false
    }
}

fn update_job(job_id: &str, update: impl FnOnce(&mut JobState)) {
    if let Ok(mut jobs) = jobs().lock() {
        if let Some(job) = jobs.get_mut(job_id) {
            update(job);
        }
    }
}

fn history_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("LOCALAPPDATA"))
        .map(|base| PathBuf::from(base).join("KWL Video Downloader").join("history.json"))
}

fn read_history() -> Vec<DownloadHistoryEntry> {
    history_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn write_history_entries(entries: &[DownloadHistoryEntry]) {
    if let Some(path) = history_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string_pretty(entries) {
            let _ = fs::write(path, content);
        }
    }
}

fn write_history(entry: DownloadHistoryEntry) {
    let mut history = read_history();
    history.insert(0, entry);
    history.truncate(50);
    write_history_entries(&history);
}

fn history_entry_references_existing_file(entry: &DownloadHistoryEntry) -> bool {
    if !entry.status.eq_ignore_ascii_case("completed") {
        return true;
    }

    match entry.output_path.as_deref() {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path.trim()).is_file(),
        _ => false,
    }
}

fn partition_history_by_existing_files(history: Vec<DownloadHistoryEntry>) -> (Vec<DownloadHistoryEntry>, usize) {
    let original_count = history.len();
    let kept: Vec<DownloadHistoryEntry> = history
        .into_iter()
        .filter(|entry| history_entry_references_existing_file(entry))
        .collect();
    let removed_count = original_count - kept.len();
    (kept, removed_count)
}

fn remove_history_entry(
    history: Vec<DownloadHistoryEntry>,
    timestamp: &str,
    output_path: Option<&str>,
) -> Option<Vec<DownloadHistoryEntry>> {
    let original_length = history.len();
    let remaining: Vec<DownloadHistoryEntry> = history
        .into_iter()
        .filter(|entry| {
            let timestamp_matches = entry.timestamp == timestamp;
            let path_matches = match output_path {
                Some(path) => entry.output_path.as_deref() == Some(path),
                None => true,
            };
            !(timestamp_matches && path_matches)
        })
        .collect();

    if remaining.len() == original_length {
        None
    } else {
        Some(remaining)
    }
}

fn validate_media_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path.trim());
    if candidate.as_os_str().is_empty() {
        return Err("Media file path is required".to_string());
    }

    let canonical = candidate.canonicalize().map_err(|_| "Media file was not found".to_string())?;
    if !canonical.is_file() {
        return Err("Media file was not found".to_string());
    }

    let history_match = read_history().iter().filter_map(|entry| entry.output_path.as_ref()).any(|stored| {
        PathBuf::from(stored).canonicalize().map(|value| value == canonical).unwrap_or(false)
    });
    let active_job_match = jobs().lock().ok().map(|jobs| jobs.values().any(|job| {
        job.response.output_path.as_ref().and_then(|stored| PathBuf::from(stored).canonicalize().ok()).map(|stored| {
            (stored.is_dir() && canonical.starts_with(&stored)) || stored == canonical
        }).unwrap_or(false)
    })).unwrap_or(false);

    if history_match || active_job_match {
        Ok(canonical)
    } else {
        Err("Media file is outside the downloader output locations".to_string())
    }
}

pub fn open_media_file_impl(path: String) -> Result<(), String> {
    let file = validate_media_path(&path)?;
    #[cfg(target_os = "windows")]
    {
        cmd_hidden("cmd")
            .args(["/C", "start", "", &file.to_string_lossy()])
            .spawn()
            .map_err(|_| "Unable to open media file".to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file;
        Err("Opening media files is supported on Windows only".to_string())
    }
}

pub fn reveal_media_in_explorer_impl(path: String) -> Result<(), String> {
    let file = validate_media_path(&path)?;
    #[cfg(target_os = "windows")]
    {
        cmd_hidden("explorer.exe")
            .args(["/select,", &file.to_string_lossy()])
            .spawn()
            .map_err(|_| "Unable to reveal media file".to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file;
        Err("Opening Explorer is supported on Windows only".to_string())
    }
}

fn create_temp_directory(job_id: &str) -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join("kwl-video-downloader").join(job_id);
    fs::create_dir_all(&path).map_err(|_| "Unable to create temporary download workspace".to_string())?;
    Ok(path)
}

fn cleanup_temp_directory(path: &PathBuf) {
    // Retry: Windows file locks may keep temp files open briefly after child exit
    for attempt in 0..3 {
        match fs::remove_dir_all(path) {
            Ok(_) => break,
            Err(e) => {
                let msg = e.to_string().to_ascii_lowercase();
                let in_use = msg.contains("being used by another process")
                    || msg.contains("access is denied")
                    || e.kind() == std::io::ErrorKind::PermissionDenied;
                if in_use && attempt < 2 {
                    std::thread::sleep(std::time::Duration::from_millis(150 * (attempt as u64 + 1)));
                    continue;
                }
                if in_use {
                    eprintln!("[CLEANUP] Temp dir in use, will retry later: {} ({})", path.display(), e);
                }
                break;
            }
        }
    }
}

fn remove_file_with_retry(path: &PathBuf) -> bool {
    for attempt in 0..3 {
        match fs::remove_file(path) {
            Ok(_) => {
                eprintln!("[CLEANUP] Deleted output .part: {}", path.display());
                return true;
            }
            Err(e) => {
                let msg = e.to_string().to_ascii_lowercase();
                let in_use = msg.contains("being used by another process")
                    || msg.contains("access is denied")
                    || e.kind() == std::io::ErrorKind::PermissionDenied;
                if in_use && attempt < 2 {
                    std::thread::sleep(std::time::Duration::from_millis(150 * (attempt as u64 + 1)));
                    continue;
                }
                if in_use {
                    eprintln!("[CLEANUP] Skipped in-use file (will retry next cleanup): {} ({})", path.display(), e);
                } else {
                    eprintln!("[CLEANUP] Failed to delete {}: {}", path.display(), e);
                }
                return false;
            }
        }
    }
    false
}

fn cleanup_output_part_files(job: &JobState) {
    // yt-dlp leaves `Title.mp4.part` / `.ytdl` / `.tmp` in the output directory on failure/cancel.
    // We delete the known .part file for this job so the download folder doesn't fill with orphaned PARTs.
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(name) = job.response.filename.as_deref() {
        let p = PathBuf::from(name);
        if p.to_string_lossy().contains(".part") || p.to_string_lossy().ends_with(".ytdl") || p.to_string_lossy().ends_with(".tmp") {
            if p.is_file() {
                candidates.push(p);
            }
        }
    }
    // Also check output_path as file + .part suffix (covers case where filename wasn't set)
    if let Some(dir) = job.response.output_path.as_deref() {
        let with_part = PathBuf::from(format!("{}.part", dir));
        if with_part.is_file() {
            candidates.push(with_part);
        }
        let with_ytdl = PathBuf::from(format!("{}.ytdl", dir));
        if with_ytdl.is_file() {
            candidates.push(with_ytdl);
        }
    }
    for p in candidates {
        if p.is_file() {
            remove_file_with_retry(&p);
        }
    }
}

#[cfg(target_os = "windows")]
mod win_process_control {
    const TH32CS_SNAPPROCESS: u32 = 0x0000_0002;
    const PROCESS_SUSPEND_RESUME: u32 = 0x0800;
    type Handle = isize;

    #[repr(C)]
    struct ProcessEntry32W {
        size: u32,
        usage_count: u32,
        process_id: u32,
        default_heap_id: usize,
        module_id: u32,
        thread_count: u32,
        parent_process_id: u32,
        base_priority: i32,
        flags: u32,
        exe_file: [u16; 260],
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateToolhelp32Snapshot(flags: u32, process_id: u32) -> Handle;
        fn Process32FirstW(snapshot: Handle, entry: *mut ProcessEntry32W) -> i32;
        fn Process32NextW(snapshot: Handle, entry: *mut ProcessEntry32W) -> i32;
        fn CloseHandle(handle: Handle) -> i32;
        fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> Handle;
    }

    #[link(name = "ntdll")]
    extern "system" {
        fn NtSuspendProcess(process_handle: Handle) -> i32;
        fn NtResumeProcess(process_handle: Handle) -> i32;
    }

    fn collect_process_tree(root_process_id: u32) -> Vec<u32> {
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        if snapshot <= 0 {
            return vec![root_process_id];
        }

        let mut entries: Vec<(u32, u32)> = Vec::new();
        let mut entry = ProcessEntry32W { size: std::mem::size_of::<ProcessEntry32W>() as u32, usage_count: 0, process_id: 0, default_heap_id: 0, module_id: 0, thread_count: 0, parent_process_id: 0, base_priority: 0, flags: 0, exe_file: [0; 260] };
        if unsafe { Process32FirstW(snapshot, &mut entry) } != 0 {
            loop {
                entries.push((entry.process_id, entry.parent_process_id));
                entry.size = std::mem::size_of::<ProcessEntry32W>() as u32;
                if unsafe { Process32NextW(snapshot, &mut entry) } == 0 {
                    break;
                }
            }
        }
        unsafe { CloseHandle(snapshot) };

        let mut children: std::collections::HashMap<u32, Vec<u32>> = std::collections::HashMap::new();
        for (process_id, parent_process_id) in entries {
            children.entry(parent_process_id).or_default().push(process_id);
        }

        let mut tree = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let mut queue = std::collections::VecDeque::from([root_process_id]);
        while let Some(process_id) = queue.pop_front() {
            if !visited.insert(process_id) {
                continue;
            }
            tree.push(process_id);
            if let Some(direct_children) = children.get(&process_id) {
                for child in direct_children.clone() {
                    queue.push_back(child);
                }
            }
        }
        tree
    }

    fn apply_to_process_tree(root_process_id: u32, suspend: bool) -> bool {
        let tree = collect_process_tree(root_process_id);
        let mut root_ok = false;
        for (index, process_id) in tree.iter().enumerate() {
            unsafe {
                let handle = OpenProcess(PROCESS_SUSPEND_RESUME, 0, *process_id);
                if handle == 0 {
                    continue;
                }
                let result = if suspend { NtSuspendProcess(handle) } else { NtResumeProcess(handle) };
                CloseHandle(handle);
                if index == 0 {
                    root_ok = result == 0;
                }
            }
        }
        root_ok
    }

    pub fn suspend_process_tree(root_process_id: u32) -> bool {
        apply_to_process_tree(root_process_id, true)
    }

    pub fn resume_process_tree(root_process_id: u32) -> bool {
        apply_to_process_tree(root_process_id, false)
    }
}

#[cfg(not(target_os = "windows"))]
fn suspend_process_tree(_root_process_id: u32) -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
fn resume_process_tree(_root_process_id: u32) -> bool {
    false
}

#[cfg(target_os = "windows")]
use win_process_control::{resume_process_tree, suspend_process_tree};

fn parse_size(value: &str) -> Option<u64> {
    let cleaned = value
        .trim()
        .trim_end_matches(|character: char| character == ',' || character == ']')
        .trim_end_matches("/s");
    let (number, multiplier) = if cleaned.ends_with("GiB") {
        (&cleaned[..cleaned.len() - 3], 1024_f64.powi(3))
    } else if cleaned.ends_with("MiB") {
        (&cleaned[..cleaned.len() - 3], 1024_f64.powi(2))
    } else if cleaned.ends_with("KiB") {
        (&cleaned[..cleaned.len() - 3], 1024_f64)
    } else if cleaned.ends_with("B") {
        (&cleaned[..cleaned.len() - 1], 1.0)
    } else {
        return None;
    };

    number.trim().parse::<f64>().ok().map(|number| (number * multiplier) as u64)
}

fn parse_progress_line(line: &str) -> (Option<f64>, Option<u64>, Option<u64>, Option<f64>, Option<u64>) {
    let percent = line.split('%').next().and_then(|value| value.rsplit_once(' ').map(|(_, number)| number).or(Some(value.trim()))).and_then(|value| value.trim().parse::<f64>().ok());
    let total = line.split(" of ").nth(1).and_then(|value| value.split_whitespace().next()).and_then(parse_size);
    let downloaded = percent.zip(total).map(|(percent, total)| (percent / 100.0 * total as f64) as u64);
    let speed = line.split(" at ").nth(1).and_then(|value| value.split_whitespace().next()).and_then(parse_size).map(|bytes| bytes as f64);
    let eta = line.split(" ETA ").nth(1).and_then(|value| value.split_whitespace().next()).and_then(|value| {
        let mut parts = value.split(':').filter_map(|part| part.parse::<u64>().ok()).collect::<Vec<_>>();
        if parts.len() == 2 { Some(parts.remove(0) * 60 + parts.remove(0)) } else if parts.len() == 3 { Some(parts.remove(0) * 3600 + parts.remove(0) * 60 + parts.remove(0)) } else { None }
    });

    (percent, downloaded, total, speed, eta)
}

const PROGRESS_TEMPLATE_PREFIX: &str = "KWLPROG ";
const PROGRESS_TEMPLATE: &str = "download:KWLPROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s %(progress.filename)s";

pub struct TemplateProgress {
    pub percent: Option<f64>,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_second: Option<f64>,
    pub eta_seconds: Option<u64>,
    pub filename: Option<String>,
}

fn parse_optional_u64(token: Option<&str>) -> Option<u64> {
    token.filter(|value| *value != "NA").and_then(|value| value.parse::<u64>().ok())
}

fn parse_optional_f64(token: Option<&str>) -> Option<f64> {
    token.filter(|value| *value != "NA").and_then(|value| value.parse::<f64>().ok())
}

fn parse_template_progress_line(line: &str) -> Option<TemplateProgress> {
    let payload = line.trim().strip_prefix(PROGRESS_TEMPLATE_PREFIX)?;
    let mut parts = payload.split_whitespace();
    let downloaded_bytes = parse_optional_u64(parts.next());
    let total_bytes = parse_optional_u64(parts.next());
    let total_bytes_estimate = parse_optional_u64(parts.next());
    let speed_bytes_per_second = parse_optional_f64(parts.next());
    let eta_seconds = parse_optional_u64(parts.next());
    let filename = {
        let rest = parts.collect::<Vec<&str>>().join(" ");
        if rest.is_empty() { None } else { Some(rest) }
    };

    let effective_total = total_bytes.or(total_bytes_estimate);
    let percent = match (downloaded_bytes, effective_total) {
        (Some(downloaded), Some(total)) if total > 0 => Some((((downloaded as f64) / (total as f64)) * 100.0).min(100.0)),
        _ => None,
    };

    Some(TemplateProgress {
        percent,
        downloaded_bytes,
        total_bytes: effective_total,
        speed_bytes_per_second,
        eta_seconds,
        filename,
    })
}

fn resolve_yt_dlp() -> Result<String, String> {
    if let Ok(path) = std::env::var("KWL_YTDLP_PATH") {
        if !path.trim().is_empty() {
            return Ok(path);
        }
    }

    // Prefer managed tool (AppData/tools/yt-dlp/current/yt-dlp.exe) if healthy
    if let Some(managed) = tools::resolve_managed_tool_path("yt-dlp") {
        if tools::health_check_executable(&managed, "yt-dlp") {
            return Ok(managed.to_string_lossy().to_string());
        }
    }

    // Bundled native tool (Android APK assets extracted to app data)
    if let Some(bundled) = tools::resolve_bundled_tool("yt-dlp") {
        if tools::health_check_executable(&bundled, "yt-dlp") {
            return Ok(bundled.to_string_lossy().to_string());
        }
    }

    for candidate in ["yt-dlp", "yt-dlp.exe", "python", "py"] {
        let mut cmd = cmd_hidden(candidate);
        let version_output = match candidate {
            "python" | "py" => {
                cmd.arg("-m").arg("yt_dlp").arg("--version").output()
            }
            _ => cmd.arg("--version").output(),
        };

        if version_output
            .map(|output| output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty() && String::from_utf8_lossy(&output.stdout).trim() != "NA")
            .unwrap_or(false)
        {
            return Ok(candidate.to_string());
        }
    }

    Err("yt-dlp runtime is not available. Please install or repair the application runtime.".to_string())
}

fn resolve_ffprobe() -> Result<String, String> {
    if let Ok(path) = std::env::var("KWL_FFPROBE_PATH") {
        if !path.trim().is_empty() {
            return Ok(path);
        }
    }

    if let Some(managed) = tools::resolve_managed_tool_path("ffprobe") {
        if tools::health_check_executable(&managed, "ffprobe") {
            return Ok(managed.to_string_lossy().to_string());
        }
    }

    if let Some(bundled) = tools::resolve_bundled_tool("ffprobe") {
        if tools::health_check_executable(&bundled, "ffprobe") {
            return Ok(bundled.to_string_lossy().to_string());
        }
    }

    for candidate in ["ffprobe", "ffprobe.exe"] {
        if cmd_hidden(candidate).arg("-version").output().map(|output| output.status.success()).unwrap_or(false) {
            return Ok(candidate.to_string());
        }
    }

    Err("ffprobe runtime is not available".to_string())
}

fn resolve_ffmpeg() -> Result<String, String> {
    if let Ok(path) = std::env::var("KWL_FFMPEG_PATH") {
        if !path.trim().is_empty() {
            return Ok(path);
        }
    }
    if let Some(managed) = tools::resolve_managed_tool_path("ffmpeg") {
        if tools::health_check_executable(&managed, "ffmpeg") {
            return Ok(managed.to_string_lossy().to_string());
        }
    }
    if let Some(bundled) = tools::resolve_bundled_tool("ffmpeg") {
        if tools::health_check_executable(&bundled, "ffmpeg") {
            return Ok(bundled.to_string_lossy().to_string());
        }
    }
    for candidate in ["ffmpeg", "ffmpeg.exe"] {
        if cmd_hidden(candidate).arg("-version").output().map(|output| output.status.success()).unwrap_or(false) {
            return Ok(candidate.to_string());
        }
    }
    Err("ffmpeg runtime is not available".to_string())
}

fn validate_output_file(path: &str) -> Result<(), String> {
    let file = PathBuf::from(path);
    if !file.is_file() {
        return Err("Downloaded output file was not found".to_string());
    }

    // Fallback when ffprobe is missing: accept any non-empty file
    let ffprobe = match resolve_ffprobe() {
        Ok(bin) => bin,
        Err(_) => {
            let size = fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
            if size > 1024 {
                return Ok(());
            } else {
                return Err("Downloaded file is empty and ffprobe is not available to validate".to_string());
            }
        }
    };
    let output = cmd_hidden(ffprobe)
        .args(["-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type", "-of", "json"])
        .arg(file)
        .output()
        .map_err(|_| "Unable to validate downloaded media".to_string())?;

    if !output.status.success() {
        return Err("Downloaded media failed validation".to_string());
    }

    let value = serde_json::from_slice::<serde_json::Value>(&output.stdout)
        .map_err(|_| "Downloaded media returned invalid validation data".to_string())?;
    let has_stream = value.get("streams").and_then(serde_json::Value::as_array).map(|streams| !streams.is_empty()).unwrap_or(false);
    let has_duration = value.get("format").and_then(|format| format.get("duration")).and_then(serde_json::Value::as_str).and_then(|duration| duration.parse::<f64>().ok()).map(|duration| duration > 0.0).unwrap_or(false);

    if has_stream && has_duration {
        Ok(())
    } else {
        // If ffprobe reports no duration but file exists and non-empty, accept it (some 3GP/MP4 quirks)
        let size = fs::metadata(&PathBuf::from(path)).map(|m| m.len()).unwrap_or(0);
        if has_stream && size > 1024 {
            Ok(())
        } else {
            Err("Downloaded media has no valid stream or duration".to_string())
        }
    }
}

fn sanitize_output_directory(value: &str) -> Result<PathBuf, String> {
    let mut trimmed = value.trim().to_string();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err("Invalid output directory".to_string());
    }
    // Migrate old Public folder default to user's Downloads (requested)
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("public") && (lower.contains("videos") || lower.contains("kwl")) {
        if let Some(home) = std::env::var_os("USERPROFILE").map(|p| PathBuf::from(p).join("Downloads").join("KWL Video Downloader")) {
            trimmed = home.to_string_lossy().to_string();
        }
    }
    // Also handle generic placeholder "C:\\Users\\Downloads\\KWL Video Downloader"
    if trimmed == "C:\\Users\\Downloads\\KWL Video Downloader" || trimmed == "C:/Users/Downloads/KWL Video Downloader" {
        if let Some(home) = std::env::var_os("USERPROFILE").map(|p| PathBuf::from(p).join("Downloads").join("KWL Video Downloader")) {
            trimmed = home.to_string_lossy().to_string();
        }
    }
    // Block path traversal but allow absolute Windows paths like C:\...
    if trimmed.contains("..") {
        // only block if `..` is a path component, not part of filename
        let has_traversal = PathBuf::from(&trimmed).components().any(|c| matches!(c, std::path::Component::ParentDir));
        if has_traversal {
            return Err("Invalid output directory".to_string());
        }
    }

    let path = PathBuf::from(&trimmed);
    match fs::create_dir_all(&path) {
        Ok(_) => Ok(path),
        Err(_) => {
            // Fallback to user's Downloads or temp if requested path is not writable (e.g., Public Videos needs admin)
            if let Some(fallback) = std::env::var_os("USERPROFILE").map(|p| PathBuf::from(p).join("Downloads").join("KWL Video Downloader")) {
                if fs::create_dir_all(&fallback).is_ok() {
                    return Ok(fallback);
                }
            }
            let temp_fallback = std::env::temp_dir().join("kwl-video-downloader").join("downloads");
            fs::create_dir_all(&temp_fallback).map_err(|_| "Unable to create output folder (tried fallback)".to_string())?;
            Ok(temp_fallback)
        }
    }
}

fn resolution_height(resolution: &str) -> Option<u64> {
    let digits: String = resolution
        .trim()
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();
    digits.parse::<u64>().ok().filter(|height| height > &0)
}

fn resolution_dimensions(resolution: &str) -> (Option<u64>, Option<u64>) {
    let trimmed = resolution.trim();
    if let Some((width, height)) = trimmed.split_once(['x', '\u{00d7}']) {
        let parsed_width = width.trim().parse::<u64>().ok().filter(|value| *value > 0);
        let parsed_height = height.trim().parse::<u64>().ok().filter(|value| *value > 0);
        return (parsed_width, parsed_height);
    }
    (None, resolution_height(trimmed))
}

fn build_video_format_selector(container: &str, height: Option<u64>, width: Option<u64>, fps: Option<u64>) -> String {
    // For QCIF 176x144, width filter is too strict (would exclude 256x144) — ignore width for that specific case and allow any 144p then transcode/scale
    let effective_width = if width == Some(176) && height == Some(144) { None } else { width };
    let height_filter = height.map(|value| format!("[height<={value}]")).unwrap_or_default();
    let width_filter = effective_width.map(|value| format!("[width<={value}]")).unwrap_or_default();
    let fps_filter = fps.map(|value| format!("[fps<={value}]")).unwrap_or_default();

    match container.to_ascii_lowercase().as_str() {
        "mp4" => format!("bestvideo[ext=mp4]{height_filter}{width_filter}{fps_filter}+bestaudio[ext=m4a]/best[ext=mp4]{height_filter}{width_filter}{fps_filter}/best"),
        "webm" => format!("bestvideo[ext=webm]{height_filter}{width_filter}{fps_filter}+bestaudio[ext=webm]/best[ext=webm]{height_filter}{width_filter}{fps_filter}/best"),
        "3gp" => format!("best[ext=3gp]{height_filter}{width_filter}{fps_filter}/best[ext=3gp]/best"),
        _ => format!("bestvideo{height_filter}{width_filter}{fps_filter}+bestaudio/best{height_filter}{width_filter}{fps_filter}/best"),
    }
}

fn build_3gp_transcode_args(input: &str, output: &str, height: Option<u64>) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
        "-c:v".to_string(),
        "mpeg4".to_string(),
        "-b:v".to_string(),
        "300k".to_string(),
    ];
    if let Some(height) = height {
        args.push("-vf".to_string());
        args.push(format!("scale=-2:{height}"));
    }
    args.extend([
        "-c:a".to_string(),
        "aac".to_string(),
        "-ar".to_string(),
        "16000".to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-b:a".to_string(),
        "32k".to_string(),
        output.to_string(),
    ]);
    args
}

fn needs_3gp_transcode(container: &str, transcode: bool) -> bool {
    container.eq_ignore_ascii_case("3gp") && transcode
}

fn video_container_needs_merge(container: &str) -> bool {
    matches!(container.to_ascii_lowercase().as_str(), "webm" | "mkv" | "avi" | "mov" | "flv")
}

fn video_container_remux(container: &str) -> bool {
    matches!(container.to_ascii_lowercase().as_str(), "mkv" | "avi" | "mov" | "flv")
}

fn build_media_analysis_payload(value: &serde_json::Value, url: &str) -> String {
    let formats = value
        .get("formats")
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items.iter().filter_map(|format| {
                let id = format.get("format_id")?.as_str()?;
                let video_codec = format.get("vcodec").and_then(serde_json::Value::as_str).unwrap_or("none");
                let audio_codec = format.get("acodec").and_then(serde_json::Value::as_str).unwrap_or("none");
                let has_video = video_codec != "none";
                let has_audio = audio_codec != "none";

                if !has_video && !has_audio {
                    return None;
                }

                Some(serde_json::json!({
                    "id": id,
                    "mediaType": if has_video { "video" } else { "audio" },
                    "container": format.get("ext").and_then(serde_json::Value::as_str).unwrap_or("unknown"),
                    "codec": if has_video { video_codec } else { audio_codec },
                    "width": format.get("width").and_then(serde_json::Value::as_u64),
                    "height": format.get("height").and_then(serde_json::Value::as_u64),
                    "fps": format.get("fps").and_then(serde_json::Value::as_f64),
                    "bitrate": format.get("tbr").and_then(serde_json::Value::as_f64),
                    "filesize": format.get("filesize").and_then(serde_json::Value::as_u64),
                    "filesizeApprox": format.get("filesize_approx").and_then(serde_json::Value::as_u64),
                    "hasVideo": has_video,
                    "hasAudio": has_audio,
                    "requiresMerge": has_video && !has_audio,
                    "requiresProcessing": false
                }))
            }).collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // Resolve thumbnail: try `thumbnail` string, then `thumbnails` array (last = highest res), then `thumbnails` nested url
    let thumbnail = value
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            value
                .get("thumbnails")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.last())
                .and_then(|entry| entry.get("url").and_then(|u| u.as_str()).map(|s| s.to_string()))
        })
        .or_else(|| {
            value
                .get("thumbnails")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.iter().rev().find(|e| e.get("url").is_some()))
                .and_then(|entry| entry.get("url").and_then(|u| u.as_str()).map(|s| s.to_string()))
        });

    serde_json::json!({
        "id": value.get("id").and_then(serde_json::Value::as_str).unwrap_or("analysis"),
        "url": url,
        "title": value.get("title").and_then(serde_json::Value::as_str).unwrap_or("Untitled media"),
        "author": value.get("uploader").or_else(|| value.get("channel")).or_else(|| value.get("uploader_id")).and_then(serde_json::Value::as_str).unwrap_or("Unknown source"),
        "duration": value.get("duration").and_then(serde_json::Value::as_f64),
        "thumbnail": thumbnail,
        "formats": formats,
        "available": true
    }).to_string()
}

pub fn validate_url_impl(request: UrlRequest) -> Result<bool, String> {
    let trimmed = request.url.trim();

    if trimmed.is_empty() {
        return Err("URL is required".to_string());
    }

    let parsed = url::Url::parse(trimmed)
        .map_err(|_| "Invalid URL".to_string())?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http/https URLs are allowed".to_string());
    }

    Ok(true)
}

pub fn get_app_info_impl() -> AppInfoResponse {
    AppInfoResponse {
        name: "KWL Video Downloader".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: "windows".to_string(),
        environment: "development".to_string(),
    }
}

pub fn analyze_url_impl(request: UrlRequest) -> Result<String, String> {
    validate_url_impl(UrlRequest { url: request.url.clone() })?;

    let binary = resolve_yt_dlp()?;
    let mut command = cmd_hidden(&binary);

    if binary == "python" || binary == "py" {
        command.arg("-m").arg("yt_dlp");
    }

    let output = command
        .arg("--no-warnings")
        .arg("--skip-download")
        .arg("--dump-single-json")
        .arg(&request.url)
        .output()
        .map_err(|e| format!("Unable to analyze media URL: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if output.status.success() {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
            return Ok(build_media_analysis_payload(&value, &request.url));
        }
        // Log JSON parse failure for debugging but don't expose raw output
        eprintln!("[ANALYZE] JSON parse failed for URL: {}", request.url);
    } else {
        // Log yt-dlp error for debugging but return safe error to frontend
        eprintln!("[ANALYZE] yt-dlp failed for URL: {}, status: {}, stderr: {}", request.url, output.status, stderr);
    }

    Err("Unable to retrieve media details from this URL".to_string())
}

pub fn analyze_playlist_impl(request: UrlRequest) -> Result<Vec<String>, String> {
    validate_url_impl(UrlRequest { url: request.url.clone() })?;

    let binary = resolve_yt_dlp()?;
    let mut command = cmd_hidden(&binary);

    if binary == "python" || binary == "py" {
        command.arg("-m").arg("yt_dlp");
    }

    let output = command
        .arg("--no-warnings")
        .arg("--skip-download")
        .arg("--flat-playlist")
        .arg("--dump-single-json")
        .arg(&request.url)
        .output()
        .map_err(|_| "Unable to analyze playlist URL".to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(stdout.trim()) {
            // If it's a playlist, it will have `entries` array
            if let Some(entries) = value.get("entries").and_then(|e| e.as_array()) {
                let mut results: Vec<String> = Vec::new();
                for entry in entries.iter() {
                    // Skip null entries
                    if entry.is_null() {
                        continue;
                    }
                    // Determine entry URL
                    let entry_url = entry
                        .get("webpage_url")
                        .or_else(|| entry.get("url"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .or_else(|| {
                            // Try to build from id
                            entry.get("id").and_then(|v| v.as_str()).map(|id| {
                                let extractor = entry.get("extractor").and_then(|v| v.as_str()).unwrap_or("youtube");
                                if extractor.contains("youtube") {
                                    format!("https://www.youtube.com/watch?v={}", id)
                                } else {
                                    format!("{}#{}", request.url, id)
                                }
                            })
                        })
                        .unwrap_or_else(|| request.url.clone());

                    // Use entry as value for payload; if entry has limited fields, still build payload
                    let payload = build_media_analysis_payload(entry, &entry_url);
                    // Filter out unavailable entries (build will mark available true, but check title)
                    results.push(payload);
                }
                if !results.is_empty() {
                    return Ok(results);
                }
            }
            // Not a playlist or empty entries, fallback to single
            return Ok(vec![build_media_analysis_payload(&value, &request.url)]);
        }
    }

    Err("Unable to retrieve playlist details. Ensure the link is a valid playlist.".to_string())
}

pub fn start_download_impl(request: DownloadRequestInput) -> Result<DownloadJobResponse, String> {
    validate_download_request_input(&request)?;

    validate_url_impl(UrlRequest { url: request.url.clone() })?;
    // LICENSE CHECK DISABLED per user request — will be implemented at the very end
    // if request.media_type.eq_ignore_ascii_case("audio") && request.duration_seconds.unwrap_or(0.0) > 20.0 * 60.0 {
    //     return Err("LICENSE_REQUIRED: Audio downloads longer than 20 minutes require a license.".to_string());
    // }
    let output_path = sanitize_output_directory(&request.output_directory)?;
    let binary = resolve_yt_dlp()?;
    let transcode_requested = needs_3gp_transcode(&request.container, request.transcode.unwrap_or(false));
    let transcode_resolution = request.resolution.clone().unwrap_or_default();

    let mut command = cmd_hidden(&binary);
    if binary == "python" || binary == "py" {
        command.arg("-m").arg("yt_dlp");
    }

    let job_id = next_job_id();
    let temp_directory = create_temp_directory(&job_id)?;

    command
        .arg("--no-warnings")
        .arg("--no-quiet")
        .arg("--no-continue")
        .arg("--force-overwrites")
        .arg("--restrict-filenames")
        .arg("--newline")
        .arg("--progress-template")
        .arg(PROGRESS_TEMPLATE)
        .arg("--print")
        .arg("after_move:filepath")
        .arg("--paths")
        .arg(format!("temp:{}", temp_directory.to_string_lossy()))
        .arg("-o")
        .arg(output_path.join("%(title)s.%(ext)s"));

    match request.media_type.to_ascii_lowercase().as_str() {
        "audio" => {
            command.arg("--extract-audio");
            let container = request.container.to_ascii_lowercase();
            if matches!(container.as_str(), "mp3" | "m4a" | "opus" | "wav") {
                command.arg("--audio-format").arg(&container);
            }
        }
        _ => {
            let requested_container = request.container.to_ascii_lowercase();
            let (width, height) = resolution_dimensions(request.resolution.as_deref().unwrap_or(""));
            let transcode_to_3gp = needs_3gp_transcode(&requested_container, request.transcode.unwrap_or(false));
            let selector_container = if transcode_to_3gp { "transcode" } else { requested_container.as_str() };
            command.arg("-f").arg(build_video_format_selector(selector_container, height, width, request.fps));
            if transcode_to_3gp {
                command.arg("--merge-output-format").arg("mp4");
            } else {
                if video_container_needs_merge(&requested_container) {
                    command.arg("--merge-output-format").arg(&requested_container);
                }
                if video_container_remux(&requested_container) {
                    command.arg("--remux-video").arg(&requested_container);
                }
            }
        }
    }

    command.arg(&request.url);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|_| "Download execution failed".to_string())?;
    let process_id = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let initial_total = request.total_size_bytes;
    let response = DownloadJobResponse {
        id: job_id,
        status: "queued".to_string(),
        output_path: Some(output_path.to_string_lossy().to_string()),
        filename: None,
        percent: Some(0.0),
        downloaded_bytes: Some(0),
        total_bytes: initial_total,
        speed_bytes_per_second: None,
        eta_seconds: None,
        error: None,
    };
    let job_id = response.id.clone();
    let history = DownloadHistoryEntry {
        filename: None,
        media_type: request.media_type.clone(),
        format: request.container.clone(),
        resolution: request.resolution.clone(),
        status: "queued".to_string(),
        timestamp: format!("{:?}", std::time::SystemTime::now()),
        output_path: response.output_path.clone(),
        thumbnail: request.thumbnail.clone(),
        url: Some(request.url.clone()),
    };

    jobs().lock().map_err(|_| "Unable to track download job".to_string())?.insert(job_id.clone(), JobState {
        response: response.clone(),
        process_id: Some(process_id),
        history,
        temp_directory,
        aggregator: ProgressAggregator::new(),
    });

    let progress_job_id = job_id.clone();
    thread::spawn(move || {
        if let Some(stderr) = stderr {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Some(progress) = parse_template_progress_line(&line) {
                    update_job(&progress_job_id, |job| {
                        let (p, dl, tot, sp, eta) = job.aggregator.ingest(
                            progress.downloaded_bytes,
                            progress.total_bytes,
                            progress.speed_bytes_per_second,
                            progress.eta_seconds,
                            progress.filename.clone(),
                        );
                        job.response.percent = p;
                        job.response.downloaded_bytes = dl;
                        job.response.total_bytes = tot;
                        // Speed/ETA must be real or hidden — only set when Some, clear when None to avoid stale fake values
                        job.response.speed_bytes_per_second = sp;
                        job.response.eta_seconds = eta;
                        if let Some(filename) = progress.filename {
                            job.response.filename = Some(filename);
                        }
                        // If template percent was None due to unknown total, explicitly preserve None in response percent to signal indeterminate
                        if p.is_none() && tot.is_none() {
                            // keep response percent at last known peak if any, but allow UI to detect unknown total by total_bytes == None
                            // Aggregator already decides; do nothing else
                        }
                    });
                    continue;
                }

                let (percent, downloaded, total, speed, eta) = parse_progress_line(&line);
                update_job(&progress_job_id, |job| {
                    if line.contains("[Merger]") || line.contains("[ExtractAudio]") {
                        mark_job_processing(job);
                    } else if percent.is_some() || downloaded.is_some() {
                        let (p, dl, tot, sp, eta_v) = job.aggregator.ingest(downloaded, total, speed, eta, None);
                        job.response.percent = p;
                        job.response.downloaded_bytes = dl;
                        job.response.total_bytes = tot;
                        job.response.speed_bytes_per_second = sp;
                        job.response.eta_seconds = eta_v;
                    } else {
                        // keep existing but hide stale speed/eta if none
                    }
                });
            }
        }
    });

    thread::spawn(move || {
        update_job(&job_id, |job| {
            if job.response.status == "queued" {
                job.response.status = "downloading".to_string();
            }
        });
        if let Some(stdout) = stdout {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some(progress) = parse_template_progress_line(&line) {
                    update_job(&job_id, |job| {
                        let (p, dl, tot, sp, eta) = job.aggregator.ingest(
                            progress.downloaded_bytes,
                            progress.total_bytes,
                            progress.speed_bytes_per_second,
                            progress.eta_seconds,
                            progress.filename.clone(),
                        );
                        job.response.percent = p;
                        job.response.downloaded_bytes = dl;
                        job.response.total_bytes = tot;
                        job.response.speed_bytes_per_second = sp;
                        job.response.eta_seconds = eta;
                        if let Some(filename) = progress.filename {
                            job.response.filename = Some(filename);
                        }
                    });
                    continue;
                }

                let (percent, downloaded, total, speed, eta) = parse_progress_line(&line);
                update_job(&job_id, |job| {
                    if line.contains("[Merger]") || line.contains("[ExtractAudio]") {
                        job.response.status = "processing".to_string();
                        if let Some(floor) = job.aggregator.apply_phase_floor("processing") {
                            job.response.percent = Some(floor);
                        }
                        job.response.speed_bytes_per_second = None;
                        job.response.eta_seconds = None;
                    } else if percent.is_some() || downloaded.is_some() {
                        let (p, dl, tot, sp, eta_v) = job.aggregator.ingest(downloaded, total, speed, eta, None);
                        job.response.percent = p;
                        job.response.downloaded_bytes = dl;
                        job.response.total_bytes = tot;
                        job.response.speed_bytes_per_second = sp;
                        job.response.eta_seconds = eta_v;
                    }
                    let candidate = line.trim();
                    if PathBuf::from(candidate).is_file() {
                        job.response.output_path = Some(candidate.to_string());
                        job.response.filename = PathBuf::from(candidate).file_name().map(|name| name.to_string_lossy().to_string());
                    }
                });
            }
        }
        match child.wait() {
            Ok(exit_status) if exit_status.success() => {
                update_job(&job_id, |job| {
                    if transcode_requested {
                        mark_job_converting(job);
                    } else {
                        mark_job_validating(job);
                    }
                    job.process_id = None;
                });

                let source_path = jobs().lock().ok().and_then(|jobs| jobs.get(&job_id).and_then(|job| job.response.output_path.clone()));
                let final_path = if transcode_requested {
                    source_path.and_then(|path| transcode_to_3gp_file(&path, &transcode_resolution, &job_id))
                } else {
                    source_path
                };

                match final_path.and_then(|path| validate_output_file(&path).ok().map(|_| path)) {
                    Some(path) => {
                        update_job(&job_id, |job| {
                            mark_job_completed(job);
                            job.history.status = "completed".to_string();
                            job.history.filename = PathBuf::from(&path).file_name().map(|name| name.to_string_lossy().to_string());
                            job.history.output_path = Some(path);
                        });
                        if let Ok(jobs) = jobs().lock() {
                            if let Some(job) = jobs.get(&job_id) {
                                write_history(job.history.clone());
}
}
                    }
                    None => update_job(&job_id, |job| {
                        if job.response.status != "cancelled" {
                            job.response.status = "failed".to_string();
                            job.response.error = Some(if transcode_requested {
                                "3GP conversion failed".to_string()
                            } else {
                                "Downloaded media failed validation".to_string()
                            });
                            job.history.status = "failed".to_string();
                            write_history(job.history.clone());
                            // Remove leftover .part / invalid output to prevent orphaned PART files in download folder
                            cleanup_output_part_files(job);
                        }
                    }),
                }
                if let Ok(jobs) = jobs().lock() {
                    if let Some(job) = jobs.get(&job_id) {
                        cleanup_temp_directory(&job.temp_directory);
                    }
                }
            }
            Ok(_) => update_job(&job_id, |job| {
                if job.response.status != "cancelled" {
                    job.response.status = "failed".to_string();
                    job.response.error = Some("Download failed".to_string());
                    job.history.status = "failed".to_string();
                    write_history(job.history.clone());
                    cleanup_output_part_files(job);
                }
                cleanup_temp_directory(&job.temp_directory);
                job.process_id = None;
            }),
            Err(_) => update_job(&job_id, |job| {
                job.response.status = "failed".to_string();
                job.response.error = Some("Download process could not be monitored".to_string());
                job.history.status = "failed".to_string();
                write_history(job.history.clone());
                cleanup_output_part_files(job);
                cleanup_temp_directory(&job.temp_directory);
                job.process_id = None;
            }),
        }
    });

    Ok(response)
}

pub fn get_download_job_impl(job_id: String) -> Result<DownloadJobResponse, String> {
    jobs().lock().map_err(|_| "Unable to read download job".to_string())?
        .get(&job_id)
        .map(|job| job.response.clone())
        .ok_or_else(|| "Download job not found".to_string())
}

fn mark_job_paused(job: &mut JobState) {
    job.response.status = "paused".to_string();
    // freeze: keep peak percent/bytes, do not clear aggregator
}

fn mark_job_resumed(job: &mut JobState) {
    job.response.status = "downloading".to_string();
}

fn mark_job_cancelled(job: &mut JobState) {
    job.response.status = "cancelled".to_string();
    job.response.error = Some("Download cancelled by user".to_string());
    job.history.status = "cancelled".to_string();
    job.process_id = None;
}

fn mark_job_converting(job: &mut JobState) {
    job.response.status = "converting".to_string();
    if let Some(floor) = job.aggregator.apply_phase_floor("converting") {
        job.response.percent = Some(floor);
    }
    job.response.speed_bytes_per_second = None;
    job.response.eta_seconds = None;
}

fn mark_job_validating(job: &mut JobState) {
    job.response.status = "validating".to_string();
    if let Some(floor) = job.aggregator.apply_phase_floor("validating") {
        job.response.percent = Some(floor);
    }
    job.response.speed_bytes_per_second = None;
    job.response.eta_seconds = None;
}

fn mark_job_processing(job: &mut JobState) {
    job.response.status = "processing".to_string();
    if let Some(floor) = job.aggregator.apply_phase_floor("processing") {
        job.response.percent = Some(floor);
    }
    job.response.speed_bytes_per_second = None;
    job.response.eta_seconds = None;
}

fn mark_job_completed(job: &mut JobState) {
    job.response.status = "completed".to_string();
    job.aggregator.peak_percent = 100.0;
    job.response.percent = Some(100.0);
}

fn transcode_to_3gp_file(source_path: &str, resolution: &str, job_id: &str) -> Option<String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return None;
    }

    let output = source.with_extension("3gp");
    let height = resolution_dimensions(resolution).1;
    let args = build_3gp_transcode_args(source_path, &output.to_string_lossy(), height);
    let ffmpeg_bin = resolve_ffmpeg().unwrap_or_else(|_| "ffmpeg".to_string());
    let mut child = cmd_hidden(ffmpeg_bin)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let process_id = child.id();
    update_job(job_id, |job| job.process_id = Some(process_id));
    let result = child.wait();
    let succeeded = result.as_ref().map(|status| status.success()).unwrap_or(false) && output.is_file();
    update_job(job_id, |job| {
        job.process_id = None;
        if succeeded {
            job.response.output_path = Some(output.to_string_lossy().to_string());
            job.response.filename = output.file_name().map(|name| name.to_string_lossy().to_string());
            job.history.filename = output.file_name().map(|name| name.to_string_lossy().to_string());
            job.history.output_path = Some(output.to_string_lossy().to_string());
            mark_job_validating(job);
        }
    });

    if succeeded {
        Some(output.to_string_lossy().to_string())
    } else {
        None
    }
}

pub fn cancel_download_impl(job_id: String) -> Result<DownloadJobResponse, String> {
    let process_id = jobs().lock().map_err(|_| "Unable to cancel download job".to_string())?
        .get(&job_id)
        .and_then(|job| job.process_id);

    if let Some(process_id) = process_id {
        let _ = cmd_hidden("taskkill")
            .args(["/PID", &process_id.to_string(), "/T", "/F"])
            .status();
    }

    update_job(&job_id, mark_job_cancelled);

    if let Ok(jobs) = jobs().lock() {
        if let Some(job) = jobs.get(&job_id) {
            write_history(job.history.clone());
            cleanup_output_part_files(job);
            cleanup_temp_directory(&job.temp_directory);
        }
    }

    get_download_job_impl(job_id)
}

pub fn pause_download_impl(job_id: String) -> Result<DownloadJobResponse, String> {
    let (process_id, status) = jobs().lock().map_err(|_| "Unable to read download job".to_string())?
        .get(&job_id)
        .map(|job| (job.process_id, job.response.status.clone()))
        .ok_or_else(|| "Download job not found".to_string())?;

    if status == "paused" {
        return get_download_job_impl(job_id);
    }

    if !matches!(status.as_str(), "queued" | "downloading") {
        return Err("Download can only be paused while queued or downloading".to_string());
    }

    let process_id = process_id.ok_or_else(|| "Download process is no longer running".to_string())?;
    if !suspend_process_tree(process_id) {
        return Err("Unable to pause the download process".to_string());
    }

    update_job(&job_id, |job| {
        mark_job_paused(job);
        job.response.error = None;
    });

    get_download_job_impl(job_id)
}

pub fn resume_download_impl(job_id: String) -> Result<DownloadJobResponse, String> {
    let (process_id, status) = jobs().lock().map_err(|_| "Unable to read download job".to_string())?
        .get(&job_id)
        .map(|job| (job.process_id, job.response.status.clone()))
        .ok_or_else(|| "Download job not found".to_string())?;

    if status != "paused" {
        return Err("Only paused downloads can be resumed".to_string());
    }

    let process_id = process_id.ok_or_else(|| "Paused download process is no longer running".to_string())?;
    if !resume_process_tree(process_id) {
        return Err("Unable to resume the download process".to_string());
    }

    update_job(&job_id, mark_job_resumed);

    get_download_job_impl(job_id)
}

pub fn get_download_history_impl() -> Vec<DownloadHistoryEntry> {
    let history = read_history();
    let (kept, removed_count) = partition_history_by_existing_files(history);
    if removed_count > 0 {
        write_history_entries(&kept);
    }
    kept
}

pub fn delete_download_history_impl(request: DeleteHistoryRequest) -> Result<Vec<DownloadHistoryEntry>, String> {
    let history = read_history();
    match remove_history_entry(history, &request.timestamp, request.output_path.as_deref()) {
        Some(remaining) => {
            write_history_entries(&remaining);
            Ok(remaining)
        }
        None => Err("History entry was not found".to_string()),
    }
}

pub fn clear_download_history_impl() -> Vec<DownloadHistoryEntry> {
    write_history_entries(&[]);
    Vec::new()
}

pub fn cleanup_broken_files_impl(output_directory: Option<String>) -> Result<Vec<String>, String> {
    // Determine directory to scan
    let dir = if let Some(p) = output_directory.as_deref().filter(|s| !s.trim().is_empty()) {
        match sanitize_output_directory(p) {
            Ok(d) => d,
            Err(e) => return Err(e),
        }
    } else {
        // Fallback to default download directory
        let default_path = std::env::var_os("USERPROFILE")
            .map(|p| PathBuf::from(p).join("Downloads").join("KWL Video Downloader"))
            .unwrap_or_else(|| std::env::temp_dir().join("kwl-video-downloader").join("downloads"));
        let _ = fs::create_dir_all(&default_path);
        default_path
    };

    if !dir.is_dir() {
        return Ok(vec![]);
    }

    // Collect active job paths to protect
    let active_output_paths: Vec<PathBuf> = jobs().lock().ok().map(|jobs| {
        jobs.values()
            .filter(|job| matches!(job.response.status.as_str(), "queued" | "downloading" | "paused" | "processing" | "converting" | "validating"))
            .filter_map(|job| job.response.output_path.as_ref().map(|p| PathBuf::from(p)))
            .collect()
    }).unwrap_or_default();

    let has_active = has_active_download_jobs();

    let partial_exts = ["part", "ytdl", "tmp", "m3u8"];
    let completed_exts = ["mp4", "mp3", "3gp", "webm", "m4a", "opus", "wav", "mkv", "avi", "mov", "flv"];

    let mut deleted: Vec<String> = Vec::new();

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();

        // Never delete completed files
        if completed_exts.contains(&ext.as_str()) {
            continue;
        }

        // Only consider partial files
        if !partial_exts.contains(&ext.as_str()) {
            // Also check for .part in complex extensions like .mp4.part (extension is "part" already handled)
            // But also check if filename contains .part
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !fname.contains(".part") && !partial_exts.iter().any(|pe| fname.ends_with(pe)) {
                continue;
            }
        }

        // Check if file belongs to active job - protect it
        let mut is_active_file = false;
        if has_active {
            for active_path in &active_output_paths {
                // If active job's output_path is a directory containing this file, protect
                if active_path.is_dir() && path.starts_with(active_path) {
                    is_active_file = true;
                    break;
                }
                if &path == active_path {
                    is_active_file = true;
                    break;
                }
                // Also check filename contains job's temp? Use simple check: if file was modified very recently (< 5 sec) and active, protect
            }
            // For active jobs, only allow deletion of 0-byte or old files, not recent partials
            if is_active_file {
                // Check 0-byte or old
                if let Ok(meta) = fs::metadata(&path) {
                    if meta.len() != 0 {
                        if let Ok(modified) = meta.modified() {
                            if let Ok(age) = modified.elapsed() {
                                if age.as_secs() < 7 * 24 * 3600 && age.as_secs() < 60 {
                                    // Recent file (<60s) from active job - protect
                                    continue;
                                }
                                // Older than 7 days - allow deletion even if active (orphaned)
                                if age.as_secs() < 7 * 24 * 3600 {
                                    continue;
                                }
                            }
                        } else {
                            continue;
                        }
                    }
                } else {
                    continue;
                }
            }
        }

        // Safety: 0-byte files always delete
        let mut should_delete = false;
        let fname_for_check = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let is_part = partial_exts.contains(&ext.as_str()) || fname_for_check.contains(".part");
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() == 0 {
                should_delete = true;
            } else if let Ok(modified) = meta.modified() {
                if let Ok(age) = modified.elapsed() {
                    if age.as_secs() >= 7 * 24 * 3600 {
                        should_delete = true;
                    }
                    // Orphaned .part files (not from active job) older than 60s should be deleted even when has_active
                    if !is_active_file && is_part && age.as_secs() >= 60 {
                        should_delete = true;
                    }
                }
            }
            // If no active jobs, all partial files are orphaned -> delete immediately
            if !has_active && is_part {
                should_delete = true;
            }
        }

        if should_delete {
            // Graceful retry for Windows file-in-use: yt-dlp may still hold .part handle briefly
            let mut success = false;
            for attempt in 0..3 {
                match fs::remove_file(&path) {
                    Ok(_) => {
                        eprintln!("[CLEANUP] Deleted broken file: {}", path.display());
                        success = true;
                        break;
                    }
                    Err(e) => {
                        let msg = e.to_string().to_ascii_lowercase();
                        let in_use = msg.contains("being used by another process")
                            || msg.contains("access is denied")
                            || e.kind() == std::io::ErrorKind::PermissionDenied;
                        if in_use && attempt < 2 {
                            std::thread::sleep(std::time::Duration::from_millis(150 * (attempt as u64 + 1)));
                            continue;
                        }
                        if in_use {
                            eprintln!("[CLEANUP] Skipped in-use file (will retry next cleanup): {} ({})", path.display(), e);
                        } else {
                            eprintln!("[CLEANUP] Failed to delete {}: {}", path.display(), e);
                        }
                        break;
                    }
                }
            }
            if success {
                deleted.push(path.to_string_lossy().to_string());
            }
        }
    }

    Ok(deleted)
}

pub fn delete_history_by_url_impl(url: String) -> Vec<DownloadHistoryEntry> {
    let history = read_history();
    let original_len = history.len();
    let remaining: Vec<DownloadHistoryEntry> = history
        .into_iter()
        .filter(|entry| {
            if entry.url.as_deref() == Some(url.as_str()) {
                // Keep only completed entries for this URL, remove failed/cancelled
                entry.status.eq_ignore_ascii_case("completed")
            } else {
                true
            }
        })
        .collect();
    if remaining.len() != original_len {
        write_history_entries(&remaining);
    }
    remaining
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::thread;

    use super::parse_progress_line;
    use super::parse_template_progress_line;
    use super::{build_media_analysis_payload, cleanup_temp_directory, create_temp_directory, validate_output_file};

    #[test]
    fn parses_yt_dlp_progress_values() {
        let progress = parse_progress_line("[download] 42.5% of 10.00MiB at 2.00MiB/s ETA 00:03");

        assert_eq!(progress.0, Some(42.5));
        assert_eq!(progress.1, Some(4_456_448));
        assert_eq!(progress.2, Some(10 * 1024 * 1024));
        assert_eq!(progress.3, Some(2.0 * 1024.0 * 1024.0));
        assert_eq!(progress.4, Some(3));
    }

    #[test]
    fn ignores_lines_without_progress_values() {
        assert_eq!(parse_progress_line("[Merger] Merging formats"), (None, None, None, None, None));
    }

    #[test]
    fn maps_safe_metadata_and_format_fields() {
        let source = serde_json::json!({
            "id": "fixture-1",
            "title": "Fixture video",
            "uploader": "Fixture channel",
            "duration": 12.5,
            "thumbnail": "https://example.com/thumb.jpg",
            "formats": [{
                "format_id": "137",
                "ext": "mp4",
                "vcodec": "avc1.640028",
                "acodec": "none",
                "width": 1920,
                "height": 1080,
                "fps": 30.0,
                "tbr": 1200.0,
                "filesize": 2048
            }]
        });
        let mapped = serde_json::from_str::<serde_json::Value>(&build_media_analysis_payload(&source, "https://example.com/video")).expect("mapped response should be JSON");
        let format = &mapped["formats"][0];

        assert_eq!(mapped["title"], "Fixture video");
        assert_eq!(mapped["author"], "Fixture channel");
        assert_eq!(mapped["thumbnail"], "https://example.com/thumb.jpg");
        assert_eq!(format["width"], 1920);
        assert_eq!(format["height"], 1080);
        assert_eq!(format["requiresMerge"], true);
    }

    #[test]
    fn ignores_malformed_progress_values() {
        assert_eq!(parse_progress_line("[download] ???% of unknown at ??? ETA ??"), (None, None, None, None, None));
    }

    #[test]
    fn parses_machine_readable_progress_template() {
        let progress = parse_template_progress_line(r"KWLPROG 130523648 192167936 NA 5055297 19 C:\temp\video.mp4.part")
            .expect("template progress line should parse");

        assert_eq!(progress.downloaded_bytes, Some(130_523_648));
        assert_eq!(progress.total_bytes, Some(192_167_936));
        assert_eq!(progress.speed_bytes_per_second, Some(5_055_297.0));
        assert_eq!(progress.eta_seconds, Some(19));
        assert_eq!(progress.filename.as_deref(), Some(r"C:\temp\video.mp4.part"));
        let percent = progress.percent.expect("percent should be computed from bytes");
        let expected = (130_523_648_f64 / 192_167_936_f64) * 100.0;
        assert!((percent - expected).abs() < 0.001, "percent {percent} should match {expected}");
    }

    #[test]
    fn uses_estimated_total_when_total_bytes_are_missing() {
        let progress = parse_template_progress_line("KWLPROG 1000 NA 2000 512 5").expect("template line should parse");

        assert_eq!(progress.total_bytes, Some(2000));
        assert_eq!(progress.percent, Some(50.0));
        assert_eq!(progress.downloaded_bytes, Some(1000));
    }

    #[test]
    fn reports_no_percent_when_total_size_is_unavailable() {
        let progress = parse_template_progress_line("KWLPROG 4096 NA NA 2048 12").expect("template line should parse");

        assert_eq!(progress.percent, None);
        assert_eq!(progress.downloaded_bytes, Some(4096));
        assert_eq!(progress.total_bytes, None);
        assert_eq!(progress.speed_bytes_per_second, Some(2048.0));
        assert_eq!(progress.eta_seconds, Some(12));
    }

    #[test]
    fn tolerates_malformed_template_values() {
        let progress = parse_template_progress_line("KWLPROG abc def NA NA NA").expect("template prefix should still parse");

        assert_eq!(progress.downloaded_bytes, None);
        assert_eq!(progress.total_bytes, None);
        assert_eq!(progress.percent, None);
        assert_eq!(progress.speed_bytes_per_second, None);
        assert_eq!(progress.eta_seconds, None);
    }

    #[test]
    fn clamps_template_percent_at_100() {
        let progress = parse_template_progress_line("KWLPROG 5000 1000 NA NA NA").expect("template line should parse");

        assert_eq!(progress.percent, Some(100.0));
    }

    #[test]
    fn ignores_non_template_progress_lines() {
        assert!(parse_template_progress_line("[download] 42.5% of 10.00MiB at 2.00MiB/s ETA 00:03").is_none());
        assert!(parse_template_progress_line("[Merger] Merging formats into \"video.mp4\"").is_none());
        assert!(parse_template_progress_line("").is_none());
    }

    fn job_state_fixture(status: &str) -> super::JobState {
        super::JobState {
            response: super::DownloadJobResponse {
                id: "job-fixture-1".to_string(),
                status: status.to_string(),
                output_path: Some("C:\\media\\video.mp4".to_string()),
                filename: Some("video.mp4".to_string()),
                percent: Some(42.0),
                downloaded_bytes: Some(1024),
                total_bytes: Some(2048),
                speed_bytes_per_second: Some(512.0),
                eta_seconds: Some(2),
                error: None,
            },
            process_id: Some(4321),
            history: super::DownloadHistoryEntry {
                filename: None,
                media_type: "video".to_string(),
                format: "mp4".to_string(),
                resolution: Some("1080p".to_string()),
                status: status.to_string(),
                timestamp: "2026-08-25T12:00:00Z".to_string(),
                output_path: Some("C:\\media\\video.mp4".to_string()),
                thumbnail: None,
                url: Some("https://example.com/video".to_string()),
            },
            temp_directory: std::env::temp_dir().join("kwl-video-downloader-fixture"),
            aggregator: super::ProgressAggregator::new(),
        }
    }

    #[test]
    fn pause_marks_job_paused_without_cancel_or_history_change() {
        let mut job = job_state_fixture("downloading");
        super::mark_job_paused(&mut job);

        assert_eq!(job.response.status, "paused");
        assert_ne!(job.response.status, "cancelled");
        assert_eq!(job.history.status, "downloading");
        assert_eq!(job.process_id, Some(4321));
        assert_eq!(job.response.percent, Some(42.0));
        assert_eq!(job.response.downloaded_bytes, Some(1024));
    }

    #[test]
    fn resume_restores_downloading_without_new_job_or_history_entry() {
        let mut job = job_state_fixture("paused");
        let original_id = job.response.id.clone();
        super::mark_job_resumed(&mut job);

        assert_eq!(job.response.status, "downloading");
        assert_eq!(job.response.id, original_id);
        assert_eq!(job.history.status, "paused", "resume must not mutate or write history");
        assert_eq!(job.process_id, Some(4321));
        assert_eq!(job.temp_directory, std::env::temp_dir().join("kwl-video-downloader-fixture"));
    }

    #[test]
    fn cancel_marks_cancelled_and_clears_process_without_touching_pause_state() {
        let mut paused_job = job_state_fixture("paused");
        super::mark_job_cancelled(&mut paused_job);
        assert_eq!(paused_job.response.status, "cancelled");
        assert_eq!(paused_job.history.status, "cancelled");
        assert!(paused_job.process_id.is_none());

        let mut running_job = job_state_fixture("downloading");
        super::mark_job_cancelled(&mut running_job);
        assert_ne!(running_job.response.status, "paused");
        assert_eq!(running_job.response.status, "cancelled");
    }

    #[test]
    fn pause_resume_cycle_keeps_single_job_identity() {
        let mut job = job_state_fixture("downloading");
        let original_id = job.response.id.clone();
        let original_history_len_reference = job.history.timestamp.clone();

        super::mark_job_paused(&mut job);
        super::mark_job_resumed(&mut job);
        super::mark_job_paused(&mut job);

        assert_eq!(job.response.id, original_id);
        assert_eq!(job.response.status, "paused");
        assert_eq!(job.history.timestamp, original_history_len_reference);
    }

    fn sync_history_fixture(output_paths: &[(&str, &str)]) -> Vec<super::DownloadHistoryEntry> {
        output_paths
            .iter()
            .enumerate()
            .map(|(index, (status, path))| super::DownloadHistoryEntry {
                filename: Some("media.mp4".to_string()),
                media_type: "video".to_string(),
                format: "mp4".to_string(),
                resolution: Some("1080p".to_string()),
                status: status.to_string(),
                timestamp: format!("2026-08-25T12:{:02}:00Z", index),
                output_path: Some(path.to_string()),
                thumbnail: None,
                url: Some("https://example.com/video".to_string()),
            })
            .collect()
    }

    #[test]
    fn sync_keeps_history_entries_whose_output_file_exists() {
        let existing = std::env::temp_dir().join("kwl-sync-existing.mp4");
        fs::write(&existing, b"data").expect("fixture file should be writable");
        let history = sync_history_fixture(&[("completed", existing.to_string_lossy().as_ref())]);

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 0);
        assert_eq!(kept.len(), 1);
        assert!(existing.is_file(), "sync must never delete real files");
        let _ = fs::remove_file(&existing);
    }

    #[test]
    fn sync_removes_history_entries_whose_output_file_is_missing() {
        let missing = std::env::temp_dir().join("kwl-sync-missing-does-not-exist.mp4");
        let _ = fs::remove_file(&missing);
        let history = sync_history_fixture(&[("completed", missing.to_string_lossy().as_ref())]);

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 1);
        assert!(kept.is_empty());
    }

    #[test]
    fn sync_removes_only_missing_file_entries_and_keeps_the_rest() {
        let existing = std::env::temp_dir().join("kwl-sync-mixed-existing.mp4");
        fs::write(&existing, b"data").expect("fixture file should be writable");
        let missing = std::env::temp_dir().join("kwl-sync-mixed-missing.mp4");
        let _ = fs::remove_file(&missing);
        let history = sync_history_fixture(&[
            ("completed", existing.to_string_lossy().as_ref()),
            ("completed", missing.to_string_lossy().as_ref()),
            ("failed", missing.to_string_lossy().as_ref()),
            ("cancelled", missing.to_string_lossy().as_ref()),
        ]);

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 1);
        assert_eq!(kept.len(), 3);
        assert!(kept.iter().any(|entry| entry.status == "failed"));
        assert!(kept.iter().any(|entry| entry.status == "cancelled"));
        assert!(existing.is_file(), "sync must never delete real files");
        let _ = fs::remove_file(&existing);
    }

    #[test]
    fn sync_supports_unicode_and_space_paths() {
        let existing = std::env::temp_dir().join("KWL ডাউনলোড file with spaces.mp4");
        fs::write(&existing, b"data").expect("fixture file should be writable");
        let missing = std::env::temp_dir().join("KWL হারানো ফাইল.mp4");
        let _ = fs::remove_file(&missing);
        let history = sync_history_fixture(&[
            ("completed", existing.to_string_lossy().as_ref()),
            ("completed", missing.to_string_lossy().as_ref()),
        ]);

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 1);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].output_path.as_deref(), Some(existing.to_string_lossy().as_ref()));
        assert!(existing.is_file());
        let _ = fs::remove_file(&existing);
    }

    #[test]
    fn sync_removes_completed_entries_without_output_path() {
        let mut history = sync_history_fixture(&[("completed", "C:\\definitely-unused-path.mp4")]);
        history[0].output_path = None;

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 1);
        assert!(kept.is_empty());
    }

    #[test]
    fn sync_reconciliation_is_idempotent() {
        let existing = std::env::temp_dir().join("kwl-sync-idempotent.mp4");
        fs::write(&existing, b"data").expect("fixture file should be writable");
        let missing = std::env::temp_dir().join("kwl-sync-idempotent-missing.mp4");
        let _ = fs::remove_file(&missing);
        let history = sync_history_fixture(&[
            ("completed", existing.to_string_lossy().as_ref()),
            ("completed", missing.to_string_lossy().as_ref()),
        ]);

        let (kept_once, removed_once) = super::partition_history_by_existing_files(history);
        let (kept_twice, removed_twice) = super::partition_history_by_existing_files(kept_once.clone());

        assert_eq!(removed_once, 1);
        assert_eq!(removed_twice, 0);
        assert_eq!(kept_once.len(), 1);
        assert_eq!(kept_twice.len(), 1);
        assert!(existing.is_file());
        let _ = fs::remove_file(&existing);
    }

    #[test]
    fn sync_keeps_active_and_in_progress_history_records() {
        let history = sync_history_fixture(&[
            ("downloading", "C:\\does-not-matter\\a.mp4"),
            ("queued", "C:\\does-not-matter\\b.mp4"),
            ("processing", "C:\\does-not-matter\\c.mp4"),
            ("converting", "C:\\does-not-matter\\d.mp4"),
            ("validating", "C:\\does-not-matter\\e.mp4"),
            ("paused", "C:\\does-not-matter\\f.mp4"),
        ]);

        let (kept, removed) = super::partition_history_by_existing_files(history);

        assert_eq!(removed, 0);
        assert_eq!(kept.len(), 6);
    }

    #[test]
    fn validates_real_media_with_ffprobe() {
        let media_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..\\..\\..\\artifacts\\sample-test.mp4");
        if std::env::var_os("KWL_FFPROBE_PATH").is_some() || super::cmd_hidden("ffprobe").arg("-version").output().is_ok() {
            assert!(validate_output_file(&media_path.to_string_lossy()).is_ok());
        }
    }

    #[test]
    fn rejects_missing_media_output() {
        assert!(validate_output_file("C:\\does-not-exist\\kwl-output.mp4").is_err());
    }

    #[test]
    fn cleans_job_temp_workspace() {
        let path = create_temp_directory("native-test-cleanup").expect("temp directory should be created");
        fs::write(path.join("partial.part"), b"partial").expect("fixture should be writable");
        cleanup_temp_directory(&path);
        assert!(!path.exists());
    }

    #[test]
    fn generates_unique_job_ids_for_concurrent_starts() {
        let ids = (0..100).map(|_| super::next_job_id()).collect::<std::collections::HashSet<_>>();
        assert_eq!(ids.len(), 100);
    }

    fn history_fixture() -> Vec<super::DownloadHistoryEntry> {
        vec![
            super::DownloadHistoryEntry {
                filename: Some("first.mp4".to_string()),
                media_type: "video".to_string(),
                format: "mp4".to_string(),
                resolution: Some("1080p".to_string()),
                status: "completed".to_string(),
                timestamp: "2026-08-25T10:00:00Z".to_string(),
                output_path: Some("C:\\media\\first.mp4".to_string()),
                thumbnail: None,
                url: None,
            },
            super::DownloadHistoryEntry {
                filename: Some("second.m4a".to_string()),
                media_type: "audio".to_string(),
                format: "m4a".to_string(),
                resolution: None,
                status: "completed".to_string(),
                timestamp: "2026-08-25T11:00:00Z".to_string(),
                output_path: Some("C:\\media\\second.m4a".to_string()),
                thumbnail: None,
                url: None,
            },
        ]
    }

    #[test]
    fn removes_only_the_matching_history_entry() {
        let remaining = super::remove_history_entry(history_fixture(), "2026-08-25T10:00:00Z", Some("C:\\media\\first.mp4"))
            .expect("matching entry should be removed");

        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].filename.as_deref(), Some("second.m4a"));
    }

    #[test]
    fn removes_matching_timestamp_when_output_path_is_absent() {
        let remaining = super::remove_history_entry(history_fixture(), "2026-08-25T11:00:00Z", None)
            .expect("matching entry should be removed");

        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].filename.as_deref(), Some("first.mp4"));
    }

    #[test]
    fn keeps_history_unchanged_when_no_entry_matches() {
        let remaining = super::remove_history_entry(history_fixture(), "2026-08-25T00:00:00Z", Some("C:\\media\\missing.mp4"));

        assert!(remaining.is_none());
    }

    #[test]
    fn parses_resolution_height_values() {
        assert_eq!(super::resolution_height("720p"), Some(720));
        assert_eq!(super::resolution_height("1080p"), Some(1080));
        assert_eq!(super::resolution_height("144p"), Some(144));
        assert_eq!(super::resolution_height("Best"), None);
        assert_eq!(super::resolution_height("0p"), None);
        assert_eq!(super::resolution_height(""), None);
    }

    #[test]
    fn parses_resolution_dimensions_from_tier_and_exact_values() {
        assert_eq!(super::resolution_dimensions("1080p"), (None, Some(1080)));
        assert_eq!(super::resolution_dimensions("1920x1080"), (Some(1920), Some(1080)));
        assert_eq!(super::resolution_dimensions("1920\u{00d7}1080"), (Some(1920), Some(1080)));
        assert_eq!(super::resolution_dimensions("256x144"), (Some(256), Some(144)));
        assert_eq!(super::resolution_dimensions("Best"), (None, None));
        assert_eq!(super::resolution_dimensions(""), (None, None));
        assert_eq!(super::resolution_dimensions("0x0"), (None, None));
    }

    #[test]
    fn builds_container_specific_video_selectors() {
        assert_eq!(
            super::build_video_format_selector("mp4", Some(720), None, None),
            "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best"
        );
        assert_eq!(
            super::build_video_format_selector("webm", None, None, None),
            "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best"
        );
        assert_eq!(
            super::build_video_format_selector("3gp", Some(144), None, None),
            "best[ext=3gp][height<=144]/best[ext=3gp]/best"
        );
        assert_eq!(
            super::build_video_format_selector("mkv", Some(1080), None, None),
            "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
        );
    }

    #[test]
    fn builds_video_selectors_with_exact_dimension_filters() {
        assert_eq!(
            super::build_video_format_selector("mp4", Some(1080), Some(1920), None),
            "bestvideo[ext=mp4][height<=1080][width<=1920]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080][width<=1920]/best"
        );
        assert_eq!(
            super::build_video_format_selector("mkv", Some(144), Some(256), None),
            "bestvideo[height<=144][width<=256]+bestaudio/best[height<=144][width<=256]/best"
        );
    }

    #[test]
    fn builds_video_selectors_with_fps_filter() {
        assert_eq!(
            super::build_video_format_selector("mp4", Some(1080), Some(1920), Some(30)),
            "bestvideo[ext=mp4][height<=1080][width<=1920][fps<=30]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080][width<=1920][fps<=30]/best"
        );
        assert_eq!(
            super::build_video_format_selector("transcode", Some(720), None, Some(60)),
            "bestvideo[height<=720][fps<=60]+bestaudio/best[height<=720][fps<=60]/best"
        );
    }

    fn request_fixture() -> super::DownloadRequestInput {
        super::DownloadRequestInput {
            url: "https://example.com/video".to_string(),
            media_type: "video".to_string(),
            container: "mp4".to_string(),
            quality: "Best".to_string(),
            output_directory: "C:\\media".to_string(),
            resolution: Some("1920x1080".to_string()),
            fps: None,
            transcode: None,
            duration_seconds: None,
            thumbnail: None,
            video_size_bytes: None,
            audio_size_bytes: None,
            total_size_bytes: None,
            size_known: None,
        }
    }

    #[test]
    fn accepts_a_complete_video_download_request() {
        assert_eq!(super::validate_download_request_input(&request_fixture()), Ok(()));
    }

    #[test]
    fn rejects_incomplete_download_requests() {
        let mut request = request_fixture();
        request.resolution = None;
        assert!(super::validate_download_request_input(&request).is_err());

        let mut request = request_fixture();
        request.container = "  ".to_string();
        assert!(super::validate_download_request_input(&request).is_err());

        let mut request = request_fixture();
        request.quality = String::new();
        assert!(super::validate_download_request_input(&request).is_err());

        let mut request = request_fixture();
        request.url = String::new();
        assert!(super::validate_download_request_input(&request).is_err());
    }

    #[test]
    fn rejects_invalid_fps_combinations() {
        let mut request = request_fixture();
        request.fps = Some(0);
        assert!(super::validate_download_request_input(&request).is_err());

        let mut request = request_fixture();
        request.fps = Some(60);
        request.resolution = None;
        assert!(super::validate_download_request_input(&request).is_err());

        let mut request = request_fixture();
        request.fps = Some(60);
        assert_eq!(super::validate_download_request_input(&request), Ok(()));
    }

    #[test]
    fn flags_3gp_transcode_only_for_requested_transcodes() {
        assert!(super::needs_3gp_transcode("3gp", true));
        assert!(super::needs_3gp_transcode("3GP", true));
        assert!(!super::needs_3gp_transcode("3gp", false));
        assert!(!super::needs_3gp_transcode("mp4", true));
    }

    #[test]
    fn builds_3gp_transcode_arguments() {
        let args = super::build_3gp_transcode_args("C:\\temp\\video.mp4", "C:\\temp\\video.3gp", Some(144));
        assert_eq!(args[0], "-y");
        assert_eq!(args[1], "-i");
        assert_eq!(args[2], "C:\\temp\\video.mp4");
        assert!(args.contains(&"mpeg4".to_string()));
        assert!(args.contains(&"scale=-2:144".to_string()));
        assert!(args.contains(&"aac".to_string()));
        assert_eq!(args.last().map(String::as_str), Some("C:\\temp\\video.3gp"));

        let args_without_height = super::build_3gp_transcode_args("in.mp4", "out.3gp", None);
        assert!(!args_without_height.iter().any(|argument| argument.starts_with("scale=")));
    }

    #[test]
    fn converting_state_marks_status_without_touching_history_or_process() {
        let mut job = job_state_fixture("downloading");
        super::mark_job_converting(&mut job);

        assert_eq!(job.response.status, "converting");
        assert_ne!(job.response.status, "cancelled");
        assert_eq!(job.history.status, "downloading");
        assert_eq!(job.process_id, Some(4321));
    }

    #[test]
    #[ignore]
    fn real_download_pause_resume_lifecycle() {
        let url = "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_30MB.mp4";
        let output_directory = std::env::temp_dir().join("kwl-real-lifecycle-test");
        let _ = fs::remove_dir_all(&output_directory);
        let history_before = super::get_download_history_impl().iter().filter(|entry| entry.url.as_deref() == Some(url)).count();

        let request = super::DownloadRequestInput {
            url: url.to_string(),
            media_type: "video".to_string(),
            container: "mp4".to_string(),
            quality: "360p".to_string(),
            output_directory: output_directory.to_string_lossy().to_string(),
            resolution: Some("360p".to_string()),
            fps: None,
            transcode: None,
            duration_seconds: None,
            thumbnail: None,
            video_size_bytes: None,
            audio_size_bytes: None,
            total_size_bytes: None,
            size_known: None,
        };

        let job = super::start_download_impl(request).expect("real download should start");

        let mut latest = super::get_download_job_impl(job.id.clone()).expect("job should exist");
        for _ in 0..150 {
            if latest.status == "downloading" {
                break;
            }
            thread::sleep(std::time::Duration::from_millis(100));
            latest = super::get_download_job_impl(job.id.clone()).expect("job should exist");
        }
        assert_eq!(latest.status, "downloading", "job should reach downloading, got {}", latest.status);

        for _ in 0..150 {
            if latest.percent.unwrap_or(0.0) > 0.0 {
                break;
            }
            thread::sleep(std::time::Duration::from_millis(100));
            latest = super::get_download_job_impl(job.id.clone()).expect("job should exist");
            if matches!(latest.status.as_str(), "processing" | "validating" | "completed") {
                break;
            }
        }
        assert!(latest.percent.unwrap_or(0.0) > 0.0, "real download should report progress");

        let paused = super::pause_download_impl(job.id.clone()).expect("pause should succeed");
        assert_eq!(paused.status, "paused");
        assert_ne!(paused.status, "cancelled");
        let paused_percent = paused.percent;
        let paused_bytes = paused.downloaded_bytes;
        thread::sleep(std::time::Duration::from_millis(1500));
        let frozen = super::get_download_job_impl(job.id.clone()).expect("job should exist while paused");
        assert_eq!(frozen.status, "paused", "status must stay paused");
        assert_eq!(frozen.percent, paused_percent, "percent must not change while paused");
        assert_eq!(frozen.downloaded_bytes, paused_bytes, "bytes must not change while paused");

        let resumed = super::resume_download_impl(job.id.clone()).expect("resume should succeed");
        assert_eq!(resumed.status, "downloading");
        assert_eq!(resumed.id, job.id, "resume must keep the same job id");

        let mut completed = false;
        for _ in 0..600 {
            thread::sleep(std::time::Duration::from_millis(100));
            let status = super::get_download_job_impl(job.id.clone()).expect("job should exist");
            if status.status == "completed" {
                completed = true;
                break;
            }
            if matches!(status.status.as_str(), "failed" | "cancelled") {
                panic!("download ended in {} after resume: {:?}", status.status, status.error);
            }
        }
        assert!(completed, "download should complete after resume");
        assert!(final_output_validates(&job.id), "completed output should pass ffprobe validation");

        let history_after = super::get_download_history_impl().iter().filter(|entry| entry.url.as_deref() == Some(url)).count();
        assert_eq!(history_after, history_before + 1, "pause/resume must produce exactly one new history entry");
    }

    fn final_output_validates(job_id: &str) -> bool {
        super::get_download_job_impl(job_id.to_string())
            .ok()
            .and_then(|job| job.output_path)
            .map(|path| validate_output_file(&path).is_ok())
            .unwrap_or(false)
    }

    #[test]
    fn flags_container_merge_and_remux_needs() {
        assert!(super::video_container_needs_merge("webm"));
        assert!(super::video_container_needs_merge("MKV"));
        assert!(!super::video_container_needs_merge("mp4"));
        assert!(!super::video_container_needs_merge("3gp"));

        assert!(super::video_container_remux("avi"));
        assert!(super::video_container_remux("mov"));
        assert!(super::video_container_remux("flv"));
        assert!(!super::video_container_remux("webm"));
        assert!(!super::video_container_remux("mp4"));
    }

    #[test]
    fn single_stream_progress_is_monotonic() {
        let mut agg = super::ProgressAggregator::new();
        let (p1, _, _, _, _) = agg.ingest(Some(100), Some(1000), Some(1000.0), Some(10), Some("video.mp4".to_string()));
        assert!(p1.unwrap() > 9.9 && p1.unwrap() < 10.1);
        let (p2, _, _, _, _) = agg.ingest(Some(500), Some(1000), Some(2000.0), Some(5), Some("video.mp4".to_string()));
        assert!(p2.unwrap() >= p1.unwrap());
        // Simulate backward yt-dlp report (new stream resetting to 0) — must not go backward
        let (p3, _, _, _, _) = agg.ingest(Some(0), Some(1000), Some(500.0), Some(20), Some("audio.m4a".to_string()));
        // combined: video 500 + audio 0 =500 /2000 =25% but peak was 50%, so should stay 50%
        assert!(p3.unwrap() >= p2.unwrap(), "progress must never move backward: {p3:?} vs {p2:?}");
        let (p4, _, _, _, _) = agg.ingest(Some(1000), Some(1000), Some(0.0), Some(0), Some("audio.m4a".to_string()));
        // 500+1000=1500/2000=75% -> should increase to 75
        assert!(p4.unwrap() > p3.unwrap());
    }

    #[test]
    fn byte_weighted_aggregation_of_video_and_audio() {
        let mut agg = super::ProgressAggregator::new();
        // Start both streams at low progress so weighted aggregate is monotonic from start
        let (p1, dl1, tot1, _, _) = agg.ingest(Some(10), Some(100), None, None, Some("video.mp4".to_string()));
        assert_eq!(dl1, Some(10));
        assert_eq!(tot1, Some(100));
        assert!((p1.unwrap() - 10.0).abs() < 0.1);
        // audio 10 of 100 (10%) -> combined 20/200=10% (byte-weighted, both low, stays monotonic at 10)
        let (p2, dl2, tot2, _, _) = agg.ingest(Some(10), Some(100), None, None, Some("audio.m4a".to_string()));
        assert_eq!(dl2, Some(20));
        assert_eq!(tot2, Some(200));
        assert!((p2.unwrap() - 10.0).abs() < 0.1);
        // video grows to 50
        let (p3, dl3, _, _, _) = agg.ingest(Some(50), Some(100), None, None, Some("video.mp4".to_string()));
        assert_eq!(dl3, Some(60));
        assert!((p3.unwrap() - 30.0).abs() < 0.1);
        // audio grows to 80 -> 130/200=65
        let (p4, dl4, _, _, _) = agg.ingest(Some(80), Some(100), None, None, Some("audio.m4a".to_string()));
        assert_eq!(dl4, Some(130));
        assert!((p4.unwrap() - 65.0).abs() < 0.1);
        // Monotonic check: adding a new stream after 80% video should not drop
        let mut agg2 = super::ProgressAggregator::new();
        let (pv, _, _, _, _) = agg2.ingest(Some(80), Some(100), None, None, Some("video.mp4".to_string()));
        assert!((pv.unwrap() - 80.0).abs() < 0.1);
        let (pv2, _, _, _, _) = agg2.ingest(Some(10), Some(100), None, None, Some("audio.m4a".to_string()));
        // raw would be 45 but monotonic floor keeps 80
        assert_eq!(pv2.unwrap(), 80.0);
    }

    #[test]
    fn unknown_total_size_does_not_fabricate_percent() {
        let mut agg = super::ProgressAggregator::new();
        let (p, dl, tot, _, _) = agg.ingest(Some(824 * 1024 * 1024), None, Some(18.4 * 1024.0 * 1024.0), None, Some("video.mp4".to_string()));
        assert_eq!(p, None, "unknown total must not produce percent");
        assert_eq!(dl, Some(824 * 1024 * 1024));
        assert_eq!(tot, None);
        // When total becomes known later, should produce real percent
        let (p2, _, tot2, _, _) = agg.ingest(Some(824 * 1024 * 1024), Some(1200 * 1024 * 1024), Some(18.4 * 1024.0 * 1024.0), Some(19), Some("video.mp4".to_string()));
        assert!(p2.is_some());
        assert_eq!(tot2, Some(1200 * 1024 * 1024));
    }

    #[test]
    fn merging_and_validating_do_not_reset_progress() {
        let mut agg = super::ProgressAggregator::new();
        let (p1, _, _, _, _) = agg.ingest(Some(780), Some(1000), None, None, Some("video.mp4".to_string()));
        assert_eq!(p1.unwrap().round(), 78.0);
        // merge floor 92
        let floor = agg.apply_phase_floor("processing").unwrap();
        assert_eq!(floor, 92.0);
        assert!(floor > p1.unwrap());
        // validating 98
        let floor2 = agg.apply_phase_floor("validating").unwrap();
        assert_eq!(floor2, 98.0);
        // completed 100
        let floor3 = agg.apply_phase_floor("completed").unwrap();
        assert_eq!(floor3, 100.0);
        // Ensure monotonic: if already 95, merging still stays 95 not drop to 92
        let mut agg2 = super::ProgressAggregator::new();
        let (p95, _, _, _, _) = agg2.ingest(Some(950), Some(1000), None, None, Some("video.mp4".to_string()));
        assert_eq!(p95.unwrap().round(), 95.0);
        let floor_low = agg2.apply_phase_floor("processing").unwrap();
        assert_eq!(floor_low, 95.0, "merge must not move backward from 95");
    }

    #[test]
    fn converting_phase_reuses_merge_floor_and_hides_speed_eta() {
        let mut job = job_state_fixture("downloading");
        let _ = job.aggregator.ingest(Some(600), Some(1000), Some(5000.0), Some(10), Some("video.mp4".to_string()));
        super::mark_job_converting(&mut job);
        assert_eq!(job.response.status, "converting");
        assert_eq!(job.response.percent, Some(92.0));
        assert_eq!(job.response.speed_bytes_per_second, None);
        assert_eq!(job.response.eta_seconds, None);
    }

    #[test]
    fn paused_resumed_keeps_peak_percent_and_bytes() {
        let mut agg = super::ProgressAggregator::new();
        let (p1, dl1, _, _, _) = agg.ingest(Some(680), Some(1000), Some(2000.0), Some(5), Some("video.mp4".to_string()));
        assert_eq!(p1.unwrap().round(), 68.0);
        assert_eq!(dl1, Some(680));
        // simulate pause — peak preserved
        let peak = agg.peak_percent;
        let (p2, dl2, _, _, _) = agg.ingest(Some(680), Some(1000), Some(2000.0), Some(5), Some("video.mp4".to_string()));
        assert_eq!(p2.unwrap(), peak);
        assert_eq!(dl2, Some(680));
    }

    #[test]
    fn completed_is_exactly_100_and_monotonic() {
        let mut job = job_state_fixture("validating");
        job.aggregator.peak_percent = 92.0;
        super::mark_job_completed(&mut job);
        assert_eq!(job.response.percent, Some(100.0));
        assert_eq!(job.response.status, "completed");
        // second completed stays 100
        super::mark_job_completed(&mut job);
        assert_eq!(job.response.percent, Some(100.0));
    }

    #[test]
    fn large_file_500mb_progress_is_precise() {
        let mut agg = super::ProgressAggregator::new();
        let total = 500 * 1024 * 1024;
        // 0% -> 4% -> 25% -> 50% -> 100% for large file, precise float
        let (p0, _, _, _, _) = agg.ingest(Some(0), Some(total), None, None, Some("video.mp4".to_string()));
        assert_eq!(p0.unwrap(), 0.0);
        let (p10, _, _, _, _) = agg.ingest(Some(50 * 1024 * 1024), Some(total), None, None, Some("video.mp4".to_string()));
        assert!((p10.unwrap() - 10.0).abs() < 0.01);
        let (p50, _, _, _, _) = agg.ingest(Some(250 * 1024 * 1024), Some(total), None, None, Some("video.mp4".to_string()));
        assert!((p50.unwrap() - 50.0).abs() < 0.01);
    }

    #[test]
    fn large_file_5gb_combined_video_audio() {
        let mut agg = super::ProgressAggregator::new();
        let video_total = 5 * 1024 * 1024 * 1024u64; // 5GB
        let audio_total = 3_433_755u64;
        let combined = video_total + audio_total;
        // Video starts
        let (p1, _, tot1, _, _) = agg.ingest(Some(1_073_741_824), Some(video_total), None, None, Some("video.mp4".to_string())); // 1GB
        assert!(tot1.unwrap() == video_total);
        assert!((p1.unwrap() - 20.0).abs() < 0.5);
        // Audio discovered, total increases, percent should recalc to combined and stay monotonic (not drop)
        let (p2, _, tot2, _, _) = agg.ingest(Some(1_073_741_824), Some(video_total), None, None, Some("video.mp4".to_string()));
        // Actually ingest audio
        let (p3, dl3, tot3, _, _) = agg.ingest(Some(0), Some(audio_total), None, None, Some("audio.webm".to_string()));
        assert_eq!(tot3.unwrap(), combined);
        // Combined downloaded = 1GB +0, percent ~ 19.98% (1GB/5.003GB)
        assert!((p3.unwrap() - 19.9).abs() < 1.0);
        // Download more, should increase
        let (p4, _, _, _, _) = agg.ingest(Some(2_147_483_648), Some(video_total), None, None, Some("video.mp4".to_string()));
        assert!(p4.unwrap() > p3.unwrap());
        assert!(dl3.unwrap() < 2_147_483_648 + 3_433_755);
        // Large u64 precision check: 10GB file
        let mut agg2 = super::ProgressAggregator::new();
        let ten_gb = 10 * 1024 * 1024 * 1024u64;
        let (p10, _, _, _, _) = agg2.ingest(Some(5 * 1024 * 1024 * 1024), Some(ten_gb), None, None, Some("big.mp4".to_string()));
        assert!((p10.unwrap() - 50.0).abs() < 0.01);
    }

    #[test]
    fn large_file_monotonic_with_total_increase() {
        let mut agg = super::ProgressAggregator::new();
        let video_total = 240_334_643u64;
        // Video 240MB/240M =100% -> peak 100
        let (p100, _, _, _, _) = agg.ingest(Some(video_total), Some(video_total), None, None, Some("video.mp4".to_string()));
        assert_eq!(p100.unwrap(), 100.0);
        // Audio discovered total 3.4M, combined total 243M, downloaded 240M -> raw 98.6% but monotonic keeps 100
        let (p_after, _, tot_after, _, _) = agg.ingest(Some(0), Some(3_433_755), None, None, Some("audio.webm".to_string()));
        assert_eq!(tot_after.unwrap(), 243_768_398);
        assert_eq!(p_after.unwrap(), 100.0); // monotonic peak prevents drop to 98.6
    }

    #[test]
    fn no_fabricated_eta_or_speed_when_unavailable() {
        let mut agg = super::ProgressAggregator::new();
        let (p, _, _, sp, eta) = agg.ingest(Some(100), Some(1000), None, None, Some("video.mp4".to_string()));
        assert!(p.is_some());
        assert_eq!(sp, None);
        assert_eq!(eta, None);
        let (_, _, _, sp2, eta2) = agg.ingest(Some(200), Some(1000), Some(0.0), Some(0), Some("video.mp4".to_string()));
        assert_eq!(sp2, Some(0.0));
        assert_eq!(eta2, Some(0));
    }

    #[test]
    #[ignore]
    fn real_analyze_url_returns_metadata() {
        let request = super::UrlRequest { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string() };
        let result = super::analyze_url_impl(request);
        match result {
            Ok(json) => {
                let value: serde_json::Value = serde_json::from_str(&json).expect("should be valid JSON");
                assert_eq!(value["available"], true);
                assert!(value["title"].as_str().unwrap().len() > 0);
                assert!(value["formats"].as_array().unwrap().len() > 0);
                println!("ANALYZE SUCCESS: {}", json);
            }
            Err(e) => {
                panic!("analyze_url_impl failed: {}", e);
            }
        }
    }

    #[test]
    #[ignore]
    fn real_analyze_user_url_returns_metadata() {
        let request = super::UrlRequest { url: "https://youtu.be/bfl76Sr-Rsk?si=42F5aDzFJexPpvGC".to_string() };
        let result = super::analyze_url_impl(request);
        match result {
            Ok(json) => {
                let value: serde_json::Value = serde_json::from_str(&json).expect("should be valid JSON");
                assert_eq!(value["available"], true);
                assert!(value["title"].as_str().unwrap().len() > 0);
                assert!(value["formats"].as_array().unwrap().len() > 0);
                println!("ANALYZE USER URL SUCCESS: {}", json);
            }
            Err(e) => {
                panic!("analyze_url_impl failed for user URL: {}", e);
            }
        }
    }
}

// ── Tauri command wrappers (used by mobile `run()` invoke_handler) ──
#[tauri::command]
fn validate_url(request: UrlRequest) -> Result<bool, String> {
    validate_url_impl(request)
}
#[tauri::command]
fn get_app_info() -> AppInfoResponse {
    get_app_info_impl()
}
#[tauri::command]
fn analyze_url(request: UrlRequest) -> Result<String, String> {
    analyze_url_impl(request)
}
#[tauri::command]
fn analyze_playlist(request: UrlRequest) -> Result<Vec<String>, String> {
    analyze_playlist_impl(request)
}
#[tauri::command]
fn start_download(request: DownloadRequestInput) -> Result<DownloadJobResponse, String> {
    start_download_impl(request)
}
#[tauri::command]
fn get_download_job(job_id: String) -> Result<DownloadJobResponse, String> {
    get_download_job_impl(job_id)
}
#[tauri::command]
fn cancel_download(job_id: String) -> Result<DownloadJobResponse, String> {
    cancel_download_impl(job_id)
}
#[tauri::command]
fn pause_download(job_id: String) -> Result<DownloadJobResponse, String> {
    pause_download_impl(job_id)
}
#[tauri::command]
fn resume_download(job_id: String) -> Result<DownloadJobResponse, String> {
    resume_download_impl(job_id)
}
#[tauri::command]
fn get_download_history() -> Vec<DownloadHistoryEntry> {
    get_download_history_impl()
}
#[tauri::command]
fn delete_download_history(request: DeleteHistoryRequest) -> Result<Vec<DownloadHistoryEntry>, String> {
    delete_download_history_impl(request)
}
#[tauri::command]
fn clear_download_history() -> Vec<DownloadHistoryEntry> {
    clear_download_history_impl()
}
#[tauri::command]
fn delete_history_by_url(url: String) -> Vec<DownloadHistoryEntry> {
    delete_history_by_url_impl(url)
}
#[tauri::command]
fn cleanup_broken_files(output_directory: Option<String>) -> Result<Vec<String>, String> {
    cleanup_broken_files_impl(output_directory)
}
#[tauri::command]
fn open_media_file(path: String) -> Result<(), String> {
    open_media_file_impl(path)
}
#[tauri::command]
fn reveal_media_in_explorer(path: String) -> Result<(), String> {
    reveal_media_in_explorer_impl(path)
}
#[tauri::command]
fn get_tools_status() -> tools::AllToolsStatus {
    tools::all_tools_status()
}
#[tauri::command]
fn startup_tool_check() -> tools::AllToolsStatus {
    tools::startup_health_check()
}
#[tauri::command]
fn get_tool_status(tool: String) -> tools::ToolStatusResponse {
    tools::get_tool_status(&tool)
}
#[tauri::command]
fn send_report(report: report::ReportInput) -> Result<(), String> {
    report::send_report(report)
}
#[tauri::command]
fn get_versions(app_id: Option<String>) -> Vec<versions::VersionRecord> {
    versions::get_versions_impl(app_id)
}
#[tauri::command]
fn add_version(request: versions::AddVersionInput) -> Result<Vec<versions::VersionRecord>, String> {
    versions::add_version_impl(request)
}
#[tauri::command]
fn update_version(request: versions::UpdateVersionInput) -> Result<Vec<versions::VersionRecord>, String> {
    versions::update_version_impl(request)
}
#[tauri::command]
fn delete_version(id: String) -> Result<Vec<versions::VersionRecord>, String> {
    versions::delete_version_impl(id)
}
#[tauri::command]
fn sync_github_release(payload: versions::GithubReleasePayload) -> Result<Vec<versions::VersionRecord>, String> {
    versions::sync_github_release_impl(payload)
}
#[tauri::command]
fn get_autostart_enabled() -> bool {
    autostart::is_autostart_enabled_impl()
}
#[tauri::command]
fn set_autostart_enabled(enabled: bool) -> Result<bool, String> {
    autostart::set_autostart_enabled_impl(enabled)
}

// Required for Tauri Android mobile build – provides JNI entry point and runtime symbols.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            validate_url,
            get_app_info,
            analyze_url,
            analyze_playlist,
            clear_download_history,
            start_download,
            get_download_job,
            cancel_download,
            pause_download,
            resume_download,
            get_download_history,
            delete_download_history,
            delete_history_by_url,
            cleanup_broken_files,
            open_media_file,
            reveal_media_in_explorer,
            get_tools_status,
            startup_tool_check,
            get_tool_status,
            send_report,
            get_versions,
            add_version,
            update_version,
            delete_version,
            sync_github_release,
            get_autostart_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            app_setup(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

