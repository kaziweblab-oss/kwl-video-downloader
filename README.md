# KWL Video Downloader

**Version 1.0.0** - Free, offline, cross-platform video & audio downloader.

KWL Video Downloader lets you download video and audio from the web in minutes.
It is completely **free**, requires **no account, no login, and no license**, and
runs entirely on your device. Paste a link, pick a format, and download - real-time
progress, pause/resume, queue management, and history are all included.

## Features

- Paste a link and analyze any supported media URL
- Download video (MP4, WebM, MKV, AVI, MOV, FLV, 3GP) and audio (MP3, M4A, Opus, WAV)
- Real-time progress with speed and ETA
- Download queue with concurrent downloads (1-5)
- Pause, resume, and cancel downloads
- Automatic download history with missing-file reconciliation
- 3GP output with FFmpeg transcoding
- Built-in runtime tool management (yt-dlp / FFmpeg / ffprobe)
- In-app report center: report an error, a suggestion, or feedback
- English and Bangla UI (with more languages to come)

## Reporting issues / feedback

Users can report errors, suggestions, or feedback directly from the app
(**Settings → "📧 Report Issue / Suggestion"**). Reports are emailed to the project
team when configured, and otherwise saved locally and retried on the next launch.
See [docs/REPORT.md](docs/REPORT.md).

## Platforms

| Platform | Targets | Status |
| --- | --- | --- |
| Windows x64 | NSIS `.exe`, MSI `.msi` | v1.0.0 |
| Android | `.apk` | v1.0.0 (requires Android SDK/Java toolchain to build) |
| macOS | `.dmg` | v1.0.0 |
| Linux | `.deb`, `.AppImage` | v1.0.0 |

## Getting started

See [docs/INSTALL.md](docs/INSTALL.md) to build and install, and
[docs/USAGE.md](docs/USAGE.md) for how to use the app.

Releases are published from the `main` branch via the GitHub Actions workflow in
`.github/workflows/build.yml`.

## Development

### Prerequisites

- Node.js 20+
- Rust stable (rustup)
- Tauri 2 prerequisites for your platform (see https://v2.tauri.app/start/prerequisites)

### Commands

```bash
npm install          # install workspace dependencies
npm run dev          # run the desktop app (Vite dev + Tauri)
npm run check        # TypeScript typecheck
npm test             # run the vitest suite
npm run build        # build the frontend bundle
```

### Rust backend

```bash
cd apps/desktop/src-tauri
cargo check
cargo test
```

### Project layout

- `apps/desktop` - Tauri 2 + React + TypeScript desktop/mobile app
- `apps/desktop/src-tauri` - Rust backend (process orchestration lives here, behind typed Tauri commands)
- `docs/` - architecture, specs, project state, and decision log

## License & privacy

KWL Video Downloader is free software and collects **no personal data**. Runtime
tools (yt-dlp, FFmpeg, ffprobe) are detected or managed locally; nothing leaves
your device except the download requests you make.

## Release notes

The v1.0.0 release includes: download, queue, history, 3GP, tool management, and
an in-app report center. See [CHANGELOG.md](CHANGELOG.md) for details.

KWL Nexus (cloud account, plans, licensing) is planned for a future release.