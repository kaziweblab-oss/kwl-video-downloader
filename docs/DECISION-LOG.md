# Decision Log

## 2026-08-29
### Decision: v1.0.0 in-app report system (Error / Suggestion / Feedback) with email + local fallback queue
Reports are sent from **Settings → "📧 Report Issue / Suggestion"**. The frontend (`useReport.ts`, `ReportModal.tsx`, `ReportButton.tsx`) sends a typed payload through the `send_report` Tauri command backed by `src-tauri/src/report.rs`. Delivery uses a Resend-style HTTP POST to `https://api.resend.com/emails` (Bearer API key) reading process env `REPORT_EMAIL_TO` / `REPORT_EMAIL_FROM` / `REPORT_EMAIL_API_KEY` — no SMTP crate (lettre stayed removed per the master prompt). If email is not configured or delivery fails, the report is queued to `reports.json` (app data dir, capped at 200, oldest preserved) and `flush_pending_reports` retries at next launch. A report always returns `Ok` to the UI (either emailed or queued); UI shows the exact required toasts (success `Thank you for your report! 🙏`, failure `Failed to send report. Please try again.`). Optional "attach diagnostic info" prepends app name/version/platform/environment + settings.

### Reason
- The master prompt requires a report center and an email fallback; users of a free/offline app need a support channel that never errors out.
- Keeping email out of the Rust dependency tree and using a simple HTTP API means no extra Tauri plugin or heavy crate.

### Consequence
- 7 new backend tests (validation, ISO-8601 timestamp, local fallback, queue cap, flush-without-email) isolated via `KWL_REPORTS_DIR` + `env_lock`; browser (no Tauri) `send_report` is a no-op stub for previews.
- `bundle.android.versionCode: 1` added (verified against Tauri CLI schema: `minSdkVersion`/`versionCode` exist, no `targetSdkVersion` key — default targetSdk 34; versionName from conf version).
- CI android job now copies staged `native_tools/*` binaries into the generated `gen/android` project and patches the generated `AndroidManifest.xml` (INTERNET, READ/WRITE_EXTERNAL_STORAGE) after `tauri android init`.
- Added `tools::bundled_tool_asset_relative_path` (asset-path helper for Android runtime extraction) with a test.
- Git repo initialized; initial commit `8ec31c1`, tag `v1.0.0` — push/release still blocked (no remote).

## 2026-08-25
### Decision: explicit selection at every step + FPS as a source-strict control
Analyze no longer auto-selects the analyzed media: the card must be clicked (or marked), and each configuration section renders only after its prerequisite — Media Type after media selection, Format after type, Quality after format, Resolution (video) after quality, FPS (video) after resolution. Any upstream change resets all dependent values. Video Quality is the single honest "Best" (the source exposes no other meaningful quality axis), Resolution is the flat source-exact dimension list, and FPS options are derived per-dimension from analyzed formats — the FPS section is hidden entirely when the source exposes no fps data, and Add requires FPS only when those options exist. The handleAddToQueue DEMO fallback was removed: with no explicit selection Add shows "Please select an analyzed video first." and example.com/video can never enter the queue. Native `validate_download_request_input` mirrors the rules (video requires resolution; fps requires resolution; zero fps rejected).

### Reason
- Users pressed Add thinking nothing was selected (auto-select highlight was missed) and downloads started unexpectedly.
- Tier-based quality duplicated the resolution concept; the spec defines Quality, Resolution, and FPS as independent source-strict controls.
- The DEMO fallback was a latent path for fake media entering the queue.

### Consequence
SSR tests assert no invented buttons pre-analysis; downloadFlow tests cover per-dimension FPS derivation, the fps-required rule, and reset semantics. The analyzed-media list remains the selection library.

## 2026-08-25
### Decision: 3GP always available via ffmpeg transcode with a converting state
3GP now appears unconditionally in the video format list. When the analyzed source lacks native 3GP, the download request carries `transcode: true`: yt-dlp fetches the best mp4/webm (height/width/fps filters), the job enters a new "converting" state, ffmpeg transcodes to .3gp (`-c:v mpeg4 -b:v 300k -vf scale=-2:H -c:a aac -ar 16000 -ac 1 -b:a 32k`), and the .3gp then goes through the standard ffprobe validation before completing. The ffmpeg PID is tracked in the job so Cancel terminates mid-conversion; temp cleanup and single-history semantics are unchanged. Sources with native 3GP keep the direct ext-filter path.

