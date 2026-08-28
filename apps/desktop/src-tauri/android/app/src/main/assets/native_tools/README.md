# Android bundled native tools

This directory is bundled into the Android APK under `assets/native_tools/`.

At Android startup the host activity extracts these files into the app's internal
data dir (`<app_data>/native_tools`) and marks them executable (chmod 755). The
Rust layer resolves them through `tools::resolve_bundled_tool` / the bundled-tools
base registered in `app_setup`.

## Required binaries (v1.0.0)

Add the real release binaries here before building the Android APK. They are NOT
committed to the repository because they are third-party downloads and must match
the release ABI (arm64-v8a / armeabi-v7a / x86_64):

| File        | Source                                                             |
| ----------- | ------------------------------------------------------------------ |
| `yt-dlp`    | Official yt-dlp Android build (bundles the Python runtime)         |
| `yt-dlp.py` | (optional) Python entrypoint used by the Android build             |
| `ffmpeg`    | Android static FFmpeg binary (arm64 preferred)                    |
| `ffprobe`   | Android static FFprobe binary shipped alongside `ffmpeg`          |

Only `yt-dlp`, `ffmpeg`, and `ffprobe` are health-checked and consumed by the app.

## Blocked locally

`tauri android init` / `tauri android build` cannot run on the development machine:
Java and the Android SDK are not installed (`JAVA_HOME`/`ANDROID_HOME` unset).
After running `tauri android init` on a Java-enabled machine, also add these
permissions to the generated `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

See `docs/INSTALL.md` for the full Android release procedure.