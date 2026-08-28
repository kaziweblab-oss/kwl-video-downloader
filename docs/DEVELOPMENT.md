# Development Guide

## Stack

- React
- TypeScript
- Vite
- Tauri 2
- Rust

## Current local workflow

```bash
npm install
npm run dev --workspace @kwl/desktop
```

## Validation status

The JavaScript checks and desktop frontend build currently pass. Native compilation is BLOCKED on the current Windows machine because Cargo/Rust is not installed or available on PATH.

The intended validation sequence is:

```bash
npm install
npm run check
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Current native boundary

The native analysis command invokes yt-dlp and maps safe metadata for the UI. Native download tracking, FFmpeg/ffprobe completion validation, persistent history, runtime bundling, licensing, and update checking remain future work recorded in `docs/PROJECT-STATE.md`.

## Guidance

- Keep the frontend free from shell execution.
- Keep all process spawning in Tauri/Rust commands.
- Prefer small typed domain objects and strict TypeScript usage.
- Maintain a clear boundary between UI logic and native execution.
- Treat registry/network failures as a valid environment limitation, not as a successful validation result.