### Reason
- The user explicitly requested 3GP availability for all videos and chose the ffmpeg transcode approach.
- mpeg4+aac are ffmpeg built-in encoders (AMR-NB was avoided — many builds lack libopencore-amrnb); runtime proof on artifacts/sample-test.mp4 produced a ffprobe-valid .3gp.

### Alternatives considered
- 3GP only when the source provides it: rejected by the user (modern sources never provide it).
- AMR-NB audio: rejected for build-availability risk.

### Consequence
Transcode quality is intentionally limited by the 3GP format. Retry of a transcoded 3GP download re-downloads without the transcode flag (history stores no source-support metadata) — documented limitation. New tests cover the transcode decision, argument builder, converting state marks, fps selector, and request validation.

## 2026-08-25
### Decision: Quality holds tier labels and Resolution holds exact dimensions, enforced natively
The previously combined "1080p — 1920×1080" resolution buttons are split: the Quality control now shows tier labels only (1440p/1080p/720p/... derived from analyzed heights, unique and sorted descending), and the Resolution control shows the exact dimension(s) (1920×1080) available for the chosen tier, auto-selecting the first on tier change. Audio keeps bitrate qualities with Resolution hidden. Natively, `resolution_dimensions` accepts both legacy "1080p" (height-only) and "1920x1080"/"1920×1080" (width+height), and the yt-dlp selector appends `[width<=W]` when a width is provided — so a chosen dimension is enforced in the real download, not cosmetic. Duplicate detection compares resolutions by parsed height, so legacy history entries ("1080p") and new dimension selections ("1920×1080") match as the same target.

### Reason
- The user flagged that tier (1080p/720p) and exact pixels (256×144) are different concepts and asked for separate management.
- The combined buttons also produced duplicate labels when one source height had multiple widths.
- A selectable dimension that the download ignored would have been a fake control.

### Alternatives considered
- Display-only dimensions (no native width filter): rejected — selection must affect the real download to stay honest.
- Exact-match `[width=W][height=H]` filters: rejected — `<=` caps avoid zero-match failures when encodes differ by a pixel.

### Consequence
Cart resolution values may now be "1920×1080"; retry maps stored values to tier + dimension via `tierFromResolutionValue`. Three new native tests (dimension parsing incl. the × separator, tier selectors, width-filter selectors) and updated downloadFlow tests cover the split.

## 2026-08-25
### Decision: strict sequential download form with a pure state machine
The download setup UI is now a strict sequence — URL (Analyze enabled only for valid http/https URLs) → analysis loading → media preview card (thumbnail/title/author/duration/source) → Media Type → Format → Quality → Video-only Resolution → Add. All gating lives in the pure `downloadFlow.ts` module (`isAnalyzableUrl`, `formatOptionsFor`, `qualityOptionsFor`, `isResolutionVisible`, `canAddToQueue`, `findExistingDownload`); the JSX renders controls disabled until their prerequisite is met, and Add is enabled by `canAddToQueue` logic rather than visual state alone. The analyzed-media list remains as the selection library; selecting an entry drives the preview and configuration.

### Reason
- The previous UI exposed format/quality/resolution before any analysis and allowed invalid intermediate combinations.
- The spec requires an explicit state machine, source-driven resolutions (granular, nothing invented, no device names), and Quality as a state separate from Resolution (Video = Best; Audio = analyzed bitrates).

### Alternatives considered
- Visual-only disabling: rejected, the spec demands derived-state logic.
- Removing the analyzed-media list: rejected, it is working functionality; the strict flow now applies to the configuration path while the list remains the selection library.

### Consequence
Cart items carry a separate `quality` field forwarded to the native request. SSR tests assert the disabled attributes before analysis. The Analyze button is enabled only for valid URLs, and analyzing a URL already in the list selects the existing analysis instead of re-analyzing.

## 2026-08-25
### Decision: history is reconciled against real file existence on every read
`get_download_history` now runs `partition_history_by_existing_files`: completed entries whose `output_path` no longer points to an existing file (or is absent) are removed from the returned list AND rewritten out of the AppData history file. Failed/cancelled entries are always kept. No code path deletes user files — cleanup only removes stale records. The History panel gained a Refresh button that re-reads (and therefore re-syncs).

