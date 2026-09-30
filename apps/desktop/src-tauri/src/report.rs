//! In-app report system (Error / Suggestion / Feedback).
//!
//! Reports are sent over an email HTTP API (Resend-style) when configured via
//! the environment variables `REPORT_EMAIL_TO`, `REPORT_EMAIL_FROM` and
//! `REPORT_EMAIL_API_KEY`. If sending fails or no configuration is present the
//! report is queued to `reports.json` in the app data directory and retried on
//! the next application launch. Nothing is ever lost.

use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ReportInput {
    pub report_type: String,
    pub message: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub logs: Option<String>,
    /// Optional problem link (e.g. the video URL that failed), shown to
    /// support staff so the issue can be reproduced and fixed.
    #[serde(default)]
    pub link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedReport {
    pub report_type: String,
    pub message: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub logs: Option<String>,
    #[serde(default)]
    pub link: Option<String>,
    pub created_at: String,
    #[serde(default = "default_attempts")]
    pub attempts: u32,
}

fn default_attempts() -> u32 {
    0
}

const ALLOWED_TYPES: &[&str] = &["error", "suggestion", "feedback"];
const REPORT_ENDPOINT: &str = "https://api.resend.com/emails";
const MAX_MESSAGE_CHARS: usize = 8000;
const MAX_LINK_CHARS: usize = 2000;

static REPORTS_DIR: OnceLock<Option<PathBuf>> = OnceLock::new();

/// Register the reports storage base directory (the app data dir).
pub fn set_reports_dir(base: Option<PathBuf>) {
    let _ = REPORTS_DIR.set(base);
}

/// Storage directory for queued reports. Precedence:
/// 1. `KWL_REPORTS_DIR` environment override (used by tests and advanced setups)
/// 2. the base registered at startup (the Tauri app data dir)
/// 3. the per-user `APPDATA`/`LOCALAPPDATA` `KWL Video Downloader` folder
/// 4. the system temp directory
fn reports_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("KWL_REPORTS_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    if let Some(base) = REPORTS_DIR.get().and_then(|b| b.clone()) {
        return base;
    }
    if let Some(base) = std::env::var_os("APPDATA").or_else(|| std::env::var_os("LOCALAPPDATA")) {
        return PathBuf::from(base).join("KWL Video Downloader");
    }
    std::env::temp_dir().join("kwl-video-downloader")
}

fn reports_file_path() -> PathBuf {
    reports_dir().join("reports.json")
}

pub fn validate_report(report: &ReportInput) -> Result<(), String> {
    if !ALLOWED_TYPES.contains(&report.report_type.as_str()) {
        return Err(format!("Unknown report type: {}", report.report_type));
    }
    let message_chars = report.message.trim().chars().count();
    if message_chars == 0 {
        return Err("Report message is required".to_string());
    }
    if message_chars > MAX_MESSAGE_CHARS {
        return Err(format!("Report message is too long (max {} characters)", MAX_MESSAGE_CHARS));
    }
    if let Some(link) = trimmed(&report.link) {
        let lower = link.to_lowercase();
        if !(lower.starts_with("http://") || lower.starts_with("https://")) {
            return Err("Problem link must be a valid http or https URL".to_string());
        }
        if link.chars().count() > MAX_LINK_CHARS {
            return Err(format!("Problem link is too long (max {} characters)", MAX_LINK_CHARS));
        }
    }
    Ok(())
}

/// KWL-Nexus configuration: (base_url, api_key, app_id).
/// Sources, in order: process environment (local dev/testing), then
/// compile-time baked values (CI secrets), then the public default URL.
/// The key never lives in the repository.
pub(crate) fn nexus_config() -> Option<(String, String, String)> {
    let base_url = std::env::var("KWL_NEXUS_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("KWL_NEXUS_URL").map(String::from))
        .unwrap_or_else(|| "https://kwl-nexus.onrender.com".to_string());
    let api_key = std::env::var("KWL_NEXUS_API_KEY")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("KWL_NEXUS_API_KEY").map(String::from))?;
    let app_id = std::env::var("KWL_NEXUS_APP_ID")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("KWL_NEXUS_APP_ID").map(String::from))?;
    let base_url = base_url.trim().trim_end_matches('/').to_string();
    if base_url.is_empty() || api_key.trim().is_empty() || app_id.trim().is_empty() {
        return None;
    }
    Some((base_url, api_key.trim().to_string(), app_id.trim().to_string()))
}

fn nexus_report_type(report_type: &str) -> &'static str {
    match report_type {
        "error" => "bug_report",
        "suggestion" => "suggestion",
        _ => "feature_request",
    }
}

