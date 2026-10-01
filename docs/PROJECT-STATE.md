# Project State

CURRENT PHASE:
v1.0.10 batch — ready to tag

CURRENT TASK:
Commit + `git tag v1.0.10` + push → CI green → publish Release → API-26 emulator: install, OPEN (render check), icon verify → phone launcher screenshot.

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
- Android installable APK + proper logo (unpushed→this commit):
  - Root causes: (a) no signing at all — release APKs unsigned → Android refuses install; (b) android app never got the full `tauri icon` set (flat files, no mipmaps/icns) → Tauri default logo shown.
  - Fix: full icon set generated for android app + 5-file conf array; CI generates a debug keystore (keytool) + `keystore.properties` and patches release `signingConfigs` into generated `build.gradle.kts` (fail-loud); rust-cache workspace corrected to apps/android. Debug-signed APK installs on devices; Play publishing needs an upload key later.
  - Verification: BLOCKED locally (no Java/SDK) — icon files + conf schema verified here; APK assembly + device install proven only on next tag CI + real device.
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
- v1.0.8 working tree (uncommitted): version 1.0.8 + versionCode 9 in all 4 apps; android conf gained `bundle.android` + updater `android.installMode`; linux icons replaced with shared KWL set + 5-file icon array unified; CI uses persistent `KWL_ANDROID_KEYSTORE_*` secrets with debug fallback + `apksigner`/`aapt` verify + signed-only APK upload (this session)
- Human: create `KWL_ANDROID_KEYSTORE_*` repo secrets (one-time) so APK signature stays stable across releases; commit + tag v1.0.8; device test must uninstall the old differently-signed APK first

NEXT:
- CI tag build v1.0.8 → draft Release → install signed APK + desktop installers → verify KWL logo (Windows shortcut/taskbar/installer, Linux .desktop/AppImage, macOS DMG, Android launcher)

NEXT:
- Human: add `KWL_ANDROID_KEYSTORE_BASE64` (+ passwords/alias) repo secrets once; commit working tree; `git tag v1.0.8` + push; publish draft Release; uninstall old APK on device, install signed `KWL-Video-Downloader-1.0.8.apk`, verify launcher logo + desktop installer logos

KNOWN ISSUES:
- Java still missing locally so Android packaging stays CI-only
- `KWL_ANDROID_KEYSTORE_*` secrets not set yet → until then each CI build signs with a throwaway debug key (fresh installs work, cross-release updates report corrupt)
- Windows WebView GUI click-through remains human-required (unchanged)

BLOCKED:
- None in repo. Human: keystore secrets, tag push, device install test.

LAST VALIDATION (local machine, 2026-09-30):
- PASS: `cargo test` desktop — 91 passed, 0 failed, 3 ignored (EXIT=0)
- PASS: `npm test` (vitest) — 65/65
- PASS: `npm run check` (tsc) — clean
- PASS: 4x `tauri.conf.json` parse — version 1.0.8, `bundle.android {24, 9}`, 5-file icon array everywhere
- PASS: linux `icon.png` hash now equals desktop/macos/android shared KWL set
- PASS (2026-09-30 PM): tsc x4 + vitest 65/65 + cargo 91/0/3 after v1.0.9 bump; logcat proved API-25 crash cause (desugar fix in CI)
- NOT RUN: CI tag build v1.0.8; device APK install; per-platform logo screenshots
- 2026-09-30 PM: v1.0.8 CI run #67 android job FAILED at `gradlew` script compilation (`java.util.Properties()` unresolved in Kotlin DSL — patch missed imports); fixed with explicit imports + `getProperty()` + separate `keyPassword` prop; re-pushing same tag
- Updater overlay progress (all 4 apps): `Started` contentLength + `Progress` chunkLength accumulate into percent/bar/sizes; unknown-total shimmer fallback; tsc x4 + vitest 65 PASS

TESTS: PASS (65 vitest; 91 cargo / 3 ignored)
TYPECHECK: PASS
BUILD: PASS (frontend typecheck+tests; Tauri bundles via CI tag — NOT RUN yet)
REAL RUNTIME: NOT RUN (this session; no app-logic change)
INSTALLER: NOT RUN (waiting on v1.0.8 tag CI)
LICENSE: NOT RUN (free app)
KWL NEXUS: REMOVED (untracked `apps/desktop/src-tauri/src/nexus.rs` draft from prior session left unwired — not compiled, not referenced)
UPDATE: NOT RUN (needs published Release + signatures)
REPORT SYSTEM: PASS (unchanged)
ANDROID APK: IN PROGRESS (signing stabilized in CI config; device install NOT RUN)
GIT RELEASE: IN PROGRESS (v1.0.8 working tree uncommitted; no tag pushed yet)
LAST UPDATED: 2026-09-30

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
1.0.10