### Reason
- Manually deleting a downloaded file in Windows Explorer left ghost "Completed" entries in the app.
- Reconciling on read covers startup, post-download refreshes, post-cancellation refreshes, and manual refresh with one mechanism; the history is capped at 50 entries so `is_file()` checks are negligible.
- Duplicate prevention reuses this guarantee: a completed history entry means the file exists, so "already downloaded" blocks are honest.

### Alternatives considered
- A filesystem watcher: rejected for now — interference risk with active downloads and no additional guarantee over sync-on-read (the next refresh/reopen always reflects reality).
- Displaying a "File missing" placeholder card: rejected, the requirement is absence, not a placeholder.
- Guessing renamed/moved files: rejected; a moved file makes the original entry unavailable until the user re-downloads.

### Consequence
Seven deterministic native tests cover retention, removal, selective mixed removal, no-file-deletion, unicode/space paths, missing-path completed entries, and idempotency. Duplicate detection (`findExistingDownload`) blocks same video+mediaType+format+(video resolution) targets that are added/queued/downloading/paused in the cart or completed-with-file in history, reporting the existing status; a different format or resolution legitimately allows re-downloading.

## 2026-08-25
### Decision: machine-readable progress via `--progress-template` + `--no-quiet`
Native downloads now pass yt-dlp `--progress-template "download:KWLPROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s %(progress.filename)s"` and `--no-quiet`. Percent is computed in Rust from downloaded/total (estimate fallback), clamped to 100. The legacy terminal-format scraper remains as a fallback parser.

### Reason
- The UI showed `0% · --/s · ETA --` during real downloads. Root cause: `--print` implies yt-dlp `--quiet`, which suppresses ALL progress output; the stderr scraper therefore never saw a single progress line. Verified by capturing yt-dlp stdout/stderr with and without `--no-quiet`.
- Template output is stable and machine-readable instead of scraping human-oriented formatting.

### Alternatives considered
- Scraping `--newline` terminal lines only: rejected, brittle and it was silently producing nothing under `--quiet`.
- Frontend progress estimation/timers: rejected, fabricates progress.

### Consequence
Progress lines are parsed deterministically (unit tests cover bytes, estimate fallback, missing totals, malformed values, clamping). The UI renders `68% · 4.82 MiB/s · 124.5 MB / 183.2 MB · ETA 00:19` and omits missing pieces instead of showing `--` placeholders when data is unavailable.

## 2026-08-25
### Decision: true pause/resume via NtSuspendProcess/NtResumeProcess on the process tree
Pause and resume are native commands (`pause_download`, `resume_download`) that suspend/resume the yt-dlp process tree — the root PID plus all descendants found through a Toolhelp32 snapshot — using `NtSuspendProcess`/`NtResumeProcess` declared via direct FFI (no new crates). The job keeps its ID, progress, downloaded bytes, temp workspace, and history silence while paused; the reader threads simply block on the frozen pipes and continue on resume. yt-dlp's default `.part` continuation finishes the download without restarting.

### Reason
- The old ring button cancelled the job; users expect pause to freeze and resume to continue the same download.
- The `py` launcher (used to run yt-dlp on this machine) spawns python.exe as a child, so suspending only the root PID would not stop the actual downloader — tree suspension is required.
- Kill-and-restart pause was rejected: it cannot guarantee byte-identical continuation semantics without relying on server range support for every case.

### Alternatives considered
- Frontend-only "pause" label over a cancel: rejected as fake.
- SuspendProcess by PID without children: rejected after confirming the py→python child relationship.
- windows-sys crate: rejected for now to avoid a new dependency download in this environment; direct FFI against ntdll/kernel32 keeps the build hermetic.

### Consequence
New `paused` job status flows through the same polling bridge; the UI shows a Pause ring while downloading and an amber Resume ring while paused; X remains the separate cancel (taskkill /T /F + temp cleanup + history). A real-download lifecycle test (ignored in CI, run manually) proves percent freezes while paused, resume continues the same job, ffprobe validates the output, and exactly one history entry is written.

## 2026-08-25
### Decision: analyzed media list with container-aware native downloads
The media panel now keeps an analyzed-media list instead of a single analysis slot. Each analysis becomes a selectable card with a mark toggle and remove icon; Add enqueues every marked card with the current media type/format/resolution. Native downloads now translate the requested container and resolution into yt-dlp flags instead of ignoring them.

