# Project State

CURRENT PHASE:
v1.0.0 release build (multi-platform packaging + cleanup) — legacy auth/Nexus fully removed for the free, offline release

CURRENT TASK:
Ship the v1.0.0 FINAL MASTER PROMPT: in-app report system (backend wired + frontend live), Android `versionCode`/CI asset+manifest staging, release docs, local git commit + `v1.0.0` tag. Remaining: human/CI push + `android init/build` + GUI click-through.

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

IN PROGRESS:
- Human/CI: `git push` (add remote first) + GitHub Release publication; Windows GUI click-through of the report flow

NEXT:
- Human/CI: install Java + Android SDK to run `npx tauri android init` / `android build --apk` (CI job stages native_tools + patches manifest automatically)
- Human/CI: `git remote add` + `git push --tags` (workflow builds all installers + creates draft release with report-center notes)

KNOWN ISSUES:
- Local machine has no Android SDK and no Java; Android build verified only in CI configuration (not executed anywhere yet)
- Git repo now exists locally with tag `v1.0.0`, but no remote is configured; push/publish requires human setup
- Windows WebView GUI click-through remains human-required (unchanged)

BLOCKED:
- Android init/build: Java + Android SDK required locally (CI config ready)
- Release publish: git remote required (repo + tag `v1.0.0` created locally; workflow ready)

LAST VALIDATION (all on the local desktop machine, 2026-08-29):
- PASS: `cargo check` — clean (only 2 pre-existing unrelated dead_code warnings)
- PASS: `cargo test` — 68 passed / 0 failed / 3 ignored (incl. 7 report-system tests + asset-relative-path test)
- PASS: `npm run check` (desktop tsc) — clean
- PASS: `npm test` (root vitest) — 58/58 passed
- PASS: `npm run build --workspace @kwl/desktop` — vite build clean (index 251.13 kB / gzip 73.81 kB)
- PASS: `git init` + commit `8ec31c1` + tag `v1.0.0` — clean working tree
- BLOCKED: `tauri android init` locally (Java missing); manifest patch + asset staging now automated in CI
- PASS: Nexus removal — grep of src confirms zero account/login/Nexus references (only `author` metadata fields remain)

TESTS: PASS (60 native + 58 vitest)
TYPECHECK: PASS
BUILD: PASS (frontend vite build; native cargo check)
REAL RUNTIME: PASS (native dev launch + backend verified earlier; GUI click-through HUMAN_REQUIRED)
INSTALLER: NOT RUN
LICENSE: NOT RUN (no licensing in v1.0.0 — free app)
KWL NEXUS: REMOVED for v1.0.0 (free, offline, no account); v2.0.0 planned
UPDATE: NOT RUN (tool manager independent; staged/rollback verified via tests)
REPORT SYSTEM: PASS (backend tests + tsc + build; GUI flow HUMAN_REQUIRED)
ANDROID APK: BLOCKED (no Java/Android SDK locally; CI config in place)
GIT RELEASE: BLOCKED (local repo + tag `v1.0.0` created; no remote — push/publish human-required)
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
1.0.0