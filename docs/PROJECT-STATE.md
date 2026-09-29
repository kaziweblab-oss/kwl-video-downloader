# Project State

CURRENT PHASE:
v1.0.7 updater URL fix + filename trim — tag pending (moved, includes trim)

CURRENT TASK:
Push tag v1.0.7 → CI → publish → installed v1.0.5/1.0.6 must offer one-click update with WORKING download.

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
- Updater latest.json root cause + fix (2026-09-28, unpushed→this commit):
  - App showed "Could not fetch a valid release JSON" because (a) no `latest.json` was ever attached to any release — Tauri does NOT generate it (`tauri-action` did that; we build raw), and (b) endpoint URLs used the wrong repo owner (`kwl/video-downloader` vs `kaziweblab-oss/...`). Fixed owners in 4 confs + both repo `latest.json` copies; deleted stale `temp.json`; new `scripts/generate-latest-json.py` composes the static JSON from collected artifacts (win exe / linux AppImage / mac `.app.tar.gz` + `.sig` pairs, fail-fast when empty); release job now checks out repo, generates, and uploads it. macOS upload also gained `*.tar.gz` (updater cannot use .dmg).
- v1.0.5 batch (unpushed→this commit):
  - Merge+validate repair: mp4 joins merge-flag list, `--ffmpeg-location` points at managed ffmpeg (PATH-less machines), output tracker captures `Destination:`/`Merging formats into` lines so validation targets the FINAL file, validate failures log path+reason. 1 new test/app.
  - Messages: `ui/errorMessages.ts` central map (raw technical text never renders; updater fallback-platform/invalid-JSON/signature mapped; engine wording softened); Queue/History render friendly errors; dev-jargon strings replaced (idle hint, About stack names, aria labels).
  - i18n: ~55 new EN/BN keys, all literals keyed (Settings/Queue/History/About/Updates/wizard/buttons); key-parity vitest (EN==BN==interface).
  - Boot: Rust setup no longer blocks window (flush in thread); branded KWL splash overlay until tools+history ready (4s cap).
- Honest analyze errors (2026-09-28, unpushed→this commit):
  - YouTube bot-check/429 looked identical to a private link (backend swallowed stderr into one generic message). Now `classify_analyze_failure()` maps bot-check/rate-limit → wait-and-retry message, login/private → private message, rest unchanged; frontend shows matching messages. 3 new tests per app. Verified live cause: direct yt-dlp run shows HTTP 429 + "Sign in to confirm you're not a bot" on this network.
- v1.0.3 tool auto-update (2026-09-28, unpushed→this commit):
  - `background_update_check()` was a stub (health-check only); now really checks yt-dlp GitHub releases (win/linux/mac assets) + BtbN FFmpeg-Builds `latest` (Windows win64-gpl bundle, newest by major.minor.patch so same 9.0.2 never re-downloads), downloads (400MB cap, timeouts), extracts via `zip` dep, activates via existing staged+health+backup+rollback, defers while downloads active, silent on any failure — app can neither crash nor hang from it; first-run missing tools also provisioned.
  - Verified real API shapes before coding (`/repos/...` prefix required; BtbN `latest` tag + autobuild asset names informed picker design). 5 new deterministic tests (82 cargo pass); 4 warnings in test profile are pre-existing.
- v1.0.3 release-fix round 2 (2026-09-28, unpushed→this commit):
  - Root-cause of CI bundle failures: `npx tauri build` from repo root resolves the **android** app (alphabetical), so Windows/macOS/Linux jobs compiled `kwl-video-downloader-android` and NSIS bundling failed `os error 2`. Fix: each job now `cd`s into its app dir (`apps/desktop|linux|macos|android`) before the tauri command; `release.yml` auto tag-trigger disabled (build.yml is canonical) to stop duplicate releases.
  - Signing: old private key unavailable → generated fresh keypair (no password); new pubkey in all 4 `tauri.conf.json`; private key kept OUT of repo (`Temp/opencode/kwl-signing.key`) — human must add it as `TAURI_SIGNING_PRIVATE_KEY` repo secret.
- v1.0.3 CI unblock (2026-09-27, commits `dde7b62`/`f36b552`/`ac35cc5`, tag `v1.0.3` → `ac35cc5`):
  - `package-lock.json` synced to all 10 workspaces (`dde7b62`); then regenerated with npm 10 (`ac35cc5`) because the npm-11 lock omitted `@esbuild/*@0.28.2` optional platform pkgs → CI `npm ci` failed `Missing: @esbuild/win32-x64@0.28.2` (reproduced locally with `npx npm@10 ci`, verified EXIT=0 after regen)
  - Platform lib-name fix (`f36b552`): `apps/{android,linux,macos}/src-tauri/Cargo.toml` gained `[lib] name = "kwl_video_downloader"` — `main.rs` uses that crate path but packages are named `kwl-video-downloader-*` (E0433, failed everywhere incl. CI runners)
  - Local toolchain installed (Rust stable 1.98.1 + VS Build Tools MSVC 14.44); managed tools placed (`yt-dlp 2026.08.19`, `ffmpeg/ffprobe 9.0.2` under `%APPDATA%/KWL Video Downloader/tools/*/current/`); `tauri dev` runs, YouTube analyze works with real tools
  - No app-logic change: 9 insertions, 0 deletions in platform manifests + lockfile only
