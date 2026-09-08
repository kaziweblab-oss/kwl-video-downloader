#!/bin/bash
set -e
echo "[android] Building KWL Video Downloader for Android (APK) ..."
npm run build --workspace @kwl/android
# Android requires JDK17 + Android SDK (CI handles)
if ! command -v java >/dev/null 2>&1; then
  echo "[android] Skipping APK build — JDK17 not found (CI will build with setup-java@v4 + setup-android@v3)"
  exit 0
fi
npx tauri android build --apk --config apps/android/src-tauri/tauri.conf.json || {
  echo "[android] APK build skipped locally — requires Android SDK (CI builds)"
}
echo "[android] Done"
