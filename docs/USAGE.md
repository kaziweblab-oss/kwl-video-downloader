# Using KWL Video Downloader

KWL Video Downloader is a free, offline downloader. No account, no login, no license.

## Home screen

- **URL bar** - paste any supported media link.
- **Analyze** - fetch media details (title, author, duration, available formats).
- **Media type** - choose **Video** or **Audio**.
- **Format** - MP4 / WebM / MKV / AVI / MOV / FLV / 3GP for video; MP3 / M4A / Opus / WAV for audio.
- **Quality / Resolution** - the best stream at or below the selected resolution (and FPS where available) is chosen.
- **Download** - start the download.

## Queue

Downloads run in a queue with configurable concurrency (1-5, default 2):

- **Pause / Resume** - freeze and continue individual downloads.
- **Cancel** - stop and clean up a download.
- Progress is shown with real, byte-weighted percentages, speed, and ETA.

## History

Completed downloads are recorded automatically. History tracks file existence:

- entries whose output file is missing are reconciled automatically
- delete single entries or clear the history

## 3GP output

3GP requires a transcode step. When you select 3GP the download first fetches an
intermediate MP4, then converts it with FFmpeg to a low-bitrate 3GP file
(MPEG-4 video, AAC audio, 16 kHz mono).

## Tools

The Settings > Advanced section shows the download toolchain status
(yt-dlp, FFmpeg, ffprobe). If a runtime is missing, the app falls back to the
system `PATH`.

## Settings

- **General** - output folder and language (English / Bangla)
- **Advanced** - number of concurrent downloads
- **Updates** - check for app updates

## Reporting an issue / suggestion

Use **Settings → "📧 Report Issue / Suggestion"** to send the team an error report,
a suggestion, or general feedback:

- pick a **report type** (Error / Suggestion / Feedback)
- write your **message** (required)
- optionally tick **"Attach diagnostic info"** to append the app version,
  platform, and settings (recommended)
- optionally provide your **email** so the team can reply

When email delivery is configured the report is sent immediately. If email is not
configured or delivery fails, the report is saved to a local queue
(`reports.json`) and retried automatically the next time the app launches.

## Privacy

The app runs fully offline. It never sends telemetry, and no data ever leaves your
device other than the download requests you intentionally make and any report you
explicitly submit from **Settings → Report**.

## Language

Switch between English (EN) and Bangla (BN) at any time from Settings > General.