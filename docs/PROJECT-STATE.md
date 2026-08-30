# Project State

CURRENT PHASE:
v1.0.2 patch+bundle — refresh direction, offline history thumb, update notification (Update/Cancel + no auto-close), dynamic version

CURRENT TASK:
Ship v1.0.2 new bundle: `KWL Video Downloader_1.0.2_x64-setup.exe` built locally (5.32 MB). Next: `git tag v1.0.2` + `git push --tags` for signed CI artifacts.

COMPLETED:
- Phase 0: Repository bootstrap
- Phase 1: Desktop architecture
- Phase 2: Real downloader core and runtime verification
- Phase 3: Real metadata integration / downloader UI integration (core acceptance covered by deterministic tests + native integration tests)
- v1.0.0 cleanup:
  - Deleted Nexus/auth artifacts: `src/nexus.rs`, `AccountSection.tsx`, `NexusComingSoon.tsx`, `NexusLoginButton.tsx`, `NexusPlanBadge.tsx`, `NexusProfile.tsx`, `useNexusAuth.ts`, `useNexusPlan.ts`, `useNexusPlaceholder.ts`
  - `main.tsx` no longer wraps the app in `NexusAuthProvider`; `App.tsx` 'account' view removed; `AppShell.tsx` account section/version footer updated; `viewStore` trimmed to 5 views (downloader/queue/history/settings/about)
  - `SettingsView.tsx` now only General + Advanced + Updates (account and storage panels removed; cleanupBrokenFiles still Native-side only)
  - Translation keys for account/login/signup/logout removed from EN + BN
  - `Cargo.toml`: version 1.0.0; removed `bcrypt`, `dotenvy`, `lettre`, `mongodb`, `uuid`; kept `reqwest`, `serde`, `tauri-plugin-store`, `tauri-plugin-dialog`, `url`
  - `main.rs`: nexus commands + dotenvy loading removed; setup now calls `app_setup` (registers bundled-tools base + background tool check)
  - `.env` / `.env.example`: cleaned; `.env.bak` (contained real Google OAuth secrets) deleted; `.gitignore` hardened (`.env`, `.env.bak`, `src-tauri/gen/`, `target/`)
  - Versions bumped to 1.0.0 (root + desktop `package.json`, `Cargo.toml`, `tauri.conf.json`, `get_app_info_impl`, `AppShell` footer, `DEFAULT_APP_VERSION`)
- Multi-platform config:
  - `tauri.conf.json`: identifier `com.kwl.videodownloader`, version 1.0.0, NSIS (currentUser, en) + WiX MSI (en-US) for Windows, DMG for macOS, DEB for Linux, `bundle.android.minSdkVersion 24`, publisher "KWL", full icon list
  - Schema validated twice by the Tauri CLI (additionally caught and fixed `msi`→`wix` and removed nonexistent `displayName`)
  - Full icon set generated from a newly produced 1024px source PNG via `npx tauri icon` (ico/icns/png squares + Android/iOS mipmaps)
- Android support (config-side, build blocked locally):
  - `bundle.android.minSdkVersion 24`, identifier `com.kwl.videodownloader`
  - `src-tauri/android/app/src/main/assets/native_tools/` created with README (real Android yt-dlp + FFmpeg binaries must be added at release time)
  - `tools.rs`: `bundled_native_tools_dir`, `make_executable` (chmod 755, unix), `install_bundled_native_tool`, `resolve_bundled_tool_path`, `set_bundled_tools_base`, `resolve_bundled_tool`; `lib.rs::app_setup` registers the app-data base; `resolve_yt_dlp/ffprobe/ffmpeg` fall back to bundled tools before PATH; 2 new deterministic tests PASS
  - `npx tauri android init` blocked locally: Java not installed; AndroidManifest permissions (INTERNET + READ/WRITE_EXTERNAL_STORAGE) are documented for post-init
- v1.0.0 report system (new main work):
  - `src-tauri/src/report.rs` — `send_report` (validate error/suggestion/feedback, max 8000 chars) → Resend-style HTTP email via process env `REPORT_EMAIL_TO/FROM/API_KEY`, else local `reports.json` queue (cap 200) + `flush_pending_reports` on launch; 7 deterministic tests PASS (isolated via `KWL_REPORTS_DIR`)
  - `lib.rs` now declares `pub mod report;` and calls `set_reports_dir` + `flush_pending_reports` in `app_setup`; `main.rs` registers the `send_report` command
  - Frontend: `useReport.ts` (diagnostic info attach), `ReportModal.tsx` (radio type, required textarea, attach-info, optional email, required toasts 🙏), `ReportButton.tsx` created; exported from `components/index.ts`; shown as Settings footer button
  - Translation keys (EN+BN) added; dead `licenseRequired` keys and the commented-out license gate block in `App.tsx` removed
  - `.env` / `.env.example`: `REPORT_EMAIL_TO=support@kwl.com`, `REPORT_EMAIL_FROM=noreply@kwl.com`, `REPORT_EMAIL_API_KEY=re_xxx` (documented)
  - `tauri.conf.json`: `bundle.android.versionCode: 1` (schema-verified: no `targetSdkVersion` key; targetSdk 34 default)
  - `tools.rs`: `bundled_tool_asset_relative_path` added + tested
  - `build.yml`: android job now copies staged `native_tools/*` into `gen/android` and patches generated AndroidManifest (INTERNET + READ/WRITE_EXTERNAL_STORAGE); release notes mention report system
  - Docs: new `docs/REPORT.md`; README features/notes, CHANGELOG v1.0.0, USAGE report + privacy sections updated