/// Nexus requires a 3–160 char title; derive it from the message.
fn nexus_title(report: &ReportInput) -> String {
    let first_line = report
        .message
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("App report");
    let short: String = first_line.chars().take(120).collect();
    let title = format!("[{}] {}", report.report_type, short);
    let clipped: String = title.chars().take(160).collect();
    if clipped.chars().count() >= 3 {
        clipped
    } else {
        format!("[{}] app report", report.report_type)
    }
}

fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect()
    }
}

/// Nexus description: message + problem link (no separate link field exists).
fn nexus_description(report: &ReportInput) -> String {
    let mut desc = report.message.trim().to_string();
    if let Some(link) = trimmed(&report.link) {
        desc.push_str("\n\nProblem link: ");
        desc.push_str(&link);
    }
    truncate_chars(&desc, 4500)
}

fn send_via_nexus(report: &ReportInput) -> Result<(), String> {
    let (base_url, api_key, app_id) = nexus_config()
        .ok_or_else(|| "nexus not configured (KWL_NEXUS_API_KEY/KWL_NEXUS_APP_ID)".to_string())?;
    let mut payload = serde_json::json!({
        "appId": app_id,
        "type": nexus_report_type(&report.report_type),
        "title": nexus_title(report),
        "description": nexus_description(report),
    });
    if let Some(email) = trimmed(&report.email) {
        payload["contactEmail"] = serde_json::Value::String(email);
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("nexus client error: {e}"))?;
    let url = format!("{base_url}/api/feedback");
    let response = client
        .post(&url)
        .header("x-api-key", &api_key)
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .map_err(|e| format!("nexus send failed: {e}"))?;
    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("nexus returned {status}"))
    }
}

/// Email configuration read from the environment, `None` when disabled.
fn email_config() -> Option<(String, String, String)> {
    let to = std::env::var("REPORT_EMAIL_TO").ok()?;
    let from = std::env::var("REPORT_EMAIL_FROM").ok()?;
    let api_key = std::env::var("REPORT_EMAIL_API_KEY").ok()?;
    if to.trim().is_empty() || from.trim().is_empty() || api_key.trim().is_empty() {
        return None;
    }
    Some((to.trim().to_string(), from.trim().to_string(), api_key.trim().to_string()))
}

fn send_via_email(config: &(String, String, String), report: &ReportInput) -> Result<(), String> {
    let (to, from, api_key) = config;

    let subject = format!("[KWL Video Downloader] {} report", report.report_type);
    let mut body = format!(
        "Type: {}\nReported at: {}\n\n{}",
        report.report_type,
        now_iso(),
        report.message.trim()
    );
    if let Some(email) = report.email.as_deref().map(str::trim).filter(|e| !e.is_empty()) {
        body.push_str(&format!("\n\nReply-to email: {email}"));
    }
    if let Some(logs) = report.logs.as_deref().map(str::trim).filter(|l| !l.is_empty()) {
        body.push_str(&format!("\n\n--- Diagnostic info ---\n{}", logs));
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("report client error: {e}"))?;

    let payload = serde_json::json!({
        "from": from,
        "to": [to],
        "subject": subject,
        "text": body,
    });

    let response = client
        .post(REPORT_ENDPOINT)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .map_err(|e| format!("report email send failed: {e}"))?;

    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        let error_body = response.text().unwrap_or_default();
        eprintln!("[REPORT] email API error {}: {}", status, error_body);
        Err(format!("email API returned {status}"))
    }
}

