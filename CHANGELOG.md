# Changelog

All notable changes to KWL Video Downloader are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.10] - 2026-10-01

### Changed

- Android minimum version 24 → 26 (Android 8.0+): Tauri/plugin bytecode
  references `BootstrapMethodError` (API 26+ only) — white-screen crash on
  Android 7.x is unfixable by desugaring, proven by on-device logcat

### Fixed

- Launcher icons unified: all densities regenerated from the dark-navy
  brand tile (mixed old transparent + blue sets replaced) + adaptive
  background `#0a1130`; CI proves packaged icons in logs
- APK filename now `KWL Video Downloader-{version}.apk` (published with
  dots per GitHub asset rules)
- WebView-proof JS: `build.target es2019` in all apps — no `?.`/`??` in
  output, renders even on frozen old system WebViews
- KWL Nexus connection: Settings panel (server URL + API key + App ID),
  silent startup ping + features sync, tutorial/feedback commands. Secrets
  stay in app settings — nothing baked into the binary.
- Android TitleBar: min/max/close hidden on Android (OS owns the window);
  desktop exe unchanged
- Analyze errors: single inline card with Try Again (duplicate toast
  removed); Android without runtime tools gets an honest
  use-the-desktop-app message (EN+BN)
- Settings General: duplicate section titles removed, output folder shows
  full path (tooltip + wrapping subline), switcher focus rings
- Updater `Downloading update...` overlay now shows live progress in all
  four apps: big percent + determinate bar + `downloaded / total` sizes
  from the updater `Started`/`Progress` events (EN+BN inline); unknown
  total falls back to the existing shimmer bar + downloaded MB

## [1.0.9] - 2026-09-30

### Fixed

- Android 7.x white-screen crash: `java.lang.NoClassDefFoundError:
  BootstrapMethodError` in `TauriActivity.onCreate` (proven by on-device
  logcat) — core library desugaring enabled in CI (`desugar_jdk_libs`),
  minSdk 24 kept
- Launcher icon background `#fff` → brand dark navy `#0a1130` (white
  corners showed under shaped masks); CI now dumps generated res icons +
  packaged mipmap/native-lib entries as proof

## [1.0.8] - 2026-09-30

### Fixed

- Android `App not installed / package appears to be corrupt`: the android
  app config now carries `bundle.android` (`minSdkVersion 24`,
  `versionCode 9`) so versionCode no longer resets to 1 on every build
- Android signing is stable across releases when `KWL_ANDROID_KEYSTORE_*`
  secrets are set (throwaway debug key remains the fallback); CI now fails
  loud on unsigned output via `apksigner verify` + `aapt dump badging`, and
  only the signed `KWL-Video-Downloader-*.apk` is uploaded
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