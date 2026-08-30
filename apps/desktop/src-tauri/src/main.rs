#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command(rename = "validate_url")]
fn validate_url(request: kwl_video_downloader::UrlRequest) -> Result<bool, String> {
    kwl_video_downloader::validate_url_impl(request)
}

#[tauri::command(rename = "get_app_info")]
fn get_app_info() -> kwl_video_downloader::AppInfoResponse {
    kwl_video_downloader::get_app_info_impl()
}

#[tauri::command(rename = "analyze_url")]
fn analyze_url(request: kwl_video_downloader::UrlRequest) -> Result<String, String> {
    kwl_video_downloader::analyze_url_impl(request)
}

#[tauri::command(rename = "analyze_playlist")]
fn analyze_playlist(request: kwl_video_downloader::UrlRequest) -> Result<Vec<String>, String> {
    kwl_video_downloader::analyze_playlist_impl(request)
}

#[tauri::command(rename = "start_download")]
fn start_download(request: kwl_video_downloader::DownloadRequestInput) -> Result<kwl_video_downloader::DownloadJobResponse, String> {
    kwl_video_downloader::start_download_impl(request)
}

#[tauri::command(rename = "get_download_job")]
fn get_download_job(job_id: String) -> Result<kwl_video_downloader::DownloadJobResponse, String> {
    kwl_video_downloader::get_download_job_impl(job_id)
}

#[tauri::command(rename = "cancel_download")]
fn cancel_download(job_id: String) -> Result<kwl_video_downloader::DownloadJobResponse, String> {
    kwl_video_downloader::cancel_download_impl(job_id)
}

#[tauri::command(rename = "pause_download")]
fn pause_download(job_id: String) -> Result<kwl_video_downloader::DownloadJobResponse, String> {
    kwl_video_downloader::pause_download_impl(job_id)
}

#[tauri::command(rename = "resume_download")]
fn resume_download(job_id: String) -> Result<kwl_video_downloader::DownloadJobResponse, String> {
    kwl_video_downloader::resume_download_impl(job_id)
}

#[tauri::command(rename = "get_download_history")]
fn get_download_history() -> Vec<kwl_video_downloader::DownloadHistoryEntry> {
    kwl_video_downloader::get_download_history_impl()
}

#[tauri::command(rename = "delete_download_history")]
fn delete_download_history(
    request: kwl_video_downloader::DeleteHistoryRequest,
) -> Result<Vec<kwl_video_downloader::DownloadHistoryEntry>, String> {
    kwl_video_downloader::delete_download_history_impl(request)
}

#[tauri::command(rename = "clear_download_history")]
fn clear_download_history() -> Vec<kwl_video_downloader::DownloadHistoryEntry> {
    kwl_video_downloader::clear_download_history_impl()
}

#[tauri::command(rename = "delete_history_by_url")]
fn delete_history_by_url(url: String) -> Vec<kwl_video_downloader::DownloadHistoryEntry> {
    kwl_video_downloader::delete_history_by_url_impl(url)
}

#[tauri::command(rename = "cleanup_broken_files")]
fn cleanup_broken_files(output_directory: Option<String>) -> Result<Vec<String>, String> {
    kwl_video_downloader::cleanup_broken_files_impl(output_directory)
}

#[tauri::command(rename = "open_media_file")]
fn open_media_file(path: String) -> Result<(), String> {
    kwl_video_downloader::open_media_file_impl(path)
}

#[tauri::command(rename = "reveal_media_in_explorer")]
fn reveal_media_in_explorer(path: String) -> Result<(), String> {
    kwl_video_downloader::reveal_media_in_explorer_impl(path)
}

#[tauri::command(rename = "get_tools_status")]
fn get_tools_status() -> kwl_video_downloader::tools::AllToolsStatus {
    kwl_video_downloader::tools::all_tools_status()
}

#[tauri::command(rename = "startup_tool_check")]
fn startup_tool_check() -> kwl_video_downloader::tools::AllToolsStatus {
    kwl_video_downloader::tools::startup_health_check()
}

#[tauri::command(rename = "get_tool_status")]
fn get_tool_status(tool: String) -> kwl_video_downloader::tools::ToolStatusResponse {
    kwl_video_downloader::tools::get_tool_status(&tool)
}

#[tauri::command(rename = "send_report")]
fn send_report(report: kwl_video_downloader::report::ReportInput) -> Result<(), String> {
    kwl_video_downloader::report::send_report(report)
}

#[tauri::command(rename = "get_versions")]
fn get_versions(app_id: Option<String>) -> Vec<kwl_video_downloader::versions::VersionRecord> {
    kwl_video_downloader::versions::get_versions_impl(app_id)
}

#[tauri::command(rename = "add_version")]
fn add_version(request: kwl_video_downloader::versions::AddVersionInput) -> Result<Vec<kwl_video_downloader::versions::VersionRecord>, String> {
    kwl_video_downloader::versions::add_version_impl(request)
}

#[tauri::command(rename = "update_version")]
fn update_version(request: kwl_video_downloader::versions::UpdateVersionInput) -> Result<Vec<kwl_video_downloader::versions::VersionRecord>, String> {
    kwl_video_downloader::versions::update_version_impl(request)
}

#[tauri::command(rename = "delete_version")]
fn delete_version(id: String) -> Result<Vec<kwl_video_downloader::versions::VersionRecord>, String> {
    kwl_video_downloader::versions::delete_version_impl(id)
}

#[tauri::command(rename = "sync_github_release")]
fn sync_github_release(payload: kwl_video_downloader::versions::GithubReleasePayload) -> Result<Vec<kwl_video_downloader::versions::VersionRecord>, String> {
    kwl_video_downloader::versions::sync_github_release_impl(payload)
}

#[tauri::command(rename = "get_autostart_enabled")]
fn get_autostart_enabled() -> bool {
    kwl_video_downloader::autostart::is_autostart_enabled_impl()
}

#[tauri::command(rename = "set_autostart_enabled")]
fn set_autostart_enabled(enabled: bool) -> Result<bool, String> {
    kwl_video_downloader::autostart::set_autostart_enabled_impl(enabled)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            kwl_video_downloader::app_setup(app.handle());
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Graceful shutdown: cleanup orphaned partial files
                let _ = kwl_video_downloader::cleanup_broken_files_impl(None);
            }
        })
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