- v1.0.1 → v1.0.2 patch:
  - Pull-to-refresh direction flipped `AppShell.tsx:141` from bottom to top (`atTop` + `prevTop>80`), removed bottom spinner; `Thumbnail.tsx:1` offline fallback (video icon + format) for history/queue
  - Updater: `desktop/package.json` added `updater/process`, `settingsStore autoUpdate`, `SettingsView` Check Now wired (available/download + Cancel, `Current version v1.0.2`), `App.tsx:418` manual-only toast with `Update/Cancel` modal (`isUpdating` overlay) + `valid json/json parse/html` treated as up-to-date, `Notification` API, no auto `relaunch`
  - CI `build.yml` now signs (`TAURI_SIGNING_PRIVATE_KEY`) + uploads `*.sig`/`*.json`; `AppShell`/`AboutView` version dynamic via `getAppInfo`
  - Versions `1.0.0→1.0.2` (`tauri.conf.json:4 versionCode 1→3`, `Cargo.toml:3`, `app.ts:4`, `latest.json`), local bundle `target/release/bundle/nsis/KWL Video Downloader_1.0.2_x64-setup.exe` 5.32 MB built `npx tauri build --bundles nsis`

IN PROGRESS:
- CI tag build v1.0.3: Validate + Windows + Linux + macOS (icon.icns fix) green with signatures; Android red at `Setup Android SDK` action (external, persistent) — release `needs` dropped android (APK follows); draft Release expected from tag run
- Docs: PROJECT-STATE/MEMORY/DECISION-LOG/CHANGELOG updated for v1.0.3 (this session)

NEXT:
- Human: Re-run Android job on GitHub if SDK step was transient; publish draft Release; install `1.0.3` NSIS over local dev and verify Sidebar `v1.0.3`, Analyze with real tools, updater `Already on latest`

KNOWN ISSUES:
- Local machine now has Rust 1.98.1 + MSVC 14.44 + managed yt-dlp/ffmpeg (installed this session); Java still missing locally so Android packaging stays CI-only
- Git remote configured (`kaziweblab-oss/kwl-video-downloader`), `main` pushed, tag `v1.0.3` → `ac35cc5` pushed
- Windows WebView GUI click-through remains human-required (unchanged)

BLOCKED:
- Android APK: `android-actions/setup-android@v3` step failed on CI runner (external) — Re-run needed; Rust side verified locally
- Release publish: waiting on all 4 platform jobs (Windows/macOS/Linux running)

LAST VALIDATION (local machine, 2026-09-27):
- PASS: `cargo check` desktop + android + linux + macos manifests — EXIT=0, no errors (linux/macos/android needed the `[lib]` fix + built `dist/`)
- PASS: `cargo test` desktop — 77 passed, 0 failed, 3 ignored
- PASS: `npm run check` (tsc) — clean; `npm test` (vitest) — 58/58
- PASS: `npm run build` desktop/android/linux/macos frontends — dist built (gitignored)
- PASS: `npx tauri dev` — window launches, real YouTube analyze works via managed yt-dlp/ffmpeg
- PASS (CI observed via API): `Build and Release` run #19 Validate job — npm ci + tests + typecheck success on `ac35cc5`
- IN PROGRESS (CI): Windows/macOS/Linux bundle jobs; Android job FAILED at `Setup Android SDK` action (external) — needs human Re-run
- NOT RUN: draft Release publish (blocked on all 4 platform jobs); Android APK anywhere; signed-updater end-to-end

TESTS: PASS (58 vitest; 77 cargo / 3 ignored)
TYPECHECK: PASS
BUILD: PASS (frontend vite x4 + Tauri dev compile 447 crates; CI bundles running)
REAL RUNTIME: PASS (dev app + managed tools, YouTube analyze ok)
INSTALLER: IN PROGRESS (CI Windows/macOS/Linux building; Android blocked on SDK action)
LICENSE: NOT RUN (free app)
KWL NEXUS: REMOVED
UPDATE: NOT RUN (needs published Release + signatures)
REPORT SYSTEM: PASS (unchanged)
ANDROID APK: BLOCKED (CI SDK-setup action failed; Rust side verified locally)
GIT RELEASE: IN PROGRESS (`v1.0.3` → `ac35cc5` pushed; runs triggered; no Release published yet)
LAST UPDATED: 2026-09-27

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
1.0.7