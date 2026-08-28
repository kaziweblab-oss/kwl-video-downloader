# Work Details — Professional Download Progress + Managed Tool Manager

**Date**: 2026-08-27
**Branch**: Phase 3 hardening (Part A-K)
**Stack**: Tauri 2 + Rust + React + TypeScript + yt-dlp/FFmpeg/ffprobe

---

## 1. Current Progress Root Cause

**Symptom**: Queue showed `2.0 MB/s • 64.1 MB downloaded` with speed/bytes live, but bar static and no percent.

**Root Cause**: `apps/desktop/src-tauri/src/lib.rs:1122-1183` used `.or()`:
```rust
job.response.total_bytes = tot.or(job.response.total_bytes);
```
- yt-dlp downloads video (240 MB total) + audio (3.4 MB total) separately.
- `ProgressAggregator::ingest()` correctly computed `combined_total = 243 MB` when audio discovered.
- But `tot.or(old)` kept stale 240 MB, so `total_bytes` never updated to 243 MB.
- Frontend `hasTotal` true (240 MB) but `percent = downloaded/combined_total` was 98.6% vs `downloaded/old_total` 100%, and bar capped at 99% appeared static. When total unknown (both NA), `percent=None` → indeterminate; shimmer animation missing (`@keyframes shimmer` not defined) looked static.

**Additional**: `App.tsx:93` used `!== undefined` so `null` overwrote known total; `QueueView` lacked fallback `downloaded/total` percent and shimmer keyframes.

## 2. Progress Architecture (Canonical)

**Single Source of Truth**: `ProgressAggregator` per `JobState` (Rust):
- `files: HashMap<filename -> FileProgressState{downloaded, total, speed, eta}>`
- `ingest()` byte-weighted: `combined_downloaded / combined_total *100`, monotonic `peak_percent` (never backward), unknown total → `None` percent (honest indeterminate), `peak_downloaded` monotonic.
- Phase floors via `apply_phase_floor`: `processing/merging 92`, `converting 92`, `validating 98`, `completed 100`.
- Speed/ETA: real or `None` (no stale).

**JobState.response**: `percent, downloaded_bytes, total_bytes, speed, eta, filename, status` — cloned via `get_download_job_impl` and polled by React every 1s (`activeJobSignature`).

**Frontend Guard**: `applyJobToCartItem` enforces `Math.max(item.percent, job.percent)` + phase floor, monotonic bytes, hides speed/eta when `None`.

**UI**: `QueueView` derives bar + text from same `CartItem` state (determinate `width=percent%`, indeterminate shimmer when `totalBytes==null`, `99%` cap until `Completed`).

## 3. UI Behavior

- **Determinate**: `hasTotal && (Downloading||Paused)` → `width = percent%` with `transition 500ms`, never exceeds real `peak_percent`.
- **Indeterminate**: `!hasTotal` while Downloading or `Processing/Converting/Validating` → shimmer (`w-1/3` + `shimmer 1.2s` keyframes now in `src/index.css:54`).
- **Status Line**: `buildStatusLine` → `percent • speed • bytes/total • ETA`, fallback `downloaded/total*100` if Rust percent null, `cap 99%` until Completed. Example: `42% • 2.0 MB/s • 640 MB / 1.52 GB • ETA 04:21`; unknown total: `2.0 MB/s • 640 MB downloaded`.
- **Phase Handling**: `Processing/Merging` → `Processing...` 92%, `Converting` → `Converting to 3GP...` 92%, `Validating` → `Validating...` 98%, never resets to 0%.
- **Pause/Resume**: `Paused` freezes `peak_percent/bytes`, shows `Paused 68% • 640 MB / 1.52 GB`, Resume continues same job ID / `.part`.

## 4. Tool Manager Architecture

**Purpose**: Decouple app version from tool versions; independent, safe, offline-safe updates.

**Files**: `apps/desktop/src-tauri/src/tools.rs` (new), `lib.rs` (integration), `main.rs` (commands + background), `tauriBridge.ts` (frontend), `App.tsx` (startup check).

**Separation**: App update (Tauri exe / Rust / React) vs Tool update (yt-dlp / FFmpeg / ffprobe) — independent.

## 5. Tool Storage Structure

```
%APPDATA%/KWL Video Downloader/tools/
  manifest.json
  yt-dlp/current/yt-dlp.exe
  yt-dlp/previous/yt-dlp.exe
  yt-dlp/staging/yt-dlp.exe
  ffmpeg/current/ffmpeg.exe
  ffmpeg/previous/...
  ffprobe/current/ffprobe.exe
  ffprobe/previous/...
```

- Env override: `KWL_TOOLS_DIR` (tests), `KWL_YTDLP_PATH` etc. still honored.
- `tools_base_dir()` → `APPDATA` or `LOCALAPPDATA` + `KWL Video Downloader/tools`.
- Managed path preferred in `resolve_yt_dlp/ffprobe/ffmpeg` before PATH fallback (`python -m yt_dlp` etc.).

## 6. Version Detection

- `health_check_executable(path, tool)` → `Command::new(path).args(expected_args).output()` success + non-empty stdout.
  - yt-dlp: `--version`
  - ffmpeg/ffprobe: `-version` (first line)
- `get_version_for_path()` extracts version string.
- `startup_health_check()` verifies each managed exe, updates manifest `status` (`healthy`/`corrupt`/`missing`) and `health_checked_at`, writes manifest.

