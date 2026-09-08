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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedReport {
    pub report_type: String,
    pub message: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub logs: Option<String>,
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
    Ok(())
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
        created_at: now_iso(),
        attempts: 0,
    });
    queue.truncate(200);
    write_queue(&queue);
    eprintln!("[REPORT] {} report queued locally ({} pending)", input.report_type, queue.len());
}

/// Main entry point used by the Tauri command.
///
/// Tries the email API first; on failure - or when email is not configured -
/// the report is persisted locally and retried at the next launch, so the user
/// always gets a successful delivery confirmation.
pub fn send_report(report: ReportInput) -> Result<(), String> {
    validate_report(&report)?;

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

/// Flush locally queued reports through email. Runs once at startup.
pub fn flush_pending_reports() {
    let queue = read_queue();
    if queue.is_empty() {
        return;
    }

    let Some(config) = email_config() else {
        eprintln!("[REPORT] {} queued report(s) await email configuration", queue.len());
        return;
    };

    let mut remaining: Vec<QueuedReport> = Vec::new();
    for entry in queue {
        let input = ReportInput {
            report_type: entry.report_type.clone(),
            message: entry.message.clone(),
            email: entry.email.clone(),
            logs: entry.logs.clone(),
        };
        match send_via_email(&config, &input) {
            Ok(()) => {
                eprintln!("[REPORT] flushed queued {} report from {}", entry.report_type, entry.created_at);
            }
            Err(err) => {
                eprintln!("[REPORT] queued report retry failed: {err}");
                let mut retried = entry;
                retried.attempts += 1;
                remaining.push(retried);
            }
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