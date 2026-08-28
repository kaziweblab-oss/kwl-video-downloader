# Changelog

All notable changes to KWL Video Downloader are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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