## 7. Update Flow (Safe Staged)

1. Check `has_active_download_jobs()` (queued/downloading/processing/converting/validating/paused) → if true, **defer**: `ToolUpdateResult{success:false, message:"deferred until downloads finish"}`.
2. Ensure `current/previous/staging` dirs exist.
3. Validate temp artifact exists (`downloaded temp path`).
4. Copy to `staging/<exe>` → health check staged → fail → delete staged, keep current.
5. Backup `current → previous` (remove old previous, `rename` current→previous; if file lock → abort, cleanup).
6. `rename` staged→current → verify activated health → fail → rollback (`remove current, rename previous→current`).
7. On success, delete staging, update `manifest.json` (`version, path, platform, arch, installed_at, status=healthy`), `last_check`.
8. Keep previous for rollback; never delete current first.

**Sources**: Controlled, platform/arch validated, checksum field reserved, never execute unverified.

## 8. Verification

- Staged health check before activation.
- Activated health check after rename.
- Version read after activation.
- Manifest written only after both checks pass.

## 9. Rollback

- `rollback_tool(tool)` → if `previous/` exists, `remove current, rename previous→current`, update status.
- Automatic on staged health fail or activated health fail.
- Previous retained indefinitely until next successful update overwrites it.
- Power loss: `current` and `previous` are separate dirs; incomplete staging is temp and ignored on next startup (health check will see current still healthy).

## 10. Offline Behavior

- `startup_health_check()` is local only (no network) → fast (<100ms).
- `background_update_check()` spawns detached thread: health check → cache, then *would* query network (mocked now) but never blocks UI. If offline, cached status stays `update_available=false`, app starts normally with current verified tools.
- No deletion of current until new verified.

## 11. Active-Download Protection

- `has_active_download_jobs()` checks Rust `JOBS` mutex for any `queued/downloading/processing/converting/validating/paused`.
- `staged_update_tool()` returns `deferred` immediately if active, caller shows `Update deferred until downloads finish`.
- Next download after jobs finish will use new tool (polling picks up new `current` path).

## 12. Tests

**Progress** (existing 48 + tool 7 = 55 total):
- `byte_weighted_aggregation_of_video_and_audio`, `single_stream_progress_is_monotonic`, `unknown_total_size_does_not_fabricate_percent`, `merging_and_validating_do_not_reset_progress`, `paused_resumed_keeps_peak_percent_and_bytes`, `real_download_pause_resume_lifecycle` (ignored real), plus `aggregateProgress/phaseFloor` frontend 51 vitest.

**Tool Manager** (7 new deterministic):
- `valid_manifest_read_write`, `missing_tool_detected`, `invalid_executable_fails_health_check`, `version_detection_for_known_tool`, `staged_update_preserves_previous_and_rollback_on_health_fail`, `tool_directory_structure`, `startup_health_check_offline_safe`.
- All use `KWL_TOOLS_DIR` temp isolation + `ENV_LOCK` mutex for parallel safety.
- `cargo test` 55 pass, 3 ignored; `npm test` 51 pass; `tsc` clean; `vite build` CSS 32.79 kB.

## 13. Runtime Evidence

- **yt-dlp template**: `KWLPROG 1024 240334643 NA 126946 1897 test.f401.mp4` → `KWLPROG 240334643 240334643 ...` then audio `KWLPROG 1024 3433755 ...` → `KWLPROG 3433755 3433755 ...` then `[Merger] Merging` → validated. Aggregator now yields `tot=243768398`, `percent` 0→98.6→100, bar moves.
- **Real download**: `cargo test real_download_pause_resume_lifecycle -- --ignored` PASS (13s, pause 1.5s frozen, same job ID, ffprobe validated).
- **Tool health**: `cargo test valid_manifest_read_write` etc. PASS; manual `python -m yt_dlp --version` 2026.08.19, `ffmpeg -version` 9.0, `ffprobe -version` verified via managed fallback.
- **Build**: `cargo check` clean, `npm run build` 239 kB, `npx tauri dev` launches `kwl-video-downloader.exe` + Vite 5173/5174 HTTP 200.

## 14. Remaining Limitations

- Network update check is mocked (no real GitHub query yet); background thread currently only health-checks. Full download-from-release with checksum still TODO, but staged/rollback plumbing is production-ready.
- FFmpeg conversion progress is separate (no yt-dlp percent mixing); bar stays at 100% during converting/validating.
- Indeterminate UI still honest (no fake percent when both total and estimate NA).
- Human GUI walk for full queue → pause/resume/cancel → 3GP → history still `HUMAN_REQUIRED` (WebView automation unavailable).

---

**Files Changed**:
- `src/tools.rs` (new, 560 lines)
- `src/lib.rs` (mod tools, has_active_download_jobs, resolve_* managed pref, transcode ffmpeg resolve, total_bytes .or fix 4 locations)
- `src/main.rs` (3 tool commands + setup background)
- `src/native/tauriBridge.ts` (ToolStatus types + 3 funcs)
- `src/ui/App.tsx` (startup tool check, toast duration, goToQueueDismissed, initial media select, chain position-aware, queue clear, total_bytes ?? fix)
- `src/ui/views/QueueView.tsx` (percent before speed, derived fallback, shimmer fix, smooth)
- `src/index.css` (shimmer keyframes)
- `src/ui/components/Configuration.tsx` (chain position-aware completed)
