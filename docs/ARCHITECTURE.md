# Architecture

## Overview

This repository is a Windows-first desktop app built around a Tauri 2 shell, a typed React client, and a Rust native media boundary. The native analysis command invokes yt-dlp and maps its output into a safe application response; download lifecycle work remains in progress.

## Current target runtime flow

React UI
  -> TypeScript application layer
  -> Tauri bridge
  -> Rust native layer
  -> runtime abstraction
  -> yt-dlp / FFmpeg / ffprobe orchestration

## Design principles

- The UI must not execute shell commands directly.
- Native process execution remains in Tauri/Rust.
- Downloader behavior is represented through typed domain models.
- Runtime resolution is abstracted and prepared for bundled Windows binaries.
- Secrets and production credentials remain outside the desktop bundle.

## Monorepo structure

- apps/desktop: Tauri desktop shell and React UI
- packages/shared: shared domain types and validation utilities
- packages/downloader-core: downloader abstraction and job model
- packages/runtime: runtime manager abstraction and version metadata
- docs: architecture and operations documentation

## Core domains now present

### Shared domain

The shared package defines strict models for:

- VideoInfo
- MediaFormat
- MediaType
- DownloadRequest
- DownloadJob
- DownloadProgress
- DownloadError
- AppVersionInfo

This layer includes URL validation and request validation logic.

### Downloader abstraction

The downloader core exposes typed analysis, download, cancellation, and job interfaces. Native process execution is owned by the Rust boundary.

### Runtime abstraction

The runtime package defines a runtime manager contract and a Windows-first bundle path strategy. It enforces a no-PATH production direction and keeps platform-specific path logic isolated.

### Native boundary

The Rust side exposes Tauri commands for:

- `validate_url`
- `get_app_info`
- `analyze_url` using yt-dlp metadata
- `start_download`
- `get_download_job`
- `cancel_download`

These commands are the first safe bridge between the UI and native execution layer.

## Current repository state

The repository started from an empty state. Phase 0 created the foundation and Phase 1 now provides the clean architecture boundary for the actual downloader work in Phase 2.

## Risks and considerations

- Dependency installation is blocked in this environment by registry/DNS access issues.
- Build verification is therefore limited to static structure and architectural correctness, not completed package installation.
- The real downloader execution, runtime bundling, and signed update flow remain future work.
