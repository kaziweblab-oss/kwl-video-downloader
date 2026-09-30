//! KWL-Nexus v2 integration (integration guide v2.0).
//!
//! - Heartbeat: `POST /api/apps/<id>/ping` on startup (background thread).
//! - Replies: `GET /api/feedback` lists the key owner's feedback with
//!   `adminReply` + `status`, rendered in the Help view.
//! - Features: `GET` current master list, `POST` replace when different
//!   (max 50, replace semantics), pushed on install/update.
//! - Tutorial: public `GET /api/apps/<id>/tutorial`, cached on device,
//!   offline fallback, background refresh.
//!
//! Every call has a timeout and never panics. Failures return `Err(String)`
//! for the UI to map to friendly messages. Tests are deterministic and
//! perform no network I/O.

use serde::{Deserialize, Serialize};

const HTTP_TIMEOUT_SECS: u64 = 15;
pub const MAX_FEATURES: usize = 50;

/// Desktop capability list pushed as the Nexus master feature list.
pub fn desktop_features() -> Vec<String> {
    vec![
        "video-download".to_string(),
        "audio-download".to_string(),
        "download-queue".to_string(),
        "pause-resume".to_string(),
        "download-history".to_string(),
        "3gp-transcode".to_string(),
        "runtime-tool-manager".to_string(),
        "tool-auto-update".to_string(),
        "in-app-updates".to_string(),
        "multi-language".to_string(),
        "offline-history".to_string(),
        "report-center".to_string(),
    ]
}

fn nexus_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .user_agent("KWL-Video-Downloader")
        .connect_timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("nexus client error: {e}"))
}

