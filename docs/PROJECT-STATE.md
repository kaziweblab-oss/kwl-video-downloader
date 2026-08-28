# Project State

CURRENT PHASE:
v1.0.0 release build (multi-platform packaging + cleanup) — legacy auth/Nexus fully removed for the free, offline release

CURRENT TASK:
Prepare and verify the v1.0.0 production build: remove all account/Nexus UI and types, produce multi-platform bundle config, generate the full icon set, add GitHub Actions release CI, write release docs (README/INSTALL/USAGE/CHANGELOG), and validate everything with real commands.

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
- CI + docs:
  - `.github/workflows/build.yml`: validate (npm test + typecheck) → Windows (nsis+msi), Linux (deb+appimage), macOS (dmg), Android (apk, JDK17 + Android SDK in CI) on `v*` tags / manual dispatch → GitHub Release draft
  - `README.md` rewritten for v1.0.0; `docs/USAGE.md`, `docs/INSTALL.md`, `CHANGELOG.md` (v1.0.0: download, queue, history, 3GP, tool management) added

IN PROGRESS:
- Final validation sweep of the v1.0.0 build (npm test, npm run check, cargo check, cargo test, npm run build) — see LAST VALIDATION

NEXT:
- Human/CI: install Java + Android SDK to run `npx tauri android init` / `android build --apk`, add AndroidManifest permissions, bundle real Android tool binaries, produce and sign installers
- Human/CI: `git init` + add remote, tag `v1.0.0`, push (workflow publishes installers + draft release)

KNOWN ISSUES:
- Local machine has no Android SDK and no Java; Android build verified only in CI configuration (not executed anywhere yet)
- No git repository or remote exists in the workspace; release tag/push/publish requires human setup
- Windows WebView GUI click-through remains human-required (unchanged)

BLOCKED:
- Android init/build: Java + Android SDK required locally (CI config ready)
- Release publish: git repo + remote required (workflow ready)

LAST VALIDATION (all on the local desktop machine):
- PASS: `cargo check` — clean (only 2 pre-existing unrelated dead_code warnings)
- PASS: `cargo test` — 60 passed / 0 failed / 3 ignored, incl. 2 new bundled-native-tool tests + 7 tool-manager tests
- PASS: `npm run check` (desktop tsc) — clean
- PASS: `npm test` (root vitest) — 58/58 passed
- PASS: `npm run build --workspace @kwl/desktop` — vite build clean (58 modules, CSS 32.92 kB / JS 244.38 kB)
- PASS: `npx tauri icon` — full icon set generated (ico, icns, PNG squares, Android/iOS mipmaps)
- PASS: `tauri.conf.json` schema — validated by `tauri android init` (config errors resolved; only Java env error remains)
- PASS: Nexus removal — grep of src confirms zero account/login/Nexus/Coming-Soon references (only `author` metadata fields remain)

TESTS: PASS (60 native + 58 vitest)
TYPECHECK: PASS
BUILD: PASS (frontend vite build; native cargo check)
REAL RUNTIME: PASS (native dev launch + backend verified earlier; GUI click-through HUMAN_REQUIRED)
INSTALLER: NOT RUN
LICENSE: NOT RUN (no licensing in v1.0.0 — free app)
KWL NEXUS: REMOVED for v1.0.0 (free, offline, no account); v2.0.0 planned
UPDATE: NOT RUN (tool manager independent; staged/rollback verified via tests)
ANDROID APK: BLOCKED (no Java/Android SDK locally; CI config in place)
GIT RELEASE: BLOCKED (no repo/remote; workflow ready)
LAST UPDATED: 2026-08-28

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
- Keep the verified runtime/downloader architecture intact and the typed Tauri bridge for native interactions

## Current version
1.0.0