### Reason
- The user wants to analyze multiple links, mark several, and batch-add them with one format/resolution choice.
- Previously the selected resolution was never passed to yt-dlp and non-mp4 containers silently fell back to best-quality defaults.
- Common video containers (MP4, WEBM, MKV, AVI, MOV, FLV, analyzed 3GP) and audio targets (MP3, M4A, OPUS, WAV) map to real yt-dlp/FFmpeg capabilities: ext-filtered selectors, `--merge-output-format`, `--remux-video`, and `--audio-format`.

### Alternatives considered
- Keeping the single-analysis panel: rejected because it blocks multi-source workflows.
- Re-encoding video to arbitrary containers: rejected; remux is lossless and fast, while transcoding video would be slow and quality-losing.
- Always offering 3GP: rejected because modern YouTube sources often omit 3gp formats; it appears only when analysis reports it.

### Consequence
Resolution selections are now honest (height-filtered selectors). Analysis failures no longer wipe previously analyzed cards. The static preview card was removed from the selection panel, and dead single-job CSS was cleaned up.

## 2026-08-25
### Decision: cart-based sequential download queue in the UI
The download flow now uses an explicit cart: the user configures media type, format, and resolution, clicks Add, and the item waits in a Download queue panel with icon-only per-state actions. A runner effect starts queued items one at a time and auto-starts the next item when a job reaches a terminal state.

### Reason
- The user requested an Add-to-cart workflow instead of a single direct Download button.
- Sequential execution keeps bandwidth predictable and matches the single tracked-process model without registry changes.
- Icon-only state actions (start, ring cancel, play, folder, delete, retry, remove) keep rows compact and language-neutral.

### Alternatives considered
- Parallel cart downloads: rejected for now because simultaneous yt-dlp/FFmpeg processes complicate progress and cancellation; the native registry already supports unique jobs if revisited.
- Real pause/resume: deferred; the ring button cancels on click. Resume would require keeping `.part` output and restarting jobs natively.
- Persisted cart: rejected; the cart is session-only and completed items remain in persisted history.

### Consequence
Entitlement and duplicate checks moved to Add time. History deletion is entry-only via the new `delete_download_history` command; media files stay on disk. The old single-job UI states (`activeJobId`, `jobProgress`, `progress`, `downloadState`) were replaced by per-item cart state.

## 2026-08-25
### Decision: preserve the locked Tauri 2 + React + TypeScript + Rust architecture
The repository already contains a verified runtime and downloader boundary. The current UI work continues from that foundation and does not redesign the app around alternate frameworks or direct shell execution.

### Rationale
- The project explicitly defines Tauri, React, TypeScript, Vite, Rust, and the runtime manager/downloader layers as locked architecture.
- The runtime verification already proved the underlying pipeline works on the current Windows machine.
- The UI phase must improve usability without changing the foundation or bypassing the secure native boundary.

### Impact
- Frontend logic remains UI-only and should consume typed bridge methods.
- Future media analysis and download requests must remain routed through the Tauri/native layer.
- The project stays aligned with the master specification and handoff requirements.

## 2026-08-25
### Decision: dynamic resolution and quality selection based on analysis results
The UI will present resolution options from analyzed media rather than hard-coded static values, and will hide resolution controls when audio is selected.

### Rationale
- The specification explicitly requires dynamic real selection derived from available formats.
- This supports a professional downloader experience while avoiding meaningless options for audio media.

### Impact
- Video and audio flows remain separate and react to actual source media data.
- The UI remains forward-compatible for formats beyond the initial defaults.

## 2026-08-25
### Decision: native asynchronous jobs with typed status polling
Download processes are owned by Rust and tracked in a native job registry. React receives a job ID through the typed bridge and polls `get_download_job`; it never observes or controls a process directly.

### Reason
- A synchronous command cannot provide responsive UI state or cancellation.
- Process ownership must remain in the native security boundary.
- Polling is available through the existing Tauri command contract and is deterministic to test.

### Alternatives considered
- Frontend timers: rejected because they fabricate progress.
- Frontend shell execution: rejected because it violates the locked architecture.
- Web-only downloader: rejected because it bypasses yt-dlp, FFmpeg, and ffprobe native orchestration.