fn nexus_get(path: &str, api_key: Option<&str>) -> Result<serde_json::Value, String> {
    let (base_url, cfg_key, _) = crate::report::nexus_config()
        .ok_or_else(|| "nexus not configured (KWL_NEXUS_API_KEY/KWL_NEXUS_APP_ID)".to_string())?;
    let client = nexus_client()?;
    let mut req = client.get(format!("{base_url}{path}"));
    if let Some(key) = api_key.or(Some(cfg_key.as_str())) {
        if !key.is_empty() {
            req = req.header("x-api-key", key);
        }
    }
    let resp = req
        .header("Accept", "application/json")
        .send()
        .map_err(|e| format!("nexus request failed: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("nexus returned {status}"));
    }
    resp.json::<serde_json::Value>()
        .map_err(|e| format!("nexus bad json: {e}"))
}

fn nexus_post(path: &str, body: &serde_json::Value) -> Result<serde_json::Value, String> {
    let (base_url, api_key, _) = crate::report::nexus_config()
        .ok_or_else(|| "nexus not configured (KWL_NEXUS_API_KEY/KWL_NEXUS_APP_ID)".to_string())?;
    let client = nexus_client()?;
    let resp = client
        .post(format!("{base_url}{path}"))
        .header("x-api-key", &api_key)
        .header("Accept", "application/json")
        .json(body)
        .send()
        .map_err(|e| format!("nexus send failed: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("nexus returned {status}"));
    }
    resp.json::<serde_json::Value>()
        .map_err(|e| format!("nexus bad json: {e}"))
}

fn app_path(suffix: &str) -> Result<String, String> {
    let (_, _, app_id) = crate::report::nexus_config()
        .ok_or_else(|| "nexus not configured (KWL_NEXUS_API_KEY/KWL_NEXUS_APP_ID)".to_string())?;
    Ok(format!("/api/apps/{app_id}{suffix}"))
}

/// Heartbeat ping on startup. Fire-and-forget from a background thread.
pub fn ping_nexus() -> Result<String, String> {
    let path = app_path("/ping")?;
    let body = nexus_post(&path, &serde_json::json!({}))?;
    Ok(body
        .get("data")
        .and_then(|d| d.as_str())
        .unwrap_or("ok")
        .to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NexusReply {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, rename = "adminReply")]
    pub reply: String,
    #[serde(default, rename = "createdAt")]
    pub created_at: String,
}

fn parse_reply(value: &serde_json::Value) -> NexusReply {
    NexusReply {
        id: value
            .get("_id")
            .or_else(|| value.get("id"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        title: value
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        status: value
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        reply: value
            .get("adminReply")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        created_at: value
            .get("createdAt")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
    }
}

/// List feedback (with admin replies) for the configured key owner.
pub fn fetch_nexus_feedback() -> Result<Vec<NexusReply>, String> {
    let body = nexus_get("/api/feedback", None)?;
    let items = body
        .get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(items.iter().map(parse_reply).collect())
}

/// Normalize a feature list: trim, drop empties, dedupe (keep order), cap.
pub fn normalize_features(features: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for f in features {
        let s = f.trim().to_string();
        if s.is_empty() || out.contains(&s) {
            continue;
        }
        out.push(s);
        if out.len() >= MAX_FEATURES {
            break;
        }
    }
    out
}

fn features_equal(a: &[String], b: &[String]) -> bool {
    let mut sa = a.to_vec();
    let mut sb = b.to_vec();
    sa.sort();
    sb.sort();
    sa == sb
}

/// Compare-then-replace the master feature list. Returns what happened.
pub fn sync_nexus_features() -> Result<String, String> {
    let wanted = normalize_features(&desktop_features());
    let path = app_path("/features")?;
    let current_body = nexus_get(&path, None).unwrap_or(serde_json::json!({}));
    let current: Vec<String> = current_body
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    if features_equal(&current, &wanted) {
        return Ok("in-sync".to_string());
    }
    nexus_post(&path, &serde_json::json!({ "features": wanted }))?;
    Ok("updated".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NexusTutorialSection {
    #[serde(default)]
    pub heading: String,
    #[serde(default, rename = "bodyMarkdown")]
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NexusTutorial {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "videoUrl")]
    pub video_url: String,
    #[serde(default)]
    pub sections: Vec<NexusTutorialSection>,
    #[serde(default, rename = "appName")]
    pub app_name: String,
}

fn parse_tutorial(body: &serde_json::Value) -> NexusTutorial {
    let data = body.get("data").unwrap_or(body);
    let sections = data
        .get("sections")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .map(|s| NexusTutorialSection {
                    heading: s
                        .get("heading")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string(),
                    body: s
                        .get("bodyMarkdown")
                        .or_else(|| s.get("body"))
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default();
    NexusTutorial {
        title: data
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        description: data
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        video_url: data
            .get("videoUrl")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        sections,
        app_name: data
            .get("appName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
    }
}

/// Fetch the public tutorial (no key required per guide). 404 = none published.
pub fn fetch_nexus_tutorial() -> Result<NexusTutorial, String> {
    let path = app_path("/tutorial")?;
    // Public endpoint: try without key first, retry with key on 401/403.
    let (base_url, api_key, _) = crate::report::nexus_config()
        .ok_or_else(|| "nexus not configured (KWL_NEXUS_API_KEY/KWL_NEXUS_APP_ID)".to_string())?;
    let client = nexus_client()?;
    let url = format!("{base_url}{path}");
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .map_err(|e| format!("nexus request failed: {e}"))?;
    let status = resp.status();
    let body: serde_json::Value = if status.as_u16() == 401 || status.as_u16() == 403 {
        client
            .get(&url)
            .header("x-api-key", &api_key)
            .header("Accept", "application/json")
            .send()
            .map_err(|e| format!("nexus request failed: {e}"))?
            .json()
            .map_err(|e| format!("nexus bad json: {e}"))?
    } else if !status.is_success() {
        return Err(format!("nexus returned {status}"));
    } else {
        resp.json().map_err(|e| format!("nexus bad json: {e}"))?
    };
    Ok(parse_tutorial(&body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_features_trims_dedupes_and_caps() {
        let input: Vec<String> = vec![
            "  video-download ".to_string(),
            "".to_string(),
            "video-download".to_string(),
            "audio-download".to_string(),
        ];
        assert_eq!(
            normalize_features(&input),
            vec!["video-download".to_string(), "audio-download".to_string()]
        );
        let big: Vec<String> = (0..100).map(|i| format!("f{i}")).collect();
        assert_eq!(normalize_features(&big).len(), MAX_FEATURES);
    }

    #[test]
    fn features_equal_ignores_order() {
        let a = vec!["x".to_string(), "y".to_string()];
        let b = vec!["y".to_string(), "x".to_string()];
        assert!(features_equal(&a, &b));
        assert!(!features_equal(&a, &vec!["x".to_string()]));
    }

    #[test]
    fn parse_reply_tolerates_missing_fields() {
        let v: serde_json::Value =
            serde_json::from_str(r#"{"_id":"abc","status":"replied"}"#).unwrap();
        let r = parse_reply(&v);
        assert_eq!(r.id, "abc");
        assert_eq!(r.status, "replied");
        assert_eq!(r.title, "");
        assert_eq!(r.reply, "");
    }

    #[test]
    fn parse_tutorial_tolerates_missing_fields() {
        let v: serde_json::Value = serde_json::from_str(
            r#"{"data":{"title":"How to","sections":[{"heading":"Step 1"}]}}"#,
        )
        .unwrap();
        let t = parse_tutorial(&v);
        assert_eq!(t.title, "How to");
        assert_eq!(t.sections.len(), 1);
        assert_eq!(t.sections[0].heading, "Step 1");
        assert_eq!(t.sections[0].body, "");
        assert_eq!(t.video_url, "");
    }

    #[test]
    fn desktop_features_within_server_cap() {
        let f = desktop_features();
        assert!(!f.is_empty());
        assert!(f.len() <= MAX_FEATURES);
        assert_eq!(normalize_features(&f).len(), f.len());
    }
}
