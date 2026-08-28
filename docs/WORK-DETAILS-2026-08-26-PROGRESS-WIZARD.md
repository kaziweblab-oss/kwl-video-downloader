# Work Details — Professional Monotonic Progress + Horizontal Wizard (2026-08-26)

## Summary
Implemented the HIGH priority Task: Professional/Monotonic Download Progress + Horizontal Configuration Wizard without redesigning the KWL dark theme. All Phase 3 functionality preserved.

## 1. Progress Aggregation Architecture

### Rust `ProgressAggregator` (`apps/desktop/src-tauri/src/lib.rs:106-240`)
- **Per-file tracking:** `HashMap<String, FileProgressState>` keyed by yt-dlp `--progress-template` `filename` (`KWLPROG ... filename`). One entry per stream (video.mp4.part, audio.m4a.part, etc.).
- **Byte-weighted:** `combinedDownloaded = Σ downloaded`, `combinedTotal = Σ total` (if any `total == None` → `combinedTotal = None` → `percent = None` → UI indeterminate, no fabricated %). `percent = min(100, combinedDownloaded/combinedTotal*100)`.
- **Monotonic:** `peak_percent`/`peak_downloaded` store max seen. `ingest()` returns `max(peak, raw)` so 80% → 50% (new audio at 0% raw 45%) stays 80%. Handles video+audio separate streams restarting at 0% without resetting UI.
- **Unknown total:** First ingest with `total=None` returns `percent=None`, `downloaded=peak`, `total=None`. Later ingest with `total=Some` transitions to real percent. Tested `unknown_total_size_does_not_fabricate_percent`.
- **Speed/ETA honest:** `latest_speed = speed` (incoming only), `latest_eta = eta`. Cleared to `None` when backend omits → frontend hides (`null` not stale `--`). No timer fabrication.
- **Phase floors:** `phase_min_percent(status)` → processing/merging 92, converting 92, validating 98, completed 100. `apply_phase_floor()` does `peak = max(peak, floor)`. `mark_job_converting/validating/completed/processing` apply floor and hide speed/eta. Frontend second guard `max(item.percent, job.percent, floor)`.

### Threads
- `stderr` and `stdout` readers both call `aggregator.ingest()` inside `update_job()` mutex. `processing` detection (`[Merger]/[ExtractAudio]`) sets `status=processing` + floor 92 + hide speed/eta. `converting` via `transcode_to_3gp_file` + `mark_job_converting`, `validating` via `mark_job_validating`, `completed` via `mark_job_completed` (100).

### Frontend Guard (`apps/desktop/src/ui/App.tsx:76-89`)
- `applyJobToCartItem` → `monotonicPercent = max(item.percent, rawPercent)` → `final = max(monotonic, phaseFloor)` → `peak_downloaded = max(prev, next)`. Hides stale speed/eta (`job.speed_bytes_per_second !== undefined ? job.speed : null`).

### Queue UI (`apps/desktop/src/ui/views/QueueView.tsx:42-95`)
- `formatBytes/speed/eta` return `null` when unavailable (no `--`). `buildStatusLine()` omits missing parts with `•` separator: `Downloading: 68% • 18.4 MB/s • 824 MB / 1.21 GB • ETA 00:19`, `Paused 68% • 824 MB / 1.21 GB`, `Merging video and audio...`/`Converting to 3GP...`/`Validating file...` indeterminate shimmer, `Completed`, `Failed · error`. Determinate bar only when `total != null`, otherwise indeterminate animation.

## 2. Phase Handling
```
queued (0%) → downloading (0-100% byte-weighted, capped monotonic) → processing/merging (92) → converting (92, 3GP ffmpeg) → validating (98, ffprobe) → completed (100)
↘ paused (freeze peak/bytes/speed snapshot, amber) → resumed → same peak
↘ failed/cancelled (terminal)
```
- Download → merge → validate → complete example: 78% → 92% → 98% → 100% (never backward; 95% prior to merge stays 95).
- 3GP: `downloading → converting → validating → completed` (92 → 98 → 100, no reset).
- All phases use real events (yt-dlp template lines or ffmpeg exit), never fake timers.

## 3. Wizard State Machine

### Pure Module `downloadFlow.ts`
- `WizardStepId = 'media'|'type'|'format'|'quality'|'resolution'|'output'`
- `getStepsForMedia('Video') = [media,type,format,quality,resolution,output]` (6), `Audio` = 5 (skips resolution)
- `isWizardStepCompleted`, `canProceedFromStep`, `getWizardStepStatus(completed/current/locked)`, `nextWizardStep`, `prevWizardStep`, `aggregateProgress` (frontend helper), `phaseFloor`, `WIZARD_PHASE_FLOOR`
- No FPS anywhere (`fps` omitted from `FlowSelection` and UI).

### React (`App.tsx:170-310`)
- `wizardStep: WizardStepId` (`media` init) + `wizardSteps = getStepsForMedia(mediaType)` memo + `canProceedCurrent` (media→selectedIds, type→mediaTypeChosen, format→formatChosen, quality→qualityChosen, resolution→resolutionChosen, output→trim+canAdd)
- `handleWizardNext/Back`, `handleStepClick` (only `targetIdx < curIdx` completed clickable), auto-advance on `handleMediaTypePick/handleFormatPick/handleQualityPick/handleResolutionPick` (`setTimeout` to next), `resetDependentSelections` clears downstream + `useEffect` keeps step valid when `mediaType` toggles (Audio removes resolution), `handleRemoveAnalysis/Selection` resets to `media`.

