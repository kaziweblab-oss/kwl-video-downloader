# Roadmap

## Phase 0: Repository audit and bootstrap

- Inspect repository state
- Establish clean monorepo layout
- Add docs and baseline CI
- Prepare for Tauri 2 and native process isolation

## Phase 1: Production architecture and desktop bootstrap

- Initialize Tauri 2 desktop shell
- Define shared domain models
- Plan runtime bundling and binary resolution

## Phase 2: Downloader core migration

- Reuse or rebuild core downloader abstractions
- Add typed request/response models
- Add validation and status tracking

## Phase 3: Professional UI

- URL analysis screen
- Download options
- Progress and history panels

## Phase 4: Windows bundled runtime

- Bundle yt-dlp, FFmpeg, ffprobe
- Resolve binaries from bundled paths only

## Phase 5: Windows installer

- Build installer for Windows x64
- Generate setup artifact for end users

## Phase 6: CI validation

- Lint, typecheck, and build validation
- Release gating before tag-based publishing

## Phase 7: GitHub release automation

- Publish packaged Windows releases
- Generate checksums and metadata

## Phase 8: License infrastructure

- Provide future server-backed license flow
- Enforce entitlement checks centrally

## Phase 9: KWL Nexus integration

- Keep desktop app decoupled from Nexus APIs through clients
- Authenticated release sync

## Phase 10: Auto-update

- Signed update verification
- Install and restart flow

## Phase 11: Production hardening

- Code signing
- Security review
- Process isolation and crash handling

## Phase 12: Linux and macOS

- Expand runtime packaging for additional platforms

## Phase 13: Android

- Platform-specific expansion after desktop stabilization