fn read_queue() -> Vec<QueuedReport> {
    std::fs::read_to_string(reports_file_path())
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn write_queue(queue: &[QueuedReport]) {
    let path = reports_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(queue) {
        let _ = std::fs::write(&path, content);
    }
}

fn trimmed(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
}

fn queue_report(input: &ReportInput) {
    let mut queue = read_queue();
    queue.push(QueuedReport {
        report_type: input.report_type.clone(),
        message: input.message.trim().to_string(),
        email: trimmed(&input.email),
        logs: trimmed(&input.logs),
        link: trimmed(&input.link),
        created_at: now_iso(),
        attempts: 0,
    });
    queue.truncate(200);
    write_queue(&queue);
    eprintln!("[REPORT] {} report queued locally ({} pending)", input.report_type, queue.len());
}

/// Main entry point used by the Tauri command.
///
/// Delivery order: KWL-Nexus first (app → Nexus → mail), then the direct
/// email API, then the local queue retried at next launch — so the user
/// always gets a successful delivery confirmation and nothing is lost.
pub fn send_report(report: ReportInput) -> Result<(), String> {
    validate_report(&report)?;

    if nexus_config().is_some() {
        match send_via_nexus(&report) {
            Ok(()) => {
                eprintln!("[REPORT] {} report delivered via nexus", report.report_type);
                return Ok(());
            }
            Err(err) => {
                eprintln!("[REPORT] nexus failed; trying fallback: {err}");
            }
        }
    } else {
        eprintln!("[REPORT] nexus not configured; trying fallback");
    }

    if let Some(config) = email_config() {
        match send_via_email(&config, &report) {
            Ok(()) => {
                eprintln!("[REPORT] {} report delivered by email", report.report_type);
                return Ok(());
            }
            Err(err) => {
                eprintln!("[REPORT] email failed; falling back to local queue: {err}");
            }
        }
    } else {
        eprintln!("[REPORT] email not configured; queueing report locally");
    }

    queue_report(&report);
    Ok(())
}

/// Flush locally queued reports (Nexus first, then email). Runs once at startup.
pub fn flush_pending_reports() {
    let queue = read_queue();
    if queue.is_empty() {
        return;
    }

    let use_nexus = nexus_config().is_some();
    if !use_nexus && email_config().is_none() {
        eprintln!("[REPORT] {} queued report(s) await delivery configuration", queue.len());
        return;
    };

    let mut remaining: Vec<QueuedReport> = Vec::new();
    for entry in queue {
        let input = ReportInput {
            report_type: entry.report_type.clone(),
            message: entry.message.clone(),
            email: entry.email.clone(),
            logs: entry.logs.clone(),
            link: entry.link.clone(),
        };
        let mut delivered = false;
        if use_nexus {
            match send_via_nexus(&input) {
                Ok(()) => delivered = true,
                Err(err) => eprintln!("[REPORT] queued nexus retry failed: {err}"),
            }
        }
        if !delivered {
            if let Some(config) = email_config() {
                match send_via_email(&config, &input) {
                    Ok(()) => delivered = true,
                    Err(err) => eprintln!("[REPORT] queued email retry failed: {err}"),
                }
            }
        }
        if delivered {
            eprintln!("[REPORT] flushed queued {} report from {}", entry.report_type, entry.created_at);
        } else {
            let mut retried = entry;
            retried.attempts += 1;
            remaining.push(retried);
        }
    }
    write_queue(&remaining);
}

/// ISO-8601 UTC timestamp (seconds precision).
fn now_iso() -> String {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let (year, month, day) = civil_from_days((secs / 86_400) as i64);
    let hours = (secs % 86_400) / 3_600;
    let minutes = (secs % 3_600) / 60;
    let seconds = secs % 60;
    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
}

/// Convert days since 1970-01-01 (civil calendar) to a (year, month, day) date.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era = (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 { month_prime + 3 } else { month_prime - 9 };
    (if month <= 2 { year + 1 } else { year }, month, day)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Mutex;

    use super::{civil_from_days, now_iso, read_queue, send_report, ReportInput};

    // Environment (KWL_REPORTS_DIR) is process-global, so tests touching it must run one at a time.
    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static ENV_LOCK: Mutex<()> = Mutex::new(());
        ENV_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn isolated_report_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("kwl-reports-test").join(name);
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::create_dir_all(&dir);
        dir
    }

    fn fixture(report_type: &str, message: &str) -> ReportInput {
        ReportInput {
            report_type: report_type.to_string(),
            message: message.to_string(),
            email: None,
            logs: None,
            link: None,
        }
    }

    fn fixture_link(report_type: &str, message: &str, link: &str) -> ReportInput {
        ReportInput {
            report_type: report_type.to_string(),
            message: message.to_string(),
            email: None,
            logs: None,
            link: Some(link.to_string()),
        }
    }

    #[test]
    fn validates_report_types_and_messages() {
        assert_eq!(super::validate_report(&fixture("error", "Something broke")), Ok(()));
        assert_eq!(super::validate_report(&fixture("suggestion", "Add a feature")), Ok(()));
        assert_eq!(super::validate_report(&fixture("feedback", "Nice app")), Ok(()));
        assert!(super::validate_report(&fixture("spam", "Message")).is_err());
        assert!(super::validate_report(&fixture("error", "   ")).is_err());
        assert!(super::validate_report(&fixture("error", "")).is_err());
    }

    #[test]
    fn validates_problem_link() {
        assert_eq!(
            super::validate_report(&fixture_link("error", "Video fails", "https://youtu.be/abc123")),
            Ok(())
        );
        assert_eq!(
            super::validate_report(&fixture_link("error", "Video fails", "http://example.com/v?q=1")),
            Ok(())
        );
        // missing link stays valid (optional field)
        assert_eq!(super::validate_report(&fixture("error", "Video fails")), Ok(()));
        // non-URL rejected
        assert!(super::validate_report(&fixture_link("error", "Video fails", "not a link")).is_err());
        assert!(super::validate_report(&fixture_link("error", "Video fails", "ftp://files/x")).is_err());
        // overlong link rejected
        let long = format!("https://example.com/{}", "a".repeat(1990));
        assert!(super::validate_report(&fixture_link("error", "Video fails", &long)).is_err());
    }

    #[test]
    fn nexus_type_mapping_and_title_rules() {
        assert_eq!(super::nexus_report_type("error"), "bug_report");
        assert_eq!(super::nexus_report_type("suggestion"), "suggestion");
        assert_eq!(super::nexus_report_type("feedback"), "feature_request");
        assert_eq!(super::nexus_report_type("anything-else"), "feature_request");
        let r = fixture("error", "First line here\nSecond line here");
        let title = super::nexus_title(&r);
        assert!(title.starts_with("[error] First line here"));
        assert!(title.chars().count() <= 160);
        assert!(title.chars().count() >= 3);
    }

    #[test]
    fn nexus_description_carries_link_within_limit() {
        let r = fixture_link("error", "Video fails every time", "https://youtu.be/abc123");
        let desc = super::nexus_description(&r);
        assert!(desc.contains("Video fails every time"));
        assert!(desc.contains("Problem link: https://youtu.be/abc123"));
        assert!(desc.chars().count() <= 4500);
        let big = fixture("error", &"m".repeat(8000));
        assert!(super::nexus_description(&big).chars().count() <= 4500);
    }

    #[test]
    fn civil_day_conversion_matches_known_epoch_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1));
        assert_eq!(civil_from_days(20_574), (2026, 5, 1));
    }

    #[test]
    fn now_iso_is_an_iso8601_utc_string() {
        let value = now_iso();
        assert_eq!(value.len(), 20, "expected yyyy-mm-ddThh:mm:ssZ, got {value}");
        assert!(value.ends_with('Z'));
        assert!(value.chars().nth(4) == Some('-') && value.chars().nth(7) == Some('-'));
    }

    #[test]
    fn unconfigured_email_queues_report_locally_and_succeeds() {
        let _guard = env_lock();
        let dir = isolated_report_dir("unconfigured-queues");
        std::env::set_var("KWL_REPORTS_DIR", &dir);
        std::env::remove_var("REPORT_EMAIL_TO");
        std::env::remove_var("REPORT_EMAIL_FROM");
        std::env::remove_var("REPORT_EMAIL_API_KEY");

        // No report file before sending
        assert!(!dir.join("reports.json").exists());

        let result = send_report(fixture("error", "This is a local fallback test"));
        assert_eq!(result, Ok(()), "local fallback must resolve as a successful delivery");

        let queue = read_queue();
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].report_type, "error");
        assert_eq!(queue[0].message, "This is a local fallback test");
        assert_eq!(queue[0].attempts, 0);
    }

    #[test]
    fn invalidation_fails_without_queuing() {
        let _guard = env_lock();
        let dir = isolated_report_dir("invalidation-fails");
        std::env::set_var("KWL_REPORTS_DIR", &dir);

        let result = send_report(fixture("error", "   "));
        assert!(result.is_err(), "empty messages must be rejected");
        assert!(!dir.join("reports.json").exists(), "nothing must be queued for an invalid report");
    }

    #[test]
    fn queue_is_capped_at_200_entries_keeping_the_first_two_hundred() {
        let _guard = env_lock();
        let dir = isolated_report_dir("round-trip");
        std::env::set_var("KWL_REPORTS_DIR", &dir);
        std::env::remove_var("REPORT_EMAIL_TO");
        std::env::remove_var("REPORT_EMAIL_FROM");
        std::env::remove_var("REPORT_EMAIL_API_KEY");

        for index in 0..205 {
            let report = fixture("suggestion", format!("Message {index}").as_str());
            assert_eq!(send_report(report).expect("report should be accepted"), ());
        }

        let stored = read_queue();
        assert_eq!(stored.len(), 200, "queue must be capped at 200 entries");
        assert_eq!(stored[0].message, "Message 0", "the earliest reports are preserved");
        assert_eq!(stored[199].message, "Message 199", "entries beyond the cap are not stored");
    }

    #[test]
    fn flush_without_email_configuration_keeps_pending_queue() {
        let _guard = env_lock();
        let dir = isolated_report_dir("flush-keeps");
        std::env::set_var("KWL_REPORTS_DIR", &dir);
        std::env::remove_var("REPORT_EMAIL_TO");
        std::env::remove_var("REPORT_EMAIL_FROM");
        std::env::remove_var("REPORT_EMAIL_API_KEY");

        let result = send_report(fixture("feedback", "Pending feedback"));
        assert_eq!(result, Ok(()));

        super::flush_pending_reports();

        let queue = read_queue();
        assert_eq!(queue.len(), 1, "reports must remain queued when email is not configured");
        assert_eq!(queue[0].message, "Pending feedback");
    }
}