### Configuration (`Configuration.tsx`)
- Step chain: flex overflow-x-auto, each step button with `✓` (completed), `•` (current), `1..` (locked), blue `bg-sky-500/15 border-sky-400` for completed, `bg-sky-500/20 border-sky-300 shadow` for current, `bg-slate-800/50 opacity-60` for locked, connectors `bg-sky-500/50` when prior steps completed else `bg-slate-700`.
- Single-current-step card (`min-h-[140px]`) renders only `wizardStep` controls (media info, type VIDEO/AUDIO, format grid, quality grid, resolution tiers+dimensions inline (no modal), output input+browse).
- Navigation: `[← Back]` (hidden on media) + `[Next →]` (disabled until `canProceedCurrent`) or `[Add to Queue +]` on last step (disabled until `canAdd`).
- Dark navy/rounded/border preserved, subtle transition `scale-[1.02]`.

### AnalyzedMediaList
- Card click & checkbox toggle identical `selectedMediaIds` source. Multi-select with `2 selected` + compact Trash icon (red border) clears via `handleRemoveSelection` (compact, not large text block).

## 4. Tests
- **Cargo** 48 pass +1 ignored (`real_download_pause_resume_lifecycle`): byte-weighted, single-stream monotonic, merging/validating floors, paused keeps peak, completed 100, no fake speed/eta, unknown-total, plus existing sync/validation suite. 8 new tests for aggregator.
- **Vitest** 51 pass: `desktop-ui` (wizard MEDIA chain, Next disabled, step labels, Audio skips Resolution, single-step format, no FPS) + `download-flow` (url gating, sequential gating, quality tiers, height parsing, add gating, duplicate guard, wizard steps/next/prev/status/future locked/no FPS, aggregateProgress monotonic/byte-weighted/unknown-total null, phaseFloor monotonic) + `shared-domain`/`downloader-core`.
- **SSR** no invented buttons pre-analysis (`disabled=""` anchored, not `disabled:` class).

## 5. Runtime Evidence
- `cargo check` PASS (warning: unused `speed/eta` fields intentional for map store, `mark_job_processing` reserved).
- `cargo test` 48 pass (0.36s).
- `npm run check` tsc clean.
- `npm test -- --run` 51/51 (2.12s).
- `npm run build --workspace @kwl/desktop` PASS: `assets/index-*.css 32.59 kB` (6.72 gzip), `index-*.js 236.09 kB` (69.54 gzip), `vite v5.4.21`.
- Tauri launch not re-executed in this session (previous PID 18772 validated); `tauri.conf.json` valid, Vite watcher excludes `src-tauri` artifacts (`EBUSY` fixed).

## 6. Remaining HUMAN_REQUIRED GUI Checks
- Launch `npx tauri dev` (HUMAN_REQUIRED: WebView not automatable). Walkthrough:
  1. Analyze valid URL → cards appear, palette dark consistent.
  2. Select cards (click card + checkbox same toggle), multi-select, Trash clears.
  3. Wizard: MEDIA (no Back, Next disabled until media) → Next → TYPE (Video/Audio, auto-advance to FORMAT on pick) → FORMAT (MP4/WEBM/3GP, auto to QUALITY) → QUALITY (tiers from source) → RESOLUTION (video only: tiers + dimensions with 176×144 QCIF, dimensions enforced `[width<=W]`) → OUTPUT (folder + Browse) → Add enabled (Audio skips Resolution). Back works and resets downstream; completed steps clickable; future locked; no FPS.
  4. Queue: sequential start (maxConcurrent 2), progress monotonic (watch video+audio stream no reset), bytes weighted, unknown-total indeterminate, speed/ETA only when real else hidden, merge 92 Shimmer → validating 98 → completed 100, pause freezes (amber 68% • bytes), resume same job continues, completed ffprobe validates.
  5. History file-synced (delete file → Refresh removes entry), retry, clear, restart persistence.

## 7. Files Touched
- `apps/desktop/src-tauri/src/lib.rs`: ProgressAggregator, JobState.aggregator, ingest/phase floors, thread ingest calls, mark_job_* helpers, 8 tests.
- `apps/desktop/src/ui/downloadFlow.ts`: Wizard helpers, aggregateProgress, phaseFloor.
- `apps/desktop/src/ui/App.tsx`: wizardStep state, monotonic applyJobToCartItem, auto-advance, navigation.
- `apps/desktop/src/ui/components/Configuration.tsx`: horizontal wizard rewrite.
- `apps/desktop/src/ui/components/DownloaderView.tsx`: wizard props pass-through.
- `apps/desktop/src/ui/views/QueueView.tsx`: honest status line + indeterminate + phase labels.
- `tests/desktop-ui.test.ts`, `tests/download-flow.test.ts`: wizard + progress coverage.
- `docs/PROJECT-STATE.md`, `docs/DECISION-LOG.md`, `docs/MEMORY.md`: state/decisions/memory.
- `docs/WORK-DETAILS-2026-08-26-PROGRESS-WIZARD.md` (this file).

## 8. Validation Report
| Gate | Result | Evidence |
|------|--------|----------|
| cargo check | PASS | warning only |
| cargo test | PASS | 48 pass, 1 ignored |
| npm run check | PASS | tsc clean |
| npm test -- --run | PASS | 51/51 |
| npm run build --workspace @kwl/desktop | PASS | CSS 32.59 kB |
| Tauri dev | HUMAN_REQUIRED | WebView not automatable; prior launch PID 18772 + Vite 200 retained |

## 9. Next
Run the HUMAN_REQUIRED `npx tauri dev` 12-step walk with real URLs (video MP4/WebM/3GP transcode + audio MP3), verify no backward progress and wizard auto-advance/Back. Do not start Phase 4 until gate passes.
