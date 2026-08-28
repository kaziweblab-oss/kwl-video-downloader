# Runtime Configuration

## Production requirement

The desktop application must not depend on arbitrary binaries found via PATH in production.

Production runtime resolution is expected to use bundled binaries in:

```text
resources/runtime/windows-x64/
```

## Development override

For local development, environment variables can be used to point to a local binary installation without committing personal paths into the repo:

```bash
KWL_YTDLP_PATH=/path/to/yt-dlp
KWL_FFMPEG_PATH=/path/to/ffmpeg
KWL_FFPROBE_PATH=/path/to/ffprobe
```

## Security note

- Do not commit real developer paths.
- Do not commit secrets.
- Do not silently use PATH-based binaries in production.
- Do not use shell string interpolation for runtime execution.
