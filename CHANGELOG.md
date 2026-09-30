# Changelog

All notable changes to KWL Video Downloader are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] - Android install repair + icon unify

### Fixed

- Android `App not installed / package appears to be corrupt`: the android
  app config now carries `bundle.android` (`minSdkVersion 24`,
  `versionCode 9`) so versionCode no longer resets to 1 on every build
- Android signing is stable across releases when `KWL_ANDROID_KEYSTORE_*`
  secrets are set (throwaway debug key remains the fallback); CI now fails
  loud on unsigned output via `apksigner verify` + `aapt dump badging`, and
  only the signed `kwl-video-downloader-*.apk` is uploaded
- Linux shipped a different logo (`icon.png`/`icon.ico` did not match the
  other three apps and the 32px/128px/icns files were missing): replaced
  with the shared KWL set, icon array unified to the same 5-file list on
  all four apps

## [1.0.7] - 2026-09-29

### Fixed

- Updater download URLs use published asset names (spaces become dots on
  upload — unquoted URLs 404d before this fix)

## [1.0.6] - 2026-09-29

### Fixed

- Updater feed covers all desktop platforms (separator-agnostic bundle
  matching, MSI fallback, macOS bundle listing for diagnostics)

## [1.0.5] - 2026-09-29

### Fixed

- Video/audio merge repair: MP4 merged via managed FFmpeg, final file
  validated, leftover parts eliminated
- No raw technical text in UI; full English/Bangla coverage (~55 keys)
- Branded KWL boot splash; startup never blocks the window

## [1.0.4] - 2026-09-28

### Fixed

- In-app updater end-to-end: correct release endpoint owner, CI-generated
  `latest.json` with signatures, macOS `.app.tar.gz` updater bundles
- Background runtime-tool auto-updates (yt-dlp everywhere, FFmpeg on Windows)
  with staged safe activation, offline-safe and crash-free
- Honest analysis errors: YouTube bot-check/rate-limit no longer reported as
  a private link

## [1.0.3] - 2026-09-27

### Fixed

- CI release unblocked: `package-lock.json` synced to all 10 workspaces and
  regenerated with npm 10 (CI's version) so `npm ci` passes; platform
  `src-tauri` lib targets named `kwl_video_downloader` so Android/Linux/macOS
  builds resolve the shared crate path (E0433 fixed, no logic change)
- Local run without installing: documented toolchain (Rust 1.98.1 + MSVC 14.44)
  and managed runtime tools (yt-dlp 2026.08.19, FFmpeg/ffprobe 9.0.2); YouTube
  analysis no longer reports the generic private-link error when tools exist

## [1.0.0] - 2026-08-28

First production release of KWL Video Downloader.

### Added

- Download video and audio from supported media links
- Real-time progress reporting (byte-weighted, monotonic) with speed and ETA
- Concurrent download queue with configurable concurrency (1-5)
- Pause, resume, and cancel for queued/running downloads
- Automatic download history with missing-file reconciliation
- 3GP output with FFmpeg transcoding (MPEG-4 / AAC / 16 kHz mono)
- Built-in runtime tool management (yt-dlp, FFmpeg, ffprobe) with health checks
  and safe staged updates
- English and Bangla user interface
- Multi-platform installers: Windows (NSIS + MSI), Android (APK), macOS (DMG),
  Linux (DEB + AppImage)
- GitHub Actions CI/CD publishing release artifacts
- Bundled native tool support for Android (assets/native_tools)
- In-app report center (Error / Suggestion / Feedback) with optional diagnostic
  info, emailed to the team when configured or queued locally otherwise
- Local report fallback queue (`reports.json`) with automatic retry on launch

### Removed

- All account, login, sign-up, plan, license, and KWL Nexus functionality
  (auth.rs, db.rs, email.rs, OAuth client setup)
- Related dependencies (bcrypt, dotenvy, mongodb, lettre, uuid)

### Notes

- Completely free and offline; no account, login, license, or payment required
- KWL Nexus (cloud account, plans, licensing) is planned for a future release

## [0.1.0] - 2026-08-25

Initial development bootstrap of the Tauri 2 monorepo foundation (pre-release).