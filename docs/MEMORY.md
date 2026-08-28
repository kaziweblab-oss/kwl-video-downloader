# Session Memory

This file is the conversational memory layer for coding agents. Read it first, then `PROJECT-STATE.md` for formal gates. Update it at the end of every meaningful session so the next session can resume without re-deriving context. `PROJECT-STATE.md` remains the formal acceptance/evidence record; this file captures what we did, why, and what is next in plain narrative form.

## How to use this file

- Read the "Last session" entry plus "Current focus" before writing any code.
- Append a new "Last session" entry (move the old one into "Earlier sessions") at the end of meaningful work.
- Never delete accepted decisions; they are recorded in `DECISION-LOG.md`.

## Last session: 2026-08-28 (v1.0.0 release build — multi-platform packaging + free offline cleanup)

### What we did

- **Removed ALL Nexus/auth from the product** (v1.0.0 has no account/plan/license):
  deleted `src/nexus.rs`, `ui/components/AccountSection.tsx`, `NexusComingSoon.tsx`, `NexusLoginButton.tsx`,
  `NexusPlanBadge.tsx`, `NexusProfile.tsx`, `hooks/useNexusAuth.ts`, `useNexusPlan.ts`, `useNexusPlaceholder.ts`.
  `lib.rs` = `pub mod tools;`; `main.rs` invoke_handler keeps only downloader/tool commands;
  `main.tsx` no longer uses `NexusAuthProvider`; `App.tsx` account view removed; `AppShell.tsx` account block removed
  and footer shows `v1.0.0`; `viewStore` trimmed to 5 views; `SettingsView.tsx` keeps only General + Advanced + Updates
  (account + storage panels gone; `cleanupBrokenFiles` import removed, native command retained);
  EN/BN translation keys for account/login/signup/logout removed from `useTranslations.tsx`.
- **Versions → 1.0.0**: root + desktop `package.json`, `Cargo.toml`, `tauri.conf.json`, `get_app_info_impl`,
  `AppShell` footer, `app.ts` `DEFAULT_APP_VERSION`.
- **Deps**: `Cargo.toml` dropped `bcrypt/dotenvy/lettre/mongodb/uuid`; kept `reqwest/serde/tauri-plugin-store/dialog/url`.
- **Multi-platform config**: `tauri.conf.json` — identifier `com.kwl.videodownloader`, version 1.0.0, Windows NSIS
  (currentUser/en) + WiX MSI (en-US), macOS DMG, Linux DEB(+AppImage via targets all), `bundle.android.minSdkVersion 24`,
  publisher "KWL". The Tauri CLI schema validation caught two of my mistakes: `bundle.windows.msi` does not exist
  (it's `wix`) and `bundle.displayName` does not exist — both fixed, config revalidates clean (only Java error remains).
- **Icons**: generated a 1024px source PNG (dark rounded square + KWL + subtitle) with PowerShell System.Drawing, ran
  `npx tauri icon` → full set (ico/icns/32–128 pngs + Android/iOS mipmaps). `icons/` only had `icon.ico` before.
- **Android (config-side only — BLOCKED locally)**: `tauri android init` / `build` need Java + Android SDK
  (`JAVA_HOME`/`ANDROID_HOME` unset on this machine) — honest blocker, CI handles it. Provided the Rust side:
  `tools.rs` bundled-native-tool helpers (`bundled_native_tools_dir`, `make_executable` chmod 755 unix-only,
  `install_bundled_native_tool`, `resolve_bundled_tool_path`, `set_bundled_tools_base`, `resolve_bundled_tool`),
  `lib.rs::app_setup` registers the app-data base; `resolve_yt_dlp/ffprobe/ffmpeg` fall back to bundled before PATH;
  created `src-tauri/android/app/src/main/assets/native_tools/` with README (real Android yt-dlp + FFmpeg binaries
  are added at release time). AndroidManifest permissions (INTERNET + READ/WRITE_EXTERNAL_STORAGE) documented for post-init.
- **CI + docs**: `.github/workflows/build.yml` (validate → windows nsis+msi / linux deb+appimage / macos dmg / android apk
  on `v*` tags + workflow_dispatch → GitHub Release draft). Android job is deterministic (no third-party download step).
  Rewrote `README.md`, added `docs/USAGE.md`, `docs/INSTALL.md`, `CHANGELOG.md` (v1.0.0: download, queue, history, 3GP,
  tool management). Deleted `.env.bak` (real Google OAuth secrets), `test_download.webm`; `.gitignore` hardened.
- **Gates PASS**: `npm run check` (tsc clean), `npm test` (58/58 vitest), `npm run build --workspace @kwl/desktop`
  (vite clean, 58 modules), `cargo check` (2 pre-existing warnings), `cargo test` (60/60 + 3 ignored incl. 2 new
  bundled-tool tests), `npx tauri icon`, tauri.conf.json schema validation.
- **Verified Nexus removal**: grep of `apps/desktop/src` found zero account/login/Nexus/Coming-Soon refs (only
  `author` metadata fields match "Auth").

### Current focus

- Finish the v1.0.0 release: needs a Java+Android SDK machine (or CI) to run `tauri android init`/`android build --apk`,
  add AndroidManifest permissions, and bundle real Android tool binaries; and a git repo + remote to tag `v1.0.0`, push,
  and let the workflow publish installers + draft release. Desktop installers can be built locally on a Java-free machine.

### Gotchas and learnings

- Tauri 2 schema: `bundle.windows` has `nsis` and `wix` (NOT `msi`); there is NO `bundle.displayName` (use `productName`).
  The CLI validates config BEFORE the Android env check, so `tauri android init` is a free schema validator on any machine.
- Android: arbitrary binaries in `gen/android/app/src/main/assets` are INSIDE the APK and are NOT on the filesystem at
  runtime — extraction must go through the Android host (documented) or an AssetManager binding; Rust reads the extracted
  copy under `app_data_dir/native_tools` via the bundled-tools base.
- `cfg(target_os = "android")` code is NOT compiled by Windows `cargo check`, so any Android-only Rust is unverifiable here;
  keep platform-gated surface tiny and put cross-platform logic in normal (tested) functions.
- Icons: `npx tauri icon <1024px png>` generates everything (ico/icns/pngs/mipmaps); keep `source.png` in `icons/`.
- Deleting a secret-bearing `.env.bak` matters: old auth credentials were still in the workspace root.

### Resume checklist

1. `npm run check` — tsc clean
2. `npm test` — 58 pass
3. `npm run build --workspace @kwl/desktop` — clean
4. `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` — clean (2 pre-existing warnings)
5. `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — 60 pass / 3 ignored
6. Human/CI blockers: (a) Java + Android SDK to `tauri android init`/`android build --apk`, (b) `git init` + remote → `git tag v1.0.0` → push → GitHub Release

## Earlier sessions

### 2026-08-28 (KWL Nexus Phase 1 placeholder system — remove local auth)

- **Removed all local auth**: `lib.rs` now only `pub mod tools; pub mod nexus;`.
- **Rust skeleton**: created `nexus.rs` (typed mock commands for Phase 2) registered in `main.rs`.
- **Deps cleaned**: removed `tauri-plugin-google-auth`, `tauri-plugin-deep-link`, `bcrypt`, `jwt`, `mongodb`, `rusqlite`, `rand`; kept `open`/`reqwest`; removed google-auth perms, deep-link plugin block, and `@choochmeque/tauri-plugin-google-auth-api` (pruned lockfile via npm install).
- **Placeholder system**: `useNexusPlaceholder.ts` + `NexusComingSoon.tsx` (full + compact) + placeholder `NexusLoginButton`/`NexusProfile`/`NexusPlanBadge`/`AccountSection`; `useNexusAuth`/`useNexusPlan` rewritten as pure placeholders (no invoke, never error).
- **Env**: `.env`/`.env.example` cleaned (no GOOGLE_*/MONGODB; `NEXUS_API_URL` commented "Phase 2").
- **Gates PASS**: cargo check clean, tsc clean, 58/58 vitest, vite build clean. (SUPERSEDED same-day by the v1.0.0 cleanup, which removed the nexus skeleton entirely.)

### 2026-08-27 (professional progress hardening + managed tool manager + UI polish)

- **Progress bar static fix**: Root cause `total_bytes` stale `.or` (video 240M + audio 3.4M combined 243M never updated, 4 locations in `lib.rs` fixed to `if Some(v)` + `App.tsx` `??` total, `QueueView` percent-before-speed with derived fallback, `index.css` shimmer keyframes + 500ms determinate transition, verified with real `KWLPROG` 240M→243M → merge, 55 cargo (48+7 tool) pass.
- **UI polish initial-select + chain**: `mediaTypeChosen:true` Video initially, auto first Format/Quality/dimension via `formatOptionsFor`/`qualityTiersWithDimensions` after analysis, chain position-aware (`targetIdx<curIdx` only, not auto-full), Add Queue clears `url`+`analyses`+wizard reset, already-download toast success 3800ms with close btn, Go to Queue `goToQueueDismissed` hides after click until next add.
- **Managed tool system**: New `src/tools.rs` 560 lines — `AppData/KWL Video Downloader/tools/{yt-dlp,ffmpeg,ffprobe}/{current,previous,staging}/` + `manifest.json`, `health_check_executable` (`--version`/`-version`), `startup_health_check` + `background_update_check` offline-safe, safe staged `stage→health→backup→activate→health→rollback`, `has_active_download_jobs` defer, `resolve_*` prefers managed `current/` before PATH fallback, 3 Tauri commands + `tauriBridge` + startup toast. 7 deterministic tests PASS.
- **All gates PASS**: `cargo test` 55 pass, 3 ignored, `npm run check` clean, `npm test -- --run` 51/51, `npm run build` CSS 32.79 kB, `cargo check` clean, Tauri dev launches 5173/5174.

### What we did

- **Refactored Video quality flow**: Merged exact source dimensions into Quality step, removed separate Resolution and FPS wizard steps entirely.
  - Old flow: `MEDIA → TYPE → FORMAT → QUALITY → RESOLUTION → FPS → OUTPUT` (Video, 7 steps)
  - New flow: `MEDIA → TYPE → FORMAT → QUALITY → OUTPUT` (Video, 5 steps; Audio 5 steps, no dimension)
  - Quality tiers derived strictly from analyzed source; exact dimensions grouped under each tier
  - Single-dimension tiers auto-resolve dimension on quality pick; multi-dimension tiers show dimension buttons for selection
  - FPS completely removed from user-facing configuration flow
  - Wizard steps updated: Video 5 steps, Audio 5 steps (no Resolution/FPS)
  - `downloadFlow.ts`: new `QualityTier` type with grouped dimensions, `qualityTiersWithDimensions()`, updated `canAddToQueue` with dimension check, `findExistingDownload` handles legacy tier-only history
  - All tests updated: 51 vitest, 48 cargo pass

- **Bangla translation fixes**: Fixed garbled "autoDetectHint" text (removed Hebrew characters), fixed "election" English words in 4 keys, added language persistence to settingsStore (survives app restarts)

- **SettingsView cleanup**: Removed "After Download" dropdown from Advanced panel per request

- **All gates PASS**: `npm run check` (tsc clean), `npm test -- --run` (51/51 vitest), `npm run build --workspace @kwl/desktop` (CSS 32.71 kB), `cargo test` (48 pass, 1 ignored)

### Current focus

- Phase 3 Human Acceptance Gate: `npx tauri dev` — verify REFACTORED wizard (MEDIA→TYPE→FORMAT→QUALITY→OUTPUT auto-advance + Back + completed-click, Audio same 5 steps, Quality shows exact dimensions inline, no FPS anywhere, trash clears) and monotonic progress (no backward, byte-weighted, merge 92/validating 98, unknown-total indeterminate, speed/ETA honest hide, pause frozen, resume monotonic, completed 100% with ffprobe). Remaining HUMAN_REQUIRED for full GUI walk.

### Gotchas and learnings

- Quality tier + exact dimension is a single logical choice in user's mental model — no separate Resolution step needed
- Single-dimension tiers should auto-resolve to avoid unnecessary click
- Legacy history entries with tier-only (e.g., "1080p") match new dimension selections by height
- Audio quality was stored in history `resolution` field — handled in `findExistingDownload`

### Resume checklist

1. `npm run check` — tsc clean (51 vitest: `npm test -- --run`)
2. `npm run build --workspace @kwl/desktop` — CSS 32.71 kB
3. `cargo test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 48 pass, 1 ignored
4. Human: `npx tauri dev` GUI walk (analyze → media Next → type → format → quality (+dimension) → output → Add → sequential start → merge 92 → validating 98 → completed 100 → pause/resume → ffprobe → history)

## Earlier sessions

### What we did

- **Monotonic progress aggregator (Rust)**: New `ProgressAggregator` keyed by template `filename` — byte-weighted `combinedDownloaded/combinedTotal*100` (clamped), monotonic `peak_percent/peak_downloaded` (never backward when yt-dlp starts audio stream at 0%), unknown-total → `None` percent + indeterminate UI, `speed/eta` hidden when None (no stale `--` values), phase floors `processing/merging 92`, `converting 92`, `validating 98`, `completed 100` via `apply_phase_floor`; `mark_job_converting/validating/completed` enforce floors; both stdout/stderr threads ingest via `aggregator.ingest`; 8 new deterministic Cargo tests (single-stream monotonic, byte-weighted video+audio with late-discovered stream retaining peak, unknown-total no fabricated percent, merging/validating never reset, converting hides speed/eta, paused keeps peak, completed exactly 100, no fake eta/speed) — 48 pass +1 ignored.
- **Frontend monotonic guard**: `applyJobToCartItem` now enforces `Math.max(item.percent, job.percent)` + phase floor (92/98/100) and monotonic bytes, hides speed/eta when backend omits them; `QueueView` honest status line `68% • 18.4 MB/s • 824 MB / 1.21 GB • ETA 00:19` omitting missing parts, `Merging video and audio...`/`Converting to 3GP...`/`Validating file...` indeterminate shimmer, `Paused 68% • 824 MB / 1.21 GB`, determinate bar only when total known, no `--` placeholders.
- **Horizontal wizard**: Pure `downloadFlow` state machine `WizardStepId` (`media/type/format/quality/resolution/output`), `getStepsForMedia` (VIDEO 6, AUDIO 5 skips resolution), `getWizardStepStatus/next/prev/isCompleted`, `aggregateProgress/phaseFloor`; `App.tsx` `wizardStep` state + `wizardSteps` memo + `canProceedCurrent/handleWizardNext/Back/onStepClick` + auto-advance on type/format/quality/resolution pick + reset downstream + Back resets correctly; `Configuration.tsx` single-step display with step chain (blue completed check + connector, strong current, dimmed future/locked) and Only-current-step controls, MEDIA first no Back, Last step `Add to Queue +`, future locked not clickable, trash icon for Remove selected, no FPS.
- **Tests + gates**: Updated `desktop-ui.test.ts` for wizard (MEDIA/TYPE/FORMAT/QUALITY/RESOLUTION/OUTPUT chain, hidden Resolution for Audio, single-step controls, no FPS, Next disabled); expanded `download-flow.test.ts` with wizard + aggregateProgress/phaseFloor suites (16 → 51 vitest total). All 51 vitest, tsc clean, cargo 48 pass, build CSS 32.59 kB.
- **Preserved all Phase 3 functionality**: yt-dlp analysis, multi-select, video/audio, MP4/WEBM/3GP, audio formats, source-exact resolutions, 3GP transcode, pause/resume/cancel/retry/queue/history/file-synced/ffprobe/sequential.

### Current focus

- Phase 3 Human Acceptance Gate: `npx tauri dev` — verify wizard (MEDIA→TYPE→FORMAT→QUALITY→RESOLUTION→OUTPUT auto-advance + Back + completed-click, Audio skips Resolution, no FPS, trash clears) and monotonic progress (no backward, byte-weighted, merge 92/validating 98, unknown-total indeterminate, speed/ETA honest hide, pause frozen, resume monotonic, completed 100% with ffprobe). Remaining HUMAN_REQUIRED for full 12-step GUI walk.

### Gotchas and learnings

- `Values<HashMap>` is not `DoubleEndedIterator` — cannot `.rev().find_map` on `values()`; use incoming speed/eta directly.
- Combined percent must be `None` when any stream total is None — fabricating 45% from single-stream peak would hide indeterminate requirement.
- Late-discovered second stream (video 80 then audio 10) raw 45% must stay at peak 80 — monotonic peak prevents backward.
- `progress_percent` at 95 then `processing` floor 92 must stay 95, not drop — `max(peak, floor)` handles both cases.

### Resume checklist

1. `npm run check` — tsc clean (51 vitest: `npm test -- --run`)
2. `npm run build --workspace @kwl/desktop` — CSS 32.59 kB
3. `cargo test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 48 pass, 1 ignored
4. Human: `npx tauri dev` 12-step walk (analyze → media Next → type → format → quality → resolution → output → Add → sequential start → merge 92 → validating 98 → completed 100 → pause/resume → ffprobe → history)

## Earlier sessions

- 2026-08-26 (real-time progress display regression fix)

### What we did

- **Root-caused real-time download status display regression**: After multi-select changes, progress/speed/ETA was not displaying in UI due to two interacting issues:
  - **Polling interval churn**: `activeJobSignature` included `ACTIVE_CART_STATUSES` filter causing the `useEffect` to tear down/restart the 1-second poll interval on every status transition (Queued→Downloading→Processing→etc.), creating gaps where progress from Rust was missed
  - **Stale cart items**: `startCartItemJob` only set `jobId` from the Rust response, leaving cart items in stale state (`status: 'Queued'`, `percent: 0`) until next poll cycle — which could be disrupted by issue #1
- **Fix 1** (App.tsx:628-631): Removed `ACTIVE_CART_STATUSES` filter from `activeJobSignature` — any cart item with a `jobId` now triggers tracking regardless of status, preventing effect teardown on status transitions
- **Fix 2** (App.tsx:753-762): Applied full Rust response to cart item immediately — `status`, `percent`, `downloadedBytes`, `totalBytes`, `speed`, `eta` — shows correct initial progress instead of waiting for next poll cycle
- **Verification**: All 37 vitest tests pass, cargo check clean, tsc clean

### Current focus

- Phase 3 Human Acceptance Gate: Run `npx tauri dev`, verify real-time progress/speed/ETA displays during download, no flickering/gaps; then full 12-step GUI walk (analyze → add → sequential start → ring cancel → pause/resume → complete → ffprobe → history)

### Gotchas and learnings

- `Math.round(format.fps)` after a typeof filter still types `number | undefined` — narrow via `.filter((v): v is number => ...)`.
- yt-dlp `--print` implies `--quiet`, suppressing ALL progress output; always pair with `--no-quiet` when progress matters.
- yt-dlp writes template progress to stdout (not stderr); parse both streams.
- Re-running a download test into a non-empty output dir makes yt-dlp skip ("already downloaded") with zero progress lines — clean the dir first.
- `#[cfg]` on block expressions in `let` position is invalid Rust; rely on same-name cfg-gated functions instead.

### Resume checklist

1. `npm run ci:check` — 37 tests expected
2. `npm run build --workspace @kwl/desktop`
3. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 37 pass
4. Human: Tauri GUI — verify real-time progress displays, then Phase 3 acceptance

- 2026-08-25 (multi-select + quality tiers + resolution dimensions)

### What we did

- **Multi-select media cards**: Analyzed media cards now use `selectedMediaIds` Set for selection state; card click and checkbox click both toggle the same state; multiple cards can be selected simultaneously; "Remove selected" action bar appears at top of analyzed media section when cards are selected
- **Quality tiers derived from source**: `qualityOptionsFor` now derives video quality tiers from actual analyzed `videoResolutions` instead of hard-coded `['Best']`; quality options are the unique source height labels (e.g., 1080p/720p/576p) sorted descending by height; audio qualities remain unchanged
- **Resolution/Dimensions UI**: Resolution section now shows Exact Resolution (Source) dropdown with source dimensions "W × H" for the chosen quality tier; quick select tiers removed from this UI step; quality and resolution are separate controls with proper cascading/reset behavior
- **Remove selected action**: When one or more media cards are selected, a compact action bar shows "Remove selected" button (using existing SECONDARY_BUTTON style); clicking it clears all selected cards, resets active preview, and resets all downstream configuration (type/format/quality/resolution)
- **FPS completely removed from UI**: No FPS selectors, labels, or references in the user-facing UI; FPS field preserved in native bridge/bridge payload for backward compatibility but not rendered or used in selection flow; `canAddToQueue` no longer checks fps
- **Deprecated `selectedAnalysisId` → `selectedMediaIds` + `activeMediaId`**: Single selection model replaced with multi-select (`selectedMediaIds: string[]`) + active preview (`activeMediaId: string | null`); analyzed-media list keeps selection and preview as separate concepts

### Current focus

- Human GUI walk (Phase 3 open): multi-select flow, remove selected action, quality/resolution derivation from source, 3GP transcode download, file-synced history verification.

### Gotchas and learnings

- `Math.round(format.fps)` after a typeof filter still types `number | undefined` — narrow via `.filter((v): v is number => ...)`.
- ffmpeg 3gp muxer accepts mpeg4+aac; scale=-2:H keeps aspect with even width.
- SSR pre-analysis assertions: helper texts now, no invented buttons.
- Moving from `selectedAnalysisId` to `selectedMediaIds + activeMediaId` required careful cascade reset in `resetDependentSelections`.
- The "Remove selected" action bar must be visually obvious but use existing button styles (SECONDARY_BUTTON).
- Card click and checkbox must behave identically — both toggle the same `selectedMediaIds` state.

### Resume checklist

1. `npm run ci:check` — 37 tests expected
2. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 37 pass
3. Human: GUI walk (multi-select → remove selected → quality tiers → resolution dimensions → 3GP → history sync)

## Earlier sessions

- 2026-08-25 (Quality tiers vs exact dimensions split)

### What we did

- Split the combined "1080p — 1920×1080" buttons: **Quality (video) = tier labels only** (unique heights desc via `videoQualityTiers`), **Resolution = exact dimensions for the chosen tier** (`dimensionsForTier`, auto-select first on tier change). Audio unchanged (bitrate qualities, resolution hidden).
- Native enforcement: `resolution_dimensions` parses "1080p" (legacy height-only) AND "1920x1080"/"1920×1080" (width+height); `build_video_format_selector(container, height, width)` adds `[width<=W]` when width present — dimension choice is real. 3 new native tests (33 total, 1 ignored).
- Duplicate matching height-normalized (`resolutionHeight`): legacy "1080p" history matches new "1920×1080" selection; `tierFromResolutionValue` maps stored values back to tiers for retry.
- All gates green: cargo 32 pass + 1 ignored; vitest 40/40; build PASS; Tauri launch PASS (PID 28624).

### Current focus

- Human Phase-3 GUI walk still pending (sequential flow, duplicates, file-synced history, real download).

### Gotchas and learnings

- '×' is multibyte UTF-8 — Rust `split_once(['x', '\u{00d7}'])` handles both separators.
- SSR disabled-regex must anchor on `disabled=""` (Tailwind `disabled:` class text false-positives otherwise).
- `videoResolutions` can contain duplicate labels (same height, different widths) — tiers dedupe by label, dimensions list preserves all widths.

### Resume checklist

1. `npm run ci:check` — 40 tests expected
2. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 32 pass, 1 ignored
3. Human: GUI walk (tier → dimension → download; verify width filter in yt-dlp output)

## Earlier sessions

- 2026-08-25 (strict sequential form + file-synced history)

### What we did

- **Strict sequential download form**: new pure module `apps/desktop/src/ui/downloadFlow.ts` (isAnalyzableUrl, format/quality options, isResolutionVisible, canAddToQueue, findExistingDownload, describeExistingDownload). UI flow: URL → Analyze (valid URL only) → preview card → Media Type → Format → Quality (separate state; Video=Best, Audio=bitrates) → Video-only source-driven Resolution → Add (logic-gated). Steps render disabled until unlocked. Analyzed-media list kept as the selection library.
- **Duplicate guard (user request)**: re-analyze of a known URL selects the existing analysis; Add blocks same video+type+format+(video resolution) that is added/queued/downloading/paused in cart or completed-with-file in history and shows which status; different format/resolution re-downloads. Audio duplicates match by url+format.
- **File-synced history**: `partition_history_by_existing_files` in lib.rs — every `get_download_history` read removes completed entries whose output file is missing (or path-less) and rewrites AppData history; failed/cancelled kept; never deletes files. History panel Refresh button added.
- CartItem gained `quality`; retry maps audio quality from history resolution.
- Tests: 7 new native sync tests (31 total, 1 ignored) + 16 new download-flow vitest cases + 3 SSR disabled-state tests (37 total). All gates green; fresh Tauri launch PASS (PID 13600).

### Current focus

- Human GUI walk of the new sequential flow + real download (Phase 3 stays open).

### Gotchas and learnings

- SSR `disabled` assertions must match `disabled=""` — Tailwind class strings like `disabled:opacity-45` otherwise false-positive the regex.
- `isAnalyzableUrl` must require an explicit http(s) prefix; prepending `https://` made `ftp://` parse as valid.
- History completed entries always have a file path; failed entries store the output directory — sync only checks completed.

### Resume checklist

1. `npm run ci:check` — 37 tests expected
2. `npm run build --workspace @kwl/desktop`
3. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 30 pass, 1 ignored
4. Human: GUI walk (analyze → strict steps → duplicate block → download → delete file in Explorer → refresh history → entry gone)

## Earlier sessions

- 2026-08-25 (retry removes failed history entry)

### What we did

- History Retry on a FAILED entry now also removes that failed entry: `handleRetryHistory` queues the retry cart item, then calls the existing native `delete_download_history` (timestamp + output_path match) and updates history state. If the retry fails again, the native layer writes a fresh failed entry — no stale duplicates.
- Frontend-only change; deletion semantics already covered by 3 deterministic native removal tests. Verified: `npm run ci:check` 18/18 + tsc clean, build PASS.

### Current focus

- Human Phase-3 GUI walk (12 steps incl. pause/resume) still pending.

### Gotchas and learnings

- Failed entries store the output DIRECTORY as output_path (filename is null); delete matches timestamp+path exactly, which still matches failed entries.

### Resume checklist

1. `npm run ci:check` — 18 tests expected
2. `npm run build --workspace @kwl/desktop`
3. Human: Tauri GUI 12-step walk; then close Phase 3

## Earlier sessions

- 2026-08-25 (real-time progress + true pause/resume)

### What we did

- **Root-caused the 0%/`--`/s progress bug**: yt-dlp `--print` implies `--quiet`, suppressing ALL progress output. Fixed with `--no-quiet` + `--progress-template "download:KWLPROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s %(progress.filename)s"`; Rust parses KWLPROG lines (percent computed from bytes, estimate fallback, clamp 100), legacy scraper kept as fallback; both stdout/stderr threads parse; `filename` added to DownloadJobResponse.
- **True pause/resume natively**: `pause_download`/`resume_download` commands; NtSuspendProcess/NtResumeProcess over the whole process tree (Toolhelp32 child enumeration, direct FFI, no new crates — needed because `py` spawns python.exe as a child). `paused` status preserves job ID/progress/bytes/temp/history-silence; pause idempotent, only queued/downloading; cancel unchanged (taskkill /T /F).
- UI: Pause ring while Downloading, amber Resume ring while Paused, X stays Cancel; progress line `68% · 4.82 MiB/s · 124.5 MB / 183.2 MB · ETA 00:19`, omits missing pieces; Paused = amber dot/text; runner treats Paused as busy; EN/BN labels added.
- Tests: 24 cargo (template parser: bytes/estimate/missing-total/malformed/clamp/non-template; state marks: pause≠cancel, resume keeps id + no history write, pause-resume cycle) + 18 vitest (getCartItemStatus mapping incl. paused). Real-download lifecycle test (`#[ignore]`, run manually) PASSED with a real 30MB MP4: live progress, frozen pause 1.5s, same-id resume, ffprobe completion, exactly one history entry.
- Fresh Tauri dev launch PASS (exe PID 18772 + Vite 200).

### Current focus

- Human GUI walk of the 12-step workflow in the real app (start → % changes → speed → ETA → Pause → Paused → Cancel separate → Resume → continues → complete → ffprobe → one history entry). Phase 3 stays open for that.

### Gotchas and learnings

- **yt-dlp `--print` implies `--quiet`** — always pair with `--no-quiet` when progress matters.
- yt-dlp writes template progress to stdout here (not stderr); parse both streams.
- Re-running a download test into a non-empty output dir makes yt-dlp skip ("already downloaded") with zero progress lines — clean the dir first.
- `#[cfg]` on block expressions in `let` position is invalid Rust; rely on same-name cfg-gated functions instead.

### Resume checklist

1. `npm run ci:check` — 18 tests expected
2. `npm run build --workspace @kwl/desktop`
3. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 24 pass, 1 ignored
4. Real lifecycle (optional, network): `cargo test ... real_download_pause_resume_lifecycle -- --ignored`
5. Human: Tauri GUI 12-step walk; then close Phase 3

## Earlier sessions

- 2026-08-25 (queue-runner deadlock fix)

### What we did

- Fixed the user-reported "download icon does nothing / no network activity": the queue runner was deadlocked — its busy check counted 'Queued' as active, and the item to start IS 'Queued', so it blocked itself forever. Add also created 'Pending' items the runner never picked (documented "Add, sequential auto-start" never fired).
- Fix in `App.tsx`: new `RUNNING_CART_STATUSES` (Downloading/Processing/Validating); runner waits only when a start is in flight (`startingItemsRef`), a job is running, or a 'Queued' item already has a jobId (parallel-start guard across the queued→downloading poll window). `handleAddToQueue` now enqueues as 'Queued'. `isActive` simplified to RUNNING statuses. Start icon still handles Pending/Cancelled/Failed (manual start/retry).
- Verified: `npm run ci:check` 15/15 + tsc clean; desktop build PASS.

### Current focus

- Human Phase-3 desktop acceptance (now actually exercisable: Add → sequential auto-start → ring cancel → retry). Then audit recommendations (git init first).

### Gotchas and learnings

- Never put a runner's own consumable state ('Queued') inside the runner's busy set — classic self-deadlock.
- The queued→downloading window needs the jobId guard or StrictMode/multi-item carts start jobs in parallel.

### Resume checklist

1. `npm run ci:check` — tests + typecheck
2. `npm run build --workspace @kwl/desktop`
3. Human: Tauri GUI — analyze → Add → watch sequential auto-start, ring cancel, retry

- 2026-08-25 (responsiveness fixes + full app audit)

### What we did

- Fixed the user-reported History/Cart overlap: mobile grid track 56px vs 72px thumbnail; track now 72px, badge `justify-self-start`.
- Ran a FULL app audit (every source file read + fresh gates): report at `docs/FULL-APP-AUDIT-REPORT.txt`; responsive details in `docs/RESPONSIVE-AUDIT-REPORT.txt`.
- Fresh evidence: `npm run ci:check` (15/15 + tsc), desktop build (CSS 18.90 kB), `cargo check`, `cargo test` 14/14, tauri.conf.json valid.
- 21 findings (0 HIGH / 3 MEDIUM / 7 LOW / 11 INFO). Top MEDIUMs: (A1) workspace is NOT a git repo so CI can't run; (A2) history timestamps use Rust `SystemTime` debug format so the UI never renders them; (A3) Browse button is a placeholder (needs tauri-plugin-dialog).

### Current focus

- Human Phase-3 desktop acceptance still pending; then consider the audit recommendations (git init first).

### Gotchas and learnings

- `cargo` stderr triggers PowerShell NativeCommandError noise; "Finished" = success. Chain cargo commands separately (`if ($?)` breaks after redirected stderr).
- `git rev-parse` confirms no `.git` — CI workflow is dead until git init.

### Resume checklist

1. `npm run ci:check` — tests + typecheck
2. `npm run build --workspace @kwl/desktop`
3. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 14 tests
4. Human: Tauri GUI acceptance with real URLs; then audit recs #1–#5

- 2026-08-25 (responsiveness audit + fixes)

### What we did

- Full responsive audit of `apps/desktop/src/ui/App.tsx`, `index.css`, `tailwind.config.js`, `index.html`, and `tauri.conf.json`.
- Fixes applied:
  - Unified the two two-column grids (Analyzed-media/Media-type section; Format/Resolution grid) from `md:`/`max-md:` (768px) to the project's 760px system via `grid-cols-1 min-[761px]:...` — removes the cramped 761–767px zone.
  - `ANALYSIS_LI` now gets ≤520px tuning (`60px` thumb column, tighter gap/padding), matching History rows.
  - Main container gets `max-[520px]:px-3 pb/pt` tightening.
  - URL-panel status pill is truncate-safe (`max-w-full truncate`).
  - Tauri window config gained `"minWidth": 380, "minHeight": 520`.
- Verification: tauri.conf.json JSON valid; `npm run check` PASS; `npm test -- --run` 15/15 PASS; desktop build PASS (CSS 18.85 kB).

### Current focus

- Human UI review of responsiveness at ~380–760px in the running dev/Tauri shell; then finish Phase 3 desktop acceptance.

### Gotchas and learnings

- The project uses TWO breakpoint systems side by side: custom `max-[760px]`/`max-[520px]` and Tailwind's `md:` — always prefer the custom ones for consistency.
- Cart rows reuse HISTORY_LI but have only 3 children (no format badge); the empty auto track collapses to 0 so actions still right-align — no fix needed.

### Resume checklist

1. `npm run check` — typecheck
2. `npm test -- --run` — 15 tests expected
3. `npm run build --workspace @kwl/desktop` — production build
4. `npm run dev` / `npx tauri dev` and resize the window through 1200→380px widths to review all breakpoints

## Earlier sessions

- 2026-08-25 (Tailwind CSS migration + title overlap fix)

### What we did

- Fixed long-title overlap in the Analyzed media list: `.analysis-list li` (extra mark-toggle child) was mis-gridded by the 4-column history template, pushing the title column to `auto` so it spilled over the thumbnail. Gave it `grid-template-columns: auto 64px minmax(0,1fr) auto`.
- Migrated the entire frontend styling from the 920-line `apps/desktop/src/styles.css` to **Tailwind CSS 3** utilities inline in `App.tsx` (same dark design: panels, gradients, badges, rings, responsive 760px/520px breakpoints via `max-[760px]:`/`md:`).
- Deleted `styles.css`; added minimal `src/index.css` (tailwind directives + `@layer base` for the body gradient, font-weight/cursor rules). `main.tsx` now imports `index.css`.
- Added `tailwind.config.js` + `postcss.config.js` and devDeps tailwindcss@3/postcss/autoprefixer in `apps/desktop`.
- Shared class strings live as consts at the top of App.tsx (PANEL, TEXT_INPUT, PRIMARY_BUTTON, HISTORY_LI, ICON_BUTTON, etc.); status colors via small Record maps.
- Verification: 15/15 vitest, `tsc --noEmit` clean, `vite build` OK (18.44 kB CSS). Dev server verified on http://localhost:5173 (HTTP 200).

### Current focus

- Human UI review of the Tailwind restyle in the running dev server / Tauri shell; then finish Phase 3 desktop acceptance (real URL analyze → mark → Add → cart → history flow).

### Gotchas and learnings

- Tailwind arbitrary properties are needed for SVG strokes: `stroke-current stroke-[1.8] [stroke-linecap:round]`.
- Responsive: old `max-width:760px`/`520px` media queries map to `max-[760px]:`/`max-[520px]:` and `md:` (768px) for the two-column grids — close enough visually, review in browser.
- Tests do not depend on CSS class names, so the rewrite was test-safe.

### Resume checklist

1. `npm run check` — typecheck
2. `npm test -- --run` — 15 tests expected
3. `npm run build --workspace @kwl/desktop` — production build (Tailwind CSS ~18 kB)
4. `npm run dev` and visually review at http://localhost:5173 (or `npx tauri dev`)

- 2026-08-25 (analyzed media list + multi-format native support)

### What we did

- Reworked the media panel into an **Analyzed media list**: each Analyze appends (or refreshes, same URL) a compact selectable card (thumbnail, title, author·duration·host). Cards support:
  - click = select (drives the format/resolution selectors)
  - mark toggle (checkbox) = multi-mark for bulk add
  - X icon = remove from the list
- **Add** now enqueues all marked cards (or the selected card) with the currently chosen media type/format/resolution; audio entitlement (20-min) and duplicate guards run per target item.
- Removed the static preview card from the selection panel; media-type control remains there.
- Video format list = analyzed containers ∪ {MP4, WEBM}; audio format list = fixed common set {MP3, M4A, OPUS, WAV} ∪ analyzed audio containers (WEBM/3GP noise filtered).
- Native download now honors the requested container and resolution:
  - `resolution_height("720p") -> 720` parser; format selectors include `[height<=N]`
  - mp4/webm/3gp get ext-specific selectors; webm adds `--merge-output-format webm`
  - mkv/avi/mov/flv use best streams + `--merge-output-format` + `--remux-video`
  - audio `--audio-format` extended to mp3|m4a|opus|wav
- Output folder input now spans full width (CSS `width: 100%`).
- Removed dead CSS (`download-queue-card`, `download-card-*`, `card-cancel-button`, plain `status-dot`) and the unused `getUnavailableAnalysis` path; analysis failures no longer wipe the media list.
- `videoResolutions` now prefers resolutions computed from actual analyzed formats (previously it ignored them and always showed defaults).
- 3 new native tests (resolution parsing, container selectors, merge/remux flags) — 14 total.

### Current focus

- Phase 3 desktop acceptance remains **HUMAN_REQUIRED**: exercise the real Tauri WebView flow (analyze multiple URLs, mark several, bulk Add, sequential downloads, ring cancel, cart delete, history delete, restart persistence) with real public URLs.
- Do not start Phase 4 (runtime bundling/installer) until that gate passes.

### Gotchas and learnings

- `cargo`/`npm` are not on the default PATH in this shell: cargo lives at `C:\Users\Khairul Islam\.cargo\bin\cargo.exe`; call it with the full path. PowerShell prints a scary `NativeCommandError` for cargo's stderr progress output; "Finished" means success.
- yt-dlp analysis must use `--dump-single-json`; `--print json` returned `NA` metadata (fixed earlier, keep it).
- Vite must exclude `apps/desktop/src-tauri/**` from watching or the dev server dies with `EBUSY` on the compiled exe.
- The Tauri WebView cannot be automated here; browser-mode checks use the safe fallback bridge (no `__TAURI_INTERNALS__`), and the SSR smoke test renders `App` via `react-dom/server` with `createElement` (root vitest has no React plugin, so avoid JSX in `tests/*.test.ts`).
- Root vitest config only includes `tests/**/*.test.ts` in node environment.
- Module-level consts must be declared before use in App.tsx (TS2448): `DEMO_ANALYSIS` sits after the `DEFAULT_*` constants.
- yt-dlp `--merge-output-format` supports avi/flv/mkv/mov/mp4/webm; `--remux-video` covers the non-native containers; 3GP has no remux so it relies on native 3gp progressive formats.

### Resume checklist

1. `npm run check` — typecheck
2. `npm test -- --run` — 15 tests expected
3. `npm run build --workspace @kwl/desktop` — production build
4. `& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path "apps/desktop/src-tauri/Cargo.toml"` — 14 tests expected
5. `npm run dev` (or `npx tauri dev` for the real shell) and walk the analyzed-list → mark → Add → cart flow manually