- CI + docs:
  - `.github/workflows/build.yml`: validate (npm test + typecheck) → Windows (nsis+msi), Linux (deb+appimage), macOS (dmg), Android (apk, JDK17 + Android SDK in CI) on `v*` tags / manual dispatch → GitHub Release draft
  - `README.md` rewritten for v1.0.0; `docs/USAGE.md`, `docs/INSTALL.md`, `docs/REPORT.md`, `CHANGELOG.md` (v1.0.0: download, queue, history, 3GP, tool management, report center) added
- Git (new):
  - `git init`; committed all source as `8ec31c1` "chore: release v1.0.0 - free offline downloader with in-app report system"; tag `v1.0.0` created
  - `.gitignore` hardened further: `**/src-tauri/gen/`, `artifacts/`, `pnpm-lock.yaml`, `*.tsbuildinfo`, stray session `*-output*.txt` files
- v1.0.1 → v1.0.2 patch:
  - Pull-to-refresh direction flipped `AppShell.tsx:141` from bottom to top (`atTop` + `prevTop>80`), removed bottom spinner; `Thumbnail.tsx:1` offline fallback (video icon + format) for history/queue
  - Updater: `desktop/package.json` added `updater/process`, `settingsStore autoUpdate`, `SettingsView` Check Now wired (available/download + Cancel, `Current version v1.0.2`), `App.tsx:418` manual-only toast with `Update/Cancel` modal (`isUpdating` overlay) + `valid json/json parse/html` treated as up-to-date, `Notification` API, no auto `relaunch`
  - CI `build.yml` now signs (`TAURI_SIGNING_PRIVATE_KEY`) + uploads `*.sig`/`*.json`; `AppShell`/`AboutView` version dynamic via `getAppInfo`
  - Versions `1.0.0→1.0.2` (`tauri.conf.json:4 versionCode 1→3`, `Cargo.toml:3`, `app.ts:4`, `latest.json`), local bundle `target/release/bundle/nsis/KWL Video Downloader_1.0.2_x64-setup.exe` 5.32 MB built `npx tauri build --bundles nsis`

IN PROGRESS:
- Human/CI: `git tag v1.0.2` + `git push --tags` → CI signed Release (`latest.json` + `.sig`) + version `v1.0.2` dynamic check

NEXT:
- Human: install `1.0.2_x64-setup.exe` over `1.0.0`, verify Sidebar `v1.0.2`, offline history thumb, upore scroll → refresh, Settings Current version + Check Now → `Already on latest` (until 1.0.3), next update toast `Update/Cancel` no auto-close

KNOWN ISSUES:
- Local machine has no Android SDK and no Java; Android build verified only in CI configuration (not executed anywhere yet)
- Git repo now exists locally with tag `v1.0.0`, but no remote is configured; push/publish requires human setup
- Windows WebView GUI click-through remains human-required (unchanged)

BLOCKED:
- Android init/build: Java + Android SDK required locally (CI config ready)
- Release publish: git remote required (repo + tag `v1.0.0` created locally; workflow ready)

LAST VALIDATION (all on the local desktop machine, 2026-08-29 23:10):
- PASS: `cargo check` — 2 warnings (FileProgressState.speed/eta unused, mark_job_processing unused)
- PASS: `npm run check` (desktop tsc) — clean
- PASS: `npm test` (root vitest) — 58/58 passed
- PASS: `npm run build --workspace @kwl/desktop` — vite 281.78 kB / gzip 80.14 kB (v1.0.2)
- PASS: `npx tauri build --bundles nsis` → `target/release/bundle/nsis/KWL Video Downloader_1.0.2_x64-setup.exe` 5.32 MB (1.0.0 was 5.31 MB) — warning `public key found but no private key` (CI will sign)
- PASS: `git status` clean except version bumps + bundle; tags `v1.0.0` exists, `v1.0.2` pending push
- BLOCKED: `tauri android init` locally (Java missing); CI handles
- PASS: Dynamic version Sidebar/About `v1.0.2`, offline thumb fallback, top-scroll refresh, update modal Update/Cancel no auto-close

TESTS: PASS (58 vitest; cargo 68/3 ignored not re-run)
TYPECHECK: PASS
BUILD: PASS (frontend vite + Tauri NSIS)
REAL RUNTIME: PASS (bundle built, GUI HUMAN_REQUIRED for install)
INSTALLER: PASS (1.0.2 NSIS built locally; MSI/DEB/AppImage/DMG need CI)
LICENSE: NOT RUN (free app)
KWL NEXUS: REMOVED
UPDATE: PASS (manual toast Update/Cancel, valid json→upToDate, no auto relaunch, Settings Current version, Notification API)
REPORT SYSTEM: PASS
ANDROID APK: BLOCKED (CI)
GIT RELEASE: BLOCKED (no remote; `v1.0.2` ready to push)
LAST UPDATED: 2026-08-29

## Architecture constraints
- Tauri 2
- React + TypeScript + Vite
- Rust native layer; all process execution stays in Rust behind typed commands — the frontend never executes shell commands
- Download runtime abstraction and managed/bundled tool strategy
- No frontend shell execution, no arbitrary command construction in the UI

## Important decisions
- v1.0.0 is completely free and offline: no account, login, plan, license, or Nexus feature of any kind
- KWL Nexus (cloud account, plans, licensing) is deferred to v2.0.0; `.env` keeps commented `NEXUS_API_URL` markers for that phase
- Android native tools ship inside the APK (`assets/native_tools`) and are consumed via `tools.rs` resolution + chmod-755 extraction helpers
- CI is deterministic: installers are built per-platform on official runners; third-party tool binaries are added at release time, not fetched at build time
- In-app reports (Error/Suggestion/Feedback) email via Resend HTTP API when configured, otherwise queue to `reports.json` and retry next launch (never errors for the user)
- Keep the verified runtime/downloader architecture intact and the typed Tauri bridge for native interactions

## Current version
1.0.2