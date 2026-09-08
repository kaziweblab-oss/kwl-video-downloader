//! KWL-NEXUS Version Management (v1.0.0 → later)
//! Spec: MAJOR.MINOR.PATCH semantic versioning, versionType enum {major, minor, patch, build},
//! releaseNotes, isLatest, isActive per app. GitHub release tag `v1.0.0` → `1.0.0` + body → notes.

use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VersionType {
    Major,
    Minor,
    Patch,
    Build,
}

impl VersionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Major => "major",
            Self::Minor => "minor",
            Self::Patch => "patch",
            Self::Build => "build",
        }
    }
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "major" => Some(Self::Major),
            "minor" => Some(Self::Minor),
            "patch" => Some(Self::Patch),
            "build" => Some(Self::Build),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionRecord {
    pub id: String,
    pub app_id: String,
    #[serde(rename = "version")]
    pub version: String,
    #[serde(rename = "versionType")]
    pub version_type: VersionType,
    #[serde(rename = "releaseNotes", default)]
    pub release_notes: String,
    #[serde(rename = "isLatest")]
    pub is_latest: bool,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub github_tag: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddVersionInput {
    pub app_id: String,
    pub version: String,
    #[serde(rename = "versionType")]
    pub version_type: String,
    #[serde(rename = "releaseNotes", default)]
    pub release_notes: Option<String>,
    #[serde(rename = "isActive", default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub download_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVersionInput {
    pub id: String,
    #[serde(rename = "versionType")]
    pub version_type: Option<String>,
    #[serde(rename = "releaseNotes")]
    pub release_notes: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: Option<bool>,
    #[serde(rename = "isLatest")]
    pub is_latest: Option<bool>,
    pub download_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GithubReleasePayload {
    pub tag_name: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub app_id: Option<String>,
}

// storage
static VERSIONS_DIR: OnceLock<Option<PathBuf>> = OnceLock::new();

pub fn set_versions_dir(base: Option<PathBuf>) {
    let _ = VERSIONS_DIR.set(base);
}

fn versions_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("KWL_VERSIONS_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    if let Some(base) = VERSIONS_DIR.get().and_then(|b| b.clone()) {
        return base;
    }
    if let Some(base) = std::env::var_os("APPDATA").or_else(|| std::env::var_os("LOCALAPPDATA")) {
        return PathBuf::from(base).join("KWL Video Downloader");
    }
    std::env::temp_dir().join("kwl-video-downloader")
}

fn versions_file_path() -> PathBuf {
    versions_dir().join("versions.json")
}

fn read_versions() -> Vec<VersionRecord> {
    std::fs::read_to_string(versions_file_path())
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn write_versions(versions: &[VersionRecord]) {
    let path = versions_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(versions) {
        let _ = std::fs::write(&path, content);
    }
}

// helpers
pub fn is_valid_semver(v: &str) -> bool {
    let parts: Vec<&str> = v.trim().split('.').collect();
    if parts.len() != 3 {
        return false;
    }
    parts.iter().all(|p| p.parse::<u64>().is_ok())
}

pub fn parse_github_tag(tag: &str) -> Option<String> {
    let t = tag.trim().trim_start_matches(|c| c == 'v' || c == 'V');
    if is_valid_semver(t) {
        Some(t.to_string())
    } else {
        None
    }
}

pub fn parse_semver_parts(v: &str) -> Option<(u64, u64, u64)> {
    let parts: Vec<&str> = v.trim().split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let major = parts[0].parse::<u64>().ok()?;
    let minor = parts[1].parse::<u64>().ok()?;
    let patch = parts[2].parse::<u64>().ok()?;
    Some((major, minor, patch))
}

pub fn compare_semver(a: &str, b: &str) -> std::cmp::Ordering {
    let pa = parse_semver_parts(a);
    let pb = parse_semver_parts(b);
    match (pa, pb) {
        (Some((am, an, ap)), Some((bm, bn, bp))) => (am, an, ap).cmp(&(bm, bn, bp)),
        (Some(_), None) => std::cmp::Ordering::Greater,
        (None, Some(_)) => std::cmp::Ordering::Less,
        (None, None) => a.cmp(b),
    }
}

pub fn derive_version_type(prev: Option<&str>, next: &str) -> VersionType {
    if let Some(prev_v) = prev.and_then(parse_semver_parts) {
        if let Some((nm, nn, np)) = parse_semver_parts(next) {
            let (pm, pn, pp) = prev_v;
            if nm != pm {
                return VersionType::Major;
            }
            if nn != pn {
                return VersionType::Minor;
            }
            if np != pp {
                return VersionType::Patch;
            }
            return VersionType::Build;
        }
    }
    // first version or invalid: default patch unless build keyword
    VersionType::Patch
}

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

// impls
pub fn get_versions_impl(app_id: Option<String>) -> Vec<VersionRecord> {
    let mut all = read_versions();
    if let Some(filter) = app_id {
        let f = filter.trim().to_string();
        if !f.is_empty() {
            all.retain(|v| v.app_id == f);
        }
    }
    // sort newest semver first, then created_at desc
    all.sort_by(|a, b| compare_semver(&b.version, &a.version).then_with(|| b.created_at.cmp(&a.created_at)));
    all
}

pub fn add_version_impl(input: AddVersionInput) -> Result<Vec<VersionRecord>, String> {
    let version = input.version.trim().to_string();
    if version.is_empty() {
        return Err("Version is required".to_string());
    }
    if !is_valid_semver(&version) {
        return Err("Version must be semantic MAJOR.MINOR.PATCH (e.g. 1.0.0)".to_string());
    }
    let app_id = input.app_id.trim().to_string();
    if app_id.is_empty() {
        return Err("app_id is required".to_string());
    }
    let vt = VersionType::from_str(&input.version_type).ok_or_else(|| "Invalid versionType: must be major/minor/patch/build".to_string())?;
    let notes = input.release_notes.unwrap_or_default().trim().to_string();
    let is_active = input.is_active.unwrap_or(true);

    let mut versions = read_versions();
    if versions.iter().any(|v| v.app_id == app_id && v.version == version) {
        return Err(format!("Version {} already exists for app {}", version, app_id));
    }

    // if this is the newest semver for this app, mark isLatest true and demote others
    let candidate_latest = versions
        .iter()
        .filter(|v| v.app_id == app_id)
        .max_by(|a, b| compare_semver(&a.version, &b.version))
        .map(|max| compare_semver(&version, &max.version) == std::cmp::Ordering::Greater)
        .unwrap_or(true);

    if candidate_latest {
        for v in versions.iter_mut().filter(|v| v.app_id == app_id) {
            v.is_latest = false;
        }
    }

    let download_url = input.download_url.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let app_id_for_filter = input.app_id.trim().to_string();
    let id = format!("ver-{}-{}", chrono_like(), version.replace('.', "-"));
    let record = VersionRecord {
        id,
        app_id,
        version: version.clone(),
        version_type: vt,
        release_notes: notes,
        is_latest: candidate_latest,
        is_active,
        created_at: now_iso(),
        download_url,
        github_tag: None,
    };
    versions.push(record);
    versions.sort_by(|a, b| compare_semver(&b.version, &a.version).then_with(|| b.created_at.cmp(&a.created_at)));
    write_versions(&versions);
    Ok(versions.into_iter().filter(|v| v.app_id == app_id_for_filter).collect())
}

fn chrono_like() -> String {
    let d = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("{}", d)
}

pub fn update_version_impl(input: UpdateVersionInput) -> Result<Vec<VersionRecord>, String> {
    let mut versions = read_versions();
    let idx = versions.iter().position(|v| v.id == input.id).ok_or_else(|| "Version not found".to_string())?;
    if let Some(vt_str) = input.version_type {
        let vt = VersionType::from_str(&vt_str).ok_or_else(|| "Invalid versionType".to_string())?;
        versions[idx].version_type = vt;
    }
    if let Some(notes) = input.release_notes {
        versions[idx].release_notes = notes.trim().to_string();
    }
    if let Some(active) = input.is_active {
        versions[idx].is_active = active;
    }
    if let Some(dl) = input.download_url {
        let t = dl.trim().to_string();
        versions[idx].download_url = if t.is_empty() { None } else { Some(t) };
    }
    if let Some(latest) = input.is_latest {
        if latest {
            let app_id = versions[idx].app_id.clone();
            for v in versions.iter_mut().filter(|v| v.app_id == app_id) {
                v.is_latest = false;
            }
            versions[idx].is_latest = true;
        } else {
            versions[idx].is_latest = false;
        }
    }
    let app_id = versions[idx].app_id.clone();
    write_versions(&versions);
    let mut filtered: Vec<VersionRecord> = versions.into_iter().filter(|v| v.app_id == app_id).collect();
    filtered.sort_by(|a, b| compare_semver(&b.version, &a.version).then_with(|| b.created_at.cmp(&a.created_at)));
    Ok(filtered)
}

pub fn delete_version_impl(id: String) -> Result<Vec<VersionRecord>, String> {
    let mut versions = read_versions();
    let pos = versions.iter().position(|v| v.id == id).ok_or_else(|| "Version not found".to_string())?;
    let app_id = versions[pos].app_id.clone();
    let was_latest = versions[pos].is_latest;
    versions.remove(pos);
    if was_latest {
        // promote newest remaining to latest
        if let Some(max_idx) = versions
            .iter()
            .enumerate()
            .filter(|(_, v)| v.app_id == app_id)
            .max_by(|(_, a), (_, b)| compare_semver(&a.version, &b.version))
            .map(|(i, _)| i)
        {
            versions[max_idx].is_latest = true;
        }
    }
    write_versions(&versions);
    let mut filtered: Vec<VersionRecord> = versions.into_iter().filter(|v| v.app_id == app_id).collect();
    filtered.sort_by(|a, b| compare_semver(&b.version, &a.version).then_with(|| b.created_at.cmp(&a.created_at)));
    Ok(filtered)
}

pub fn sync_github_release_impl(payload: GithubReleasePayload) -> Result<Vec<VersionRecord>, String> {
    let version = parse_github_tag(&payload.tag_name).ok_or_else(|| format!("Invalid tag {}", payload.tag_name))?;
    let app_id = payload.app_id.unwrap_or_else(|| "kwl-video-downloader".to_string()).trim().to_string();
    let notes = payload.body.unwrap_or_default().trim().to_string();
    let existing = read_versions();
    if existing.iter().any(|v| v.app_id == app_id && v.version == version) {
        return Ok(existing.into_iter().filter(|v| v.app_id == app_id).collect());
    }
    let latest_for_app = existing
        .iter()
        .filter(|v| v.app_id == app_id)
        .max_by(|a, b| compare_semver(&a.version, &b.version))
        .map(|v| v.version.as_str());
    let vt = derive_version_type(latest_for_app, &version);

    let mut versions = existing;
    let candidate_latest = versions
        .iter()
        .filter(|v| v.app_id == app_id)
        .max_by(|a, b| compare_semver(&a.version, &b.version))
        .map(|max| compare_semver(&version, &max.version) == std::cmp::Ordering::Greater)
        .unwrap_or(true);
    if candidate_latest {
        for v in versions.iter_mut().filter(|v| v.app_id == app_id) {
            v.is_latest = false;
        }
    }
    let id = format!("ver-{}-{}", chrono_like(), version.replace('.', "-"));
    let record = VersionRecord {
        id,
        app_id: app_id.clone(),
        version: version.clone(),
        version_type: vt,
        release_notes: notes,
        is_latest: candidate_latest,
        is_active: true,
        created_at: now_iso(),
        download_url: payload.html_url.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        github_tag: Some(payload.tag_name.trim().to_string()),
    };
    versions.push(record);
    versions.sort_by(|a, b| compare_semver(&b.version, &a.version).then_with(|| b.created_at.cmp(&a.created_at)));
    write_versions(&versions);
    Ok(versions.into_iter().filter(|v| v.app_id == app_id).collect())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Mutex;

    use super::*;

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static ENV_LOCK: Mutex<()> = Mutex::new(());
        ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }
    fn isolated_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("kwl-versions-test").join(name);
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn valid_semver() {
        assert!(is_valid_semver("1.0.0"));
        assert!(is_valid_semver("0.10.3"));
        assert!(!is_valid_semver("1.0"));
        assert!(!is_valid_semver("v1.0.0"));
        assert!(!is_valid_semver("1.0.0-beta"));
    }

    #[test]
    fn parse_github_tag_strips_v() {
        assert_eq!(parse_github_tag("v1.0.0"), Some("1.0.0".to_string()));
        assert_eq!(parse_github_tag("V2.1.3"), Some("2.1.3".to_string()));
        assert_eq!(parse_github_tag("1.2.3"), Some("1.2.3".to_string()));
        assert_eq!(parse_github_tag("v1.0"), None);
        assert_eq!(parse_github_tag("release-1.0.0"), None);
    }

    #[test]
    fn compare_orders_semver_correctly() {
        assert_eq!(compare_semver("1.0.10", "1.0.2"), std::cmp::Ordering::Greater);
        assert_eq!(compare_semver("2.0.0", "1.9.9"), std::cmp::Ordering::Greater);
        assert_eq!(compare_semver("1.0.0", "1.0.0"), std::cmp::Ordering::Equal);
    }

    #[test]
    fn derive_type_detects_major_minor_patch_build() {
        assert_eq!(derive_version_type(Some("1.0.0"), "2.0.0"), VersionType::Major);
        assert_eq!(derive_version_type(Some("1.0.0"), "1.1.0"), VersionType::Minor);
        assert_eq!(derive_version_type(Some("1.0.0"), "1.0.1"), VersionType::Patch);
        assert_eq!(derive_version_type(Some("1.0.0"), "1.0.0"), VersionType::Build);
        assert_eq!(derive_version_type(None, "1.0.0"), VersionType::Patch);
    }

    #[test]
    fn add_and_latest_logic() {
        let _g = env_lock();
        let dir = isolated_dir("add_latest");
        std::env::set_var("KWL_VERSIONS_DIR", &dir);
        let _ = fs::remove_file(dir.join("versions.json"));
        let a = AddVersionInput { app_id: "app1".into(), version: "1.0.0".into(), version_type: "patch".into(), release_notes: Some("init".into()), is_active: Some(true), download_url: None };
        let r = add_version_impl(a).unwrap();
        assert_eq!(r.len(), 1);
        assert!(r[0].is_latest);
        let b = AddVersionInput { app_id: "app1".into(), version: "1.1.0".into(), version_type: "minor".into(), release_notes: None, is_active: None, download_url: None };
        let r2 = add_version_impl(b).unwrap();
        assert_eq!(r2.len(), 2);
        let latest = r2.iter().find(|v| v.is_latest).unwrap();
        assert_eq!(latest.version, "1.1.0");
        assert_eq!(r2.iter().filter(|v| v.is_latest).count(), 1);
    }

    #[test]
    fn duplicate_rejected() {
        let _g = env_lock();
        let dir = isolated_dir("dup");
        std::env::set_var("KWL_VERSIONS_DIR", &dir);
        let _ = fs::remove_file(dir.join("versions.json"));
        let a = AddVersionInput { app_id: "appX".into(), version: "1.0.0".into(), version_type: "major".into(), release_notes: None, is_active: None, download_url: None };
        add_version_impl(a).unwrap();
        let b = AddVersionInput { app_id: "appX".into(), version: "1.0.0".into(), version_type: "patch".into(), release_notes: None, is_active: None, download_url: None };
        assert!(add_version_impl(b).is_err());
    }

    #[test]
    fn github_sync_parses_tag_and_notes() {
        let _g = env_lock();
        let dir = isolated_dir("github");
        std::env::set_var("KWL_VERSIONS_DIR", &dir);
        let _ = fs::remove_file(dir.join("versions.json"));
        let p = GithubReleasePayload { tag_name: "v1.0.2".into(), body: Some("Fix pull refresh".into()), html_url: Some("https://github.com/kwl/releases/tag/v1.0.2".into()), app_id: Some("kwl-video-downloader".into()) };
        let r = sync_github_release_impl(p).unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].version, "1.0.2");
        assert_eq!(r[0].release_notes, "Fix pull refresh");
        assert_eq!(r[0].github_tag.as_deref(), Some("v1.0.2"));
        // idempotent
        let p2 = GithubReleasePayload { tag_name: "v1.0.2".into(), body: Some("again".into()), html_url: None, app_id: Some("kwl-video-downloader".into()) };
        let r2 = sync_github_release_impl(p2).unwrap();
        assert_eq!(r2.len(), 1);
    }

    #[test]
    fn is_active_toggle_and_delete_promotes_latest() {
        let _g = env_lock();
        let dir = isolated_dir("toggle_delete");
        std::env::set_var("KWL_VERSIONS_DIR", &dir);
        let _ = fs::remove_file(dir.join("versions.json"));
        add_version_impl(AddVersionInput { app_id: "app2".into(), version: "1.0.0".into(), version_type: "patch".into(), release_notes: None, is_active: Some(true), download_url: None }).unwrap();
        add_version_impl(AddVersionInput { app_id: "app2".into(), version: "1.0.1".into(), version_type: "patch".into(), release_notes: None, is_active: Some(true), download_url: None }).unwrap();
        let all = get_versions_impl(Some("app2".into()));
        assert_eq!(all[0].version, "1.0.1");
        assert!(all[0].is_latest);
        let id_latest = all[0].id.clone();
        // deactivate latest
        update_version_impl(UpdateVersionInput { id: id_latest.clone(), version_type: None, release_notes: None, is_active: Some(false), is_latest: None, download_url: None }).unwrap();
        let after = get_versions_impl(Some("app2".into()));
        assert!(!after.iter().find(|v| v.id == id_latest).unwrap().is_active);
        // delete latest -> previous becomes latest
        delete_version_impl(id_latest).unwrap();
        let remain = get_versions_impl(Some("app2".into()));
        assert_eq!(remain.len(), 1);
        assert!(remain[0].is_latest);
        assert_eq!(remain[0].version, "1.0.0");
    }
}
