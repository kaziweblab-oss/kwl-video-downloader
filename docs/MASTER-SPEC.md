# KWL Video Downloader Master Specification

## Locked architecture

Tauri 2, React, TypeScript, Vite, Rust, DownloaderCore, RuntimeManager, SafeNativeExecutor, yt-dlp, FFmpeg, and ffprobe. The frontend never executes shell commands; all runtime work stays behind typed Tauri commands.

## Product workflow

Validate a supported HTTP(S) URL, analyze it with yt-dlp, map safe structured metadata and available formats to the UI, select video or audio options, choose an output directory through native APIs, start a tracked native job, report real progress, process when required, validate the final output with ffprobe, and persist history only after completion.

## Required UI behavior

Video exposes only actually available containers, resolutions, dimensions, and quality choices. Audio exposes audio format and quality and hides all resolution and video controls. Errors are concise user-facing messages and never raw command output or stack traces.

## Security and release constraints

No shell interpolation, arbitrary executable paths, frontend secrets, direct database access, or unverified update packages. Runtime binaries must be bundled for production Windows releases. Installer, CI release artifacts, licensing, KWL Nexus, updates, and signing must be implemented and verified separately; unverified or unavailable gates must be reported as BLOCKED or NOT RUN.

## Acceptance evidence

Ordinary CI uses deterministic tests and must not depend on third-party websites. Real downloader, native compilation, clean-machine installer, release, license backend, Nexus, and update claims require fresh executable verification.
