# Installing and building KWL Video Downloader

## Installers (end users)

Download the installer for your platform from the latest GitHub release:

| Platform | File |
| --- | --- |
| Windows | `KWL-Video-Downloader_1.0.0_x64-setup.exe` (NSIS) or `.msi` |
| Android | `kwl-video-downloader.apk` |
| macOS | `KWL.Video.Downloader_1.0.0_x64.dmg` |
| Linux | `kwl-video-downloader_1.0.0_amd64.deb` or `*_x64.AppImage` |

No account, login, activation, or license key is required. The app is free and
fully offline.

## Runtime tools

Downloads are powered by **yt-dlp** and **FFmpeg/ffprobe**. KWL Video Downloader
resolves them automatically in this order:

1. Managed tool installed via the app's Tool Manager (under `%APPDATA%\KWL Video Downloader\tools`)
2. A bundled native tool shipped with the package (Android)
3. A tool already available on your system `PATH`

If no tool is found the app stays fully usable; download simply won't start until
a runtime is available. On Android, real `yt-dlp`, `ffmpeg`, and `ffprobe` binaries
must be bundled into the APK (see below).

## Building from source

### Prerequisites

- Node.js 20+ and npm
- Rust stable toolchain (https://rustup.rs)
- Tauri 2 platform prerequisites:
  - Windows: WebView2 runtime, MSVC build tools
  - Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - macOS: Xcode Command Line Tools

All commands run from the repository root.

```bash
npm install
npm run build --workspace @kwl/desktop
```

### Run in development

```bash
npm install
npm run dev
```

### Build desktop installers

```bash
# Windows (NSIS .exe + MSI)
npm run build --workspace @kwl/desktop
npx tauri build --bundles nsis msi

# macOS
npx tauri build --bundles dmg

# Linux
npx tauri build --bundles deb appimage
```

Release artifacts land in `apps/desktop/src-tauri/target/release/bundle/`.

## Building the Android APK

The Android build requires a machine (or CI) with:

- Java 17 (`JAVA_HOME` set)
- Android SDK (Android Studio or `ANDROID_HOME` / `ANDROID_SDK_ROOT`)
- Rust Android targets:
  `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`

### Steps

```bash
npm install
npx tauri android init
npx tauri android build --apk
```

The APK is produced at
`apps/desktop/src-tauri/android/app/build/outputs/apk/`.

This machine could not run these commands because Java and the Android SDK are not
installed (`JAVA_HOME`/`ANDROID_HOME` unset). The GitHub Actions workflow runs the
Android build automatically on tagged releases.

### Android permissions

After `npx tauri android init`, add to the generated
`apps/desktop/src-tauri/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

Application identifier: `com.kwl.videodownloader`, minSdk 24 (Android 7.0).

### Bundling native tools for Android

Android cannot use desktop binaries. Place real Android release binaries in
`apps/desktop/src-tauri/android/app/src/main/assets/native_tools/`:

- `yt-dlp` - official Android build (bundles the Python runtime)
- `ffmpeg`, `ffprobe` - Android static builds

At startup the app extracts these into its internal data dir, marks them
executable (chmod 755), and health-checks them. See the README in that folder.

## Continuous integration

`.github/workflows/build.yml` on `push main` and `v*` tags runs validation
(tests + typecheck), then produces Windows, Linux, macOS, and Android artifacts,
and drafts a GitHub Release with the uploaded installers.