### Consequence
The current native job slice reports real lifecycle state and supports process cancellation. Progress parsing, ffprobe validation, temporary cleanup, and persistent history remain required before the Phase 3 gate can pass.

## 2026-08-25
### Decision: validate final outputs before completion
Native jobs transition to `validating` after yt-dlp exits successfully and are marked `completed` only when ffprobe confirms a readable stream and positive duration.

### Reason
- A successful child-process exit alone does not prove a usable media file exists.
- The product contract requires output validation before completion.
- Keeping validation native avoids loading media files into JavaScript.

### Alternatives considered
- Trusting yt-dlp exit status: rejected because partial or malformed output could be reported as complete.
- Validating in React: rejected because filesystem and process access belong in Rust.

### Consequence
Missing, malformed, or zero-duration output is reported as a failed job. The remaining lifecycle work is persistent history, temporary cleanup, entitlement enforcement, and runtime acceptance testing.

## 2026-08-25
### Decision: exclude native build artifacts from Vite watching
The desktop Vite server ignores `apps/desktop/src-tauri/**` during development so Windows file locking on the compiled executable cannot crash the frontend watcher.

### Reason
- Tauri owns native rebuild watching through Cargo.
- Vite does not need to watch Rust target artifacts.
- The previous launch failed with `EBUSY` while watching `kwl_video_downloader.exe`.

### Consequence
The Tauri dev launch now starts the native executable and serves the frontend successfully. Full GUI workflow acceptance remains a separate validation gate.

## 2026-08-25
### Decision: detect Tauri before invoking native commands
The typed bridge checks for Tauri runtime internals before calling `invoke`; plain browser development uses the existing safe fallback responses instead of surfacing native bridge errors.

### Reason
- The React UI is also served by Vite for development and browser-based UI checks.
- Tauri's API module can exist in a browser bundle without a native command runtime.
- Native production behavior remains routed through Tauri commands.

### Consequence
Valid browser-mode analysis reaches the media-ready state, invalid URLs show a clean validation message, and no raw `invoke` errors leak into the UI.

## 2026-08-25
### Decision: use an atomic sequence for native job IDs
Native job IDs combine the current timestamp with an atomic process-local sequence.

### Reason
- Timestamp-only IDs can collide when multiple jobs start in the same millisecond.
- Concurrent jobs must have independent status and temporary workspaces.
- The sequence adds uniqueness without introducing another runtime dependency.

### Consequence
The native job registry can safely distinguish concurrent starts; the guarantee is covered by a deterministic test.

## 2026-08-25
### Decision: validate native file actions against downloader-owned outputs
Open-file and Explorer actions accept only existing canonical files recorded in persisted download history or located beneath an output directory held by an active native job. The frontend sends a path through typed Tauri commands but never executes a shell or file process directly.

### Rationale
- File actions must not become arbitrary process-launch primitives.
- Canonical path comparison prevents path traversal and alias-based bypasses.
- Keeping validation in Rust preserves the existing security boundary.

### Consequence
History action failures are surfaced to the UI, while non-Tauri browser mode rejects file actions as unavailable instead of creating a production mock.

## 2026-08-26
### Decision: professional monotonic progress (byte-weighted, phase floors, honest unknown-total, pause frozen)
Native `ProgressAggregator` tracks per-filename downloaded/total (keyed by yt-dlp `--progress-template` filename) and aggregates byte-weighted `combinedDownloaded/combinedTotal*100` clamped, monotonic via `peak_percent` (never backward even when yt-dlp starts a new stream at 0%). If any stream lacks total, percent is `None` → UI indeterminate + bytes-only (`824 MB downloaded`) with no fabricated percent. Speed/ETA are real `progress.speed/eta` or hidden (cleared to None when unavailable, never stale). Status floors: `processing/merging=92`, `converting=92` (3GP ffmpeg), `validating=98`, `completed=100` via `peak_percent = max(peak, floor)` and `mark_job_*` helpers so merge/convert/validate never reset. Frontend `applyJobToCartItem` enforces second monotonic guard (`max(item.percent, job.percent)` + phase floor) and monotonic bytes, and hides speed/ETA when backend omits them; `QueueView` builds honest status line `68% • 18.4 MB/s • 824 MB / 1.21 GB • ETA 00:19` omitting missing parts, shows `Merging.../Converting to 3GP.../Validating...` with indeterminate shimmer, `Paused 68% • 824 MB / 1.21 GB`, and determinate bar only when total known.

### Reason
- yt-dlp streams video/audio separately and each restarts at 0% → raw UI bounced 80→50→100→0→70 and merge reset to 0 while download succeeded correctly.
- Direct `UI% = latest yt-dlp %` exposes every stream phase as overall progress; timers or averaging would fake progress/ETA.

### Consequence
- Deterministic tests: single-stream monotonic, byte-weighted video+audio (both low → 10%, mixed grows), late-discovered second stream retains peak (80→45 raw stays 80), unknown-total None, merging/validating floors never backward, converting floor hides speed/ETA, completed exactly 100, paused/resumed keeps peak.

## 2026-08-26
### Decision: horizontal step-by-step configuration wizard (MEDIA→TYPE→FORMAT→QUALITY→RESOLUTION→OUTPUT / Audio skips Resolution)
Single source wizard state `wizardStep: WizardStepId` + `wizardSteps = getStepsForMedia(mediaType)` (VIDEO 6 steps, AUDIO 5) + pure `downloadFlow` helpers `getWizardStepStatus/nextWizardStep/prevWizardStep/isWizardStepCompleted`. `Configuration` shows step chain (blue completed + check, strong current, dimmed future + connectors, blue connector when prior steps completed) and renders ONLY current step's controls inside a card. `MEDIA` is first (no Back), `TYPE`→`FORMAT`→`QUALITY`→`RESOLUTION`→`OUTPUT` advance automatically on pick (or via Next →, disabled until step completed), Back works to prior steps and downstream selections reset on change, completed steps clickable to go back, future locked, Trash icon in AnalyzedMediaList clears selection, no large Remove block, no FPS anywhere.

### Reason
- Vertically expanding TYPE→FORMAT→QUALITY→RESOLUTION forced repeated scrolling and duplicated Quality vs Resolution; users had to scroll past completed sections and future steps looked enabled.

### Consequence
- Desktop is primary target, wizard stays compact (single current step visible), responsive horizontal scroll for narrow windows, subtle transitions, preserves dark KWL visual language.

## 2026-08-27
### Decision: refactor video quality flow — merge exact dimensions into Quality step, remove separate Resolution and FPS steps
The Video configuration flow changed from:
Media → Type → Format → Quality → Resolution → FPS → Add
To:
Media → Type → Format → Quality (+ exact dimension inline) → Add

Audio flow unchanged: Media → Type → Format → Quality → Add (no dimension, no FPS).

**Quality step now contains:**
- Quality tier labels derived strictly from analyzed source (e.g., 1080p, 720p, 576p)
- Exact source dimensions grouped under each tier (e.g., 1080p → [1920×1080], [2560×1080])
- Single-dimension tiers auto-resolve dimension on quality pick
- Multi-dimension tiers show dimension buttons for user selection

**Removed from user-facing flow:**
- Separate Resolution wizard step
- FPS wizard step and all FPS selection UI/state
- FPS prerequisite for Add

**Backend preserved:**
- Native request still receives exact selected dimension for yt-dlp selector
- 3GP transcode receives correct source dimension
- Duplicate guard matches by quality + exact dimension
- Height-normalized legacy history matching preserved

### Reason
- Vertically expanding TYPE→FORMAT→QUALITY→RESOLUTION→FPS forced repeated scrolling; Quality and Resolution were conceptually duplicated
- FPS selection was rarely meaningful to users; source-strict yt-dlp selector handles optimal format choice
- Single-dimension tiers required unnecessary second click
- Quality tier + exact dimension is a single logical choice in the user's mental model

### Consequence
- Wizard steps: Video 5 (MEDIA,TYPE,FORMAT,QUALITY,OUTPUT), Audio 5 (same, no dimension)
- `downloadFlow.ts`: new `QualityTier` type with grouped dimensions, `qualityTiersWithDimensions()`, updated `canAddToQueue` with dimension check, `findExistingDownload` handles legacy tier-only history
- Tests updated: 51 vitest, 48 cargo all pass
- All existing functionality preserved (progress, pause/resume, history, queue, 3GP transcode, ffprobe validation)

## 2026-08-27
### Decision: deterministic progress bar — fix total_bytes stale and honest indeterminate
- **Fix**: `lib.rs` 4× `tot.or(old)` → `if Some(v)=tot { current=Some(v) }` so `combined_total` increases when audio stream discovered (240M→243M). `App.tsx` `job.total_bytes ?? old` (not `!==undefined` overwrite with null). `QueueView` percent before speed with `downloaded/total` fallback, `hasTotal` determinate vs `!hasTotal` indeterminate shimmer (`index.css @keyframes shimmer` added, 500ms transition).
- **Reason**: Bar static because second stream total never updated; shimmer missing keyframes; speed/bytes lived but percent not.
- **Consequence**: Large download now 0→98.6→100 real, merge/convert not reset, 55 cargo + 51 vitest PASS, real KWLPROG verified.

## 2026-08-27
### Decision: wizard initial select + position-aware chain
- `mediaTypeChosen:true` initially Video, auto first Format/Quality/dimension after analysis via `formatOptionsFor`/`qualityTiersWithDimensions`. Config chain shows completed only for `targetIdx < curIdx` (not auto-full), `canProceed` uses data-completed. Add Queue clears `url`+`analyses`+wizard reset, already-download toast `success` 3800ms with close btn, Go to Queue `goToQueueDismissed` hides after click until next add.
- **Reason**: User requested first item always selected initially but chain only up to current step complete, clear input after queue.

## 2026-08-27
### Decision: managed external tool system (yt-dlp/FFmpeg/ffprobe)
- **Structure**: `AppData/KWL Video Downloader/tools/{yt-dlp,ffmpeg,ffprobe}/{current,previous,staging}/` + `manifest.json` (version, executable, platform, arch, checksum, installed_at, status). `src/tools.rs` 560 lines.
- **Health**: `Command --version/-version` success + non-empty stdout, `startup_health_check` fast local, `background_update_check` non-blocking, offline-safe (keep verified current).
- **Update**: Safe staged `stage→health→backup current→previous (rename)→activate→health→rollback`, never delete current first, preserve previous, file-lock handling via `rename` error → abort, `has_active_download_jobs()` defers update.
- **Integration**: `resolve_*` prefers `tools/current/<exe>` before PATH fallback (`python -m yt_dlp`), `transcode` uses managed ffmpeg, 3 Tauri commands + `tauriBridge` + `App.tsx` startup toast.
- **Tests**: 7 deterministic (`manifest`, `missing`, `invalid exe`, `version`, `staged rollback`, `structure`, `offline`) with `KWL_TOOLS_DIR` isolation.

`apps/desktop` now styles the UI with Tailwind utility classes inline in `App.tsx` instead of a hand-written `styles.css`. The old stylesheet was deleted; `src/index.css` keeps only Tailwind directives plus a small `@layer base` (dark gradient background, font smoothing, cursor rules) preserving the locked visual design.

### Rationale
- Single source of styling colocated with components; easier iterative UI review.
- Utility-only approach avoids a second class-naming layer while keeping the identical design tokens (colors, radii, gradients, breakpoints).

### Consequence
- `tailwindcss@3`, `postcss`, `autoprefixer` are devDependencies; `tailwind.config.js` + `postcss.config.js` must stay next to `vite.config.ts`.
- Tests never depended on CSS class names, so CI stays deterministic; build output now includes a generated Tailwind CSS bundle (~18 kB, 4.6 kB gzip).

## 2026-08-28
### Decision: v1.0.0 is a fully free, offline, no-account downloader — Nexus/auth removed entirely, multi-platform packaging + Android tool-bundling via CI
The product-level decision supersedes the earlier placeholder offer: v1.0.0 ships with **no account, no plan, no license, no Nexus of any kind** (KWL Nexus is deferred to v2.0.0). All Nexus-related source is deleted (`src/nexus.rs`, `NexusComingSoon`, `NexusLoginButton`, `NexusPlanBadge`, `NexusProfile`, `AccountSection`, `useNexusAuth/useNexusPlan/useNexusPlaceholder`); `main.tsx` runs without `NexusAuthProvider`; `App.tsx` has no account view; `SettingsView.tsx` keeps only General + Advanced + Updates; account/login/signup/logout translation keys removed. Versions unified at 1.0.0 everywhere. Release packaging targets all platforms from one validated `tauri.conf.json`: Windows NSIS (currentUser, en) + WiX MSI (en-US), macOS DMG, Linux DEB + AppImage, Android APK (`minSdkVersion 24`), publisher "KWL". Full icon set generated via `npx tauri icon`.

**Android tool strategy**: real binaries (Android yt-dlp build + ffmpeg/ffprobe) are NOT committed and NOT downloaded at build time (AGENTS.md deterministic-CI rule). Instead: a documented, per-release staging folder `src-tauri/android/app/src/main/assets/native_tools/` holds them; the Android host extracts + chmods them at runtime; Rust resolves through `bundled_native_tools_dir`/`install_bundled_native_tool`/`resolve_bundled_tool` under `app_data_dir/native_tools` before PATH fallback (all cross-platform code, host-tested). Android manifest permissions (INTERNET, READ/WRITE_EXTERNAL_STORAGE) are applied post-`tauri android init`.

**CI + release**: `.github/workflows/build.yml` — `validate` (npm test + npm run check) → `windows` (nsis msi) / `linux` (deb appimage) / `macos` (dmg) / `android` (JDK 17 + setup-android + rust targets + init + deterministic asset check + apk) → GitHub draft release on `v*` tags + workflow_dispatch.

### Reason
- v1.0.0 is a free/offline product; auth/OAuth/licensing must not ship, and shipping placeholder auth UI could be mistaken for a paid gate.
- Releasing a desktop app needs real installers for every platform; config schema facts were verified against the Tauri CLI (`bundle.windows` has `nsis`+`wix`, no `msi`; no `bundle.displayName`); `tauri android init` validates the whole config on any machine.
- Android-only Rust cannot be compiled/verified on the Windows dev host (`cfg(target_os="android")` is skipped by `cargo check`), so Android surface is kept to config + documented host flow; all tool resolution logic is cross-platform and tested.

### Consequence
- Grep-proof removal (zero auth/Nexus refs in `apps/desktop/src`); all gates green locally: tsc, 58/58 vitest, vite build, `cargo check`, `cargo test` 60/60 + 3 ignored (2 new bundled-tool tests), `npx tauri icon`, config schema validation.
- Remaining work is human/CI: (a) Java + Android SDK machine or the Android CI job to `tauri android init` → add manifest permissions → stage real binaries → `android build --apk`; (b) `git init` + remote → tag `v1.0.0` → push → workflow publishes installers + draft release.
- Secrets hygiene: `.env.bak` (real Google OAuth credentials) deleted; `.gitignore` hardened.

## 2026-08-28
### Decision: remove all local auth (Google OAuth / MongoDB / email-password) and ship a KWL Nexus Phase 1 placeholder skeleton
**[SUPERSEDED same day by the v1.0.0 decision above — the skeleton was removed; v2.0.0 will reintroduce Nexus properly.]**
Local account/plan/license code is deleted (`auth.rs`, `db.rs`, `AuthContext.tsx`, `AuthModal`, `LoginModal`, `SocialLoginButtons`, `AccountView`, `useAuth`). All Nexus-dependent features now render friendly "Coming soon" placeholders with toasts via `useNexusPlaceholder` + `NexusComingSoon`; `nexus.rs` keeps 8 typed skeleton commands (mock impls, `NEXUS_API_URL` env fallback, `uuid` tokens) registered behind the Tauri invoke layer. Auth-only deps were removed (Cargo.toml google-auth/deep-link/bcrypt/jwt/mongodb/rusqlite/rand; capabilities google-auth perms; tauri.conf deep-link block; desktop package.json `@choochmeque/tauri-plugin-google-auth-api`). `.env`/`.env.example` now carry only tool paths plus commented `NEXUS_API_URL`/`NEXUS_OAUTH_REDIRECT`.

### Reason
- Users saw confusing errors (".env file not found", "Google OAuth not configured") and the app could break when OAuth/MongoDB were unavailable.
- KWL Nexus is the designated centralized account/plan/license system; the spec mandates Phase 1 placeholders first so the app never throws auth errors.

### Consequence
- `/account` view and the Settings account panel render Nexus coming-soon placeholders; login/logout/sign-in/plan/license actions show purple toasts only, never API/`.env` errors.
- Phase 2 start point is `nexus.rs` `// TODO: Replace with real Nexus API calls` (real endpoints `NEXUS_API_URL`, OAuth redirect, token persistence via `tauri-plugin-store`).
- Verified: `cargo check` (2 pre-existing unrelated dead-code warnings), `npm run check` clean, `npm test` 58/58, `npm run build --workspace @kwl/desktop